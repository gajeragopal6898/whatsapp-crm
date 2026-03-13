const router = require('express').Router();
const bcrypt = require('bcryptjs');
const supabase = require('../supabase');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  const { data } = await supabase.from('users').select('id, name, email, role, is_active, created_at').order('created_at');
  res.json(data || []);
});

router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { name, email, password, role } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  const { data, error } = await supabase.from('users').insert({ name, email, password: hashed, role }).select('id, name, email, role').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.patch('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const updates = { ...req.body };
  if (updates.password) updates.password = await bcrypt.hash(updates.password, 10);
  const { data, error } = await supabase.from('users').update(updates).eq('id', req.params.id).select('id, name, email, role, is_active').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  await supabase.from('users').update({ is_active: false }).eq('id', req.params.id);
  res.json({ success: true });
});

module.exports = router;
