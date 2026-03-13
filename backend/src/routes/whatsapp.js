const express = require('express');
const { getStatus, sendMessage, disconnectWhatsApp, initWhatsApp } = require('../services/whatsapp');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const supabase = require('../config/supabase');

const router = express.Router();

// Get WhatsApp status + QR
router.get('/status', authMiddleware, (req, res) => {
  const status = getStatus();
  res.json(status);
});

// Send message
router.post('/send', authMiddleware, async (req, res) => {
  const { phone, message } = req.body;
  try {
    await sendMessage(phone, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Disconnect WhatsApp
router.post('/disconnect', authMiddleware, adminOnly, async (req, res) => {
  await disconnectWhatsApp();
  res.json({ success: true });
});

module.exports = router;
