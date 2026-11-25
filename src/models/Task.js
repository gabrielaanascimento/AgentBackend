const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true }, // ID vindo do PostgreSQL
    titulo: { type: String, required: true },
    descricao: { type: String, default: '' },
    prioridade: {
      type: String,
      enum: ['BAIXA', 'MEDIA', 'ALTA'],
      default: 'MEDIA',
    },
    prazo: { type: String, default: null },
    concluida: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Task', taskSchema);
