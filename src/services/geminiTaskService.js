const { GoogleGenAI, Type } = require('@google/genai');
const Task = require('../models/Task');
const ChatHistory = require('../models/ChatHistory');

// Força v1beta para liberar todos os modelos da sua chave e define timeout de 20s
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    apiVersion: 'v1beta',
    timeout: 20000,
  },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sanitizePlainObject(data) {
  return JSON.parse(JSON.stringify(data));
}

const taskTools = [
  {
    functionDeclarations: [
      {
        name: 'criar_tarefa',
        description: 'Cria uma nova tarefa na lista do usuário.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            titulo: { type: Type.STRING, description: 'Título principal da tarefa' },
            descricao: { type: Type.STRING, description: 'Detalhes extras da tarefa (opcional)' },
            prioridade: {
              type: Type.STRING,
              description: 'Nível de prioridade: BAIXA, MEDIA ou ALTA',
            },
            prazo: { type: Type.STRING, description: 'Data ou horário limite (opcional)' },
          },
          required: ['titulo'],
        },
      },
      {
        name: 'listar_tarefas',
        description: 'Lista todas as tarefas cadastradas do usuário atual.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            apenasPendentes: {
              type: Type.BOOLEAN,
              description: 'Se true, retorna somente tarefas não concluídas',
            },
          },
        },
      },
      {
        name: 'editar_tarefa',
        description: 'Atualiza o título, prioridade, prazo ou status de conclusão de uma tarefa pelo ID.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: 'ID (_id) da tarefa no MongoDB' },
            titulo: { type: Type.STRING, description: 'Novo título da tarefa' },
            prioridade: { type: Type.STRING, description: 'BAIXA, MEDIA ou ALTA' },
            prazo: { type: Type.STRING, description: 'Novo prazo' },
            concluida: { type: Type.BOOLEAN, description: 'true para concluir, false para reabrir' },
          },
          required: ['id'],
        },
      },
      {
        name: 'apagar_tarefa',
        description: 'Remove permanentemente uma tarefa pelo ID.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: 'ID (_id) da tarefa a ser apagada' },
          },
          required: ['id'],
        },
      },
    ],
  },
];

async function executeToolCall(userId, call) {
  const { name, args } = call;

  if (name === 'criar_tarefa') {
    const novaTarefa = await Task.create({
      userId,
      titulo: args.titulo,
      descricao: args.descricao || '',
      prioridade: ['BAIXA', 'MEDIA', 'ALTA'].includes(args.prioridade) ? args.prioridade : 'MEDIA',
      prazo: args.prazo || null,
    });
    return sanitizePlainObject({ status: 'criada', tarefa: novaTarefa.toObject() });
  }

  if (name === 'listar_tarefas') {
    const filter = { userId };
    if (args?.apenasPendentes) filter.concluida = false;
    const tarefas = await Task.find(filter).sort({ createdAt: -1 }).lean();
    return sanitizePlainObject({ total: tarefas.length, tarefas });
  }

  if (name === 'editar_tarefa') {
    const updates = {};
    if (args.titulo !== undefined) updates.titulo = args.titulo;
    if (args.prioridade !== undefined) updates.prioridade = args.prioridade;
    if (args.prazo !== undefined) updates.prazo = args.prazo;
    if (args.concluida !== undefined) updates.concluida = args.concluida;

    const tarefaAtualizada = await Task.findOneAndUpdate(
      { _id: args.id, userId },
      { $set: updates },
      { new: true }
    ).lean();

    if (!tarefaAtualizada) return { erro: 'Tarefa não encontrada para este usuário.' };
    return sanitizePlainObject({ status: 'atualizada', tarefa: tarefaAtualizada });
  }

  if (name === 'apagar_tarefa') {
    const removida = await Task.findOneAndDelete({ _id: args.id, userId }).lean();
    if (!removida) return { erro: 'Tarefa não encontrada para remoção.' };
    return { status: 'removida', id: String(args.id), titulo: removida.titulo };
  }

  return { erro: `Função ${name} desconhecida.` };
}

function isTransientError(err) {
  return (
    err?.status === 503 ||
    err?.status === 504 ||
    err?.status === 429 ||
    err?.status === 500 ||
    err?.code === 'ECONNRESET' ||
    err?.name === 'AbortError' ||
    (err?.message && err.message.includes('fetch failed'))
  );
}

