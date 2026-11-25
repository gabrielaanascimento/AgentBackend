require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initPostgres } = require('./config/postgres');
const { initMongo } = require('./config/mongo');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Healthcheck
app.get('/', (req, res) => {
  res.json({ status: 'online', service: 'J.A.R.V.I.S. Tasks API (Postgres + MongoDB + Gemini)' });
});

app.use('/api', apiRoutes);

async function bootstrap() {
  try {
    await initPostgres();
    await initMongo();

    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Falha crítica ao iniciar o servidor:', err);
    process.exit(1);
  }
}

bootstrap();
