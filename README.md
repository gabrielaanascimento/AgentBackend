# J.A.R.V.I.S. Tasks Back-end

Back-end em **Node.js + Express** com arquitetura híbrida:
- **PostgreSQL**: Autenticação e cadastro de usuários (`users`).
- **MongoDB**: Armazenamento de tarefas (`tasks`) e persistência contínua do histórico/memória do chat (`chathistories`).
- **Google Gemini (`@google/genai`)**: Function Calling automático para criar, listar, editar e apagar tarefas em linguagem natural.

## Como rodar

1. Renomeie `.env.example` para `.env` e preencha suas credenciais do PostgreSQL, MongoDB e `GEMINI_API_KEY`.
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Inicie em modo desenvolvimento:
   ```bash
   npm run dev
   ```

## Endpoints para o App Mobile

- `POST /api/auth/register` -> `{ "name": "...", "email": "...", "password": "..." }`
- `POST /api/auth/login` -> `{ "email": "...", "password": "..." }` (retorna `token` JWT)
- `POST /api/chat` *(Header: `Authorization: Bearer <token>`)* -> `{ "message": "Crie uma tarefa para estudar React Native amanhã" }`
- `GET /api/chat/history` *(Header: `Authorization: Bearer <token>`)* -> Retorna o histórico salvo no MongoDB
- `DELETE /api/chat/history` *(Header: `Authorization: Bearer <token>`)* -> Limpa a memória da conversa
- `GET /api/tasks` *(Header: `Authorization: Bearer <token>`)* -> Lista as tarefas diretamente para renderizar na tela do app
