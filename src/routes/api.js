const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { register, login } = require('../controllers/authController');
const {
  sendMessage,
  getChatHistory,
  clearChatHistory,
  getTasksDirect,
} = require('../controllers/chatController');

// Rotas Públicas (Autenticação - PostgreSQL)
router.post('/auth/register', register);
router.post('/auth/login', login);

// Rotas Protegidas (App Mobile -> Gemini + MongoDB)
router.post('/chat', authMiddleware, sendMessage);
router.get('/chat/history', authMiddleware, getChatHistory);
router.delete('/chat/history', authMiddleware, clearChatHistory);
router.get('/tasks', authMiddleware, getTasksDirect);

module.exports = router;
