const { processUserMessage } = require('../services/geminiTaskService');
const ChatHistory = require('../models/ChatHistory');
const Task = require('../models/Task');

async function sendMessage(req, res) {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'O campo "message" é obrigatório.' });
  }

  try {
    const result = await processUserMessage(req.user, message.trim());
    return res.json(result);
  } catch (err) {
    console.error('Erro no processamento Gemini:', err);
    return res.status(500).json({ error: 'Falha ao processar mensagem com a IA.' });
  }
}

async function getChatHistory(req, res) {
  try {
    const chatDoc = await ChatHistory.findOne({ userId: req.user.id }).lean();
    if (!chatDoc) return res.json({ messages: [] });

    // Filtra apenas mensagens visíveis de texto (user e model) para exibir na tela do app mobile
    const formatted = [];
    for (const entry of chatDoc.contents) {
      const textParts = (entry.parts || []).filter((p) => p.text).map((p) => p.text);
      if (textParts.length > 0) {
        formatted.push({
          role: entry.role,
          text: textParts.join('\n'),
        });
      }
    }

    return res.json({ messages: formatted });
  } catch (err) {
    console.error('Erro ao buscar histórico:', err);
    return res.status(500).json({ error: 'Erro ao carregar histórico de conversa.' });
  }
}

async function clearChatHistory(req, res) {
  try {
    await ChatHistory.findOneAndUpdate({ userId: req.user.id }, { $set: { contents: [] } });
    return res.json({ message: 'Memória do chat limpa com sucesso.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao limpar memória.' });
  }
}

// Endpoint direto para o app mobile listar tarefas na UI sem gastar tokens de IA
async function getTasksDirect(req, res) {
  try {
    const tasks = await Task.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
    return res.json({ tasks });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao buscar tarefas.' });
  }
}

module.exports = {
  sendMessage,
  getChatHistory,
  clearChatHistory,
  getTasksDirect,
};
