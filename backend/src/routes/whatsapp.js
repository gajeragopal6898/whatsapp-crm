const router = require('express').Router();
const auth = require('../middleware/auth');
const { getStatus } = require('../whatsapp');

router.get('/status', auth, (req, res) => {
  const { isConnected, currentQR } = getStatus();
  res.json({ isConnected, qr: currentQR });
});

module.exports = router;
