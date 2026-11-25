
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

// Inicializa as conexões apenas uma vez por instância.
let initializationPromise;

function initializeServices() {
  if (!initializationPromise) {
    initializationPromise = Promise.all([
      initPostgres(),
      initMongo(),
    ]);
  }

  return initializationPromise;
}

// Garante que os serviços estejam prontos antes das rotas.
app.use(async (req, res, next) => {
  try {
    await initializeServices();
    next();
  } catch (error) {
    console.error('Erro ao inicializar serviços:', error);

    res.status(503).json({
      error: 'Serviços temporariamente indisponíveis.',
    });
  }
});

// Healthcheck
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'J.A.R.V.I.S. Tasks API',
  });
});

app.use('/api', apiRoutes);

// Exportação necessária para a Vercel.
module.exports = app;

// Inicialização local: npm start
if (require.main === module) {
  initializeServices()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
      });
    })
    .catch((error) => {
      console.error('Falha ao iniciar o servidor:', error);
      process.exit(1);
    });
}
