const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// Create user (admin only)
router.post('/users', authMiddleware, adminOnly, async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from('users')
      .insert({ name, email, password: hashed, role: role || 'agent' })
      .select('id, name, email, role')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all users (admin only)
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  const { data } = await supabase
    .from('users')
    .select('id, name, email, role, is_active, created_at')
    .order('created_at');
  res.json(data);
});

// Update user
router.put('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  const { name, role, is_active } = req.body;
  const { data, error } = await supabase
    .from('users')
    .update({ name, role, is_active })
    .eq('id', req.params.id)
    .select('id, name, email, role, is_active')
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Delete user
router.delete('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  await supabase.from('users').update({ is_active: false }).eq('id', req.params.id);
  res.json({ success: true });
});

module.exports = router;