// Alterna rapidamente entre os modelos disponíveis da sua conta sem perder tempo em 404
async function sendWithResilience(history, systemInstruction, messagePayload) {
  const models = [
    'gemini-4-hydrogen',
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash',
  ];
  let lastError;

  for (const modelName of models) {
    try {
      const chat = ai.chats.create({
        model: modelName,
        history: sanitizePlainObject(history),
        config: {
          systemInstruction,
          tools: taskTools,
          temperature: 0.3,
        },
      });

      const response = await chat.sendMessage({ message: messagePayload });
      console.log(`✅ [Gemini] Respondido com sucesso via ${modelName}`);
      return { chat, response };
    } catch (err) {
      lastError = err;

      if (err?.status === 404 || err?.status === 400) {
        console.warn(
          `⏭️ [Gemini] ${modelName} indisponível ou incompatível (${err.status}), testando próximo...`
        );
        continue;
      }

      if (isTransientError(err)) {
        console.warn(
          `⚠️ [Gemini] ${modelName} sobrecarregado (${err.status || err.code || 'timeout'}), alternando modelo...`
        );
        await sleep(800);
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}

function buildFallbackReply(executedActions) {
  const last = executedActions[executedActions.length - 1];
  if (!last) return 'Operação concluída com sucesso.';

  if (last.functionName === 'criar_tarefa') {
    return `Pronto! A tarefa "${last.result?.tarefa?.titulo}" foi adicionada à sua lista.`;
  }
  if (last.functionName === 'editar_tarefa') {
    return `Tarefa "${last.result?.tarefa?.titulo}" atualizada com sucesso.`;
  }
  if (last.functionName === 'apagar_tarefa') {
    return `Tarefa "${last.result?.titulo}" removida da sua lista.`;
  }
  if (last.functionName === 'listar_tarefas') {
    const total = last.result?.total || 0;
    return total === 0
      ? 'Você não possui tarefas cadastradas no momento.'
      : `Você tem ${total} tarefa(s) registrada(s) na sua lista.`;
  }
  return 'Ação executada no banco de dados com sucesso.';
}

async function processUserMessage(user, userMessage) {
  let chatDoc = await ChatHistory.findOne({ userId: user.id }).lean();
  if (!chatDoc) {
    const created = await ChatHistory.create({ userId: user.id, contents: [] });
    chatDoc = created.toObject();
  }

  const recentHistory = sanitizePlainObject((chatDoc.contents || []).slice(-40));

  const systemInstruction =
    `Você é o J.A.R.V.I.S., assistente pessoal de tarefas de ${user.name}. ` +
    'Seja direto, prestativo e natural. ' +
    'Sempre que o usuário quiser editar ou apagar uma tarefa pelo nome, chame primeiro "listar_tarefas" para descobrir o ID exato antes de editar ou apagar.';

  let { chat, response } = await sendWithResilience(
    recentHistory,
    systemInstruction,
    userMessage
  );

  const executedActions = [];
  let finalReplyText = '';

  while (response && response.functionCalls && response.functionCalls.length > 0) {
    const functionResponses = [];

    for (const call of response.functionCalls) {
      const result = await executeToolCall(user.id, call);
      executedActions.push({
        functionName: call.name,
        args: call.args,
        result,
      });

      functionResponses.push({
        functionResponse: {
          name: call.name,
          response: { result },
        },
      });
    }

    let sentSuccess = false;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        response = await chat.sendMessage({ message: functionResponses });
        sentSuccess = true;
        break;
      } catch (err) {
        if (isTransientError(err)) {
          console.warn(
            `⚠️ [Gemini] Falha no retorno da função (${err.status || err.code || 'timeout'}). Tentativa ${attempt}/2...`
          );
          await sleep(1000 * attempt);
          continue;
        }
        throw err;
      }
    }

    if (!sentSuccess) {
      finalReplyText = buildFallbackReply(executedActions);
      break;
    }
  }

  if (!finalReplyText && response) {
    finalReplyText = response.text;
  }

  let updatedHistory;
  try {
    updatedHistory = sanitizePlainObject(await chat.getHistory());
  } catch {
    updatedHistory = sanitizePlainObject(chat.history || []);
  }

  await ChatHistory.findOneAndUpdate(
    { userId: user.id },
    { $set: { contents: updatedHistory } },
    { upsert: true }
  );

  return {
    reply: finalReplyText,
    executedActions,
  };
}

module.exports = { processUserMessage };