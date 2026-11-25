const mongoose = require('mongoose');

/**
 * Armazena o array exato de 'contents' compatível com o SDK @google/genai
 * para manter memória contínua de mensagens, functionCalls e functionResponses.
 */
const chatHistorySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    contents: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChatHistory', chatHistorySchema);
