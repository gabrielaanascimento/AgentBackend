const mongoose = require('mongoose');

async function initMongo() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ [MongoDB] Conectado com sucesso (Tarefas & Memória do Chat).');
}

module.exports = { initMongo };
