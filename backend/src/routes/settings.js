const express = require('express');
const supabase = require('../config/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Get all settings
router.get('/', authMiddleware, async (req, res) => {
  const { data } = await supabase.from('settings').select('*');
  const settings = {};
  data.forEach(s => settings[s.key] = s.value);
  res.json(settings);
});

// Update a setting
router.put('/:key', authMiddleware, adminOnly, async (req, res) => {
  const { value } = req.body;
  const { data, error } = await supabase
    .from('settings')
    .update({ value, updated_at: new Date().toISOString() })
    .eq('key', req.params.key)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Get lead stages
router.get('/stages/all', authMiddleware, async (req, res) => {
  const { data } = await supabase.from('lead_stages').select('*').order('order_index');
  res.json(data);
});

// Create lead stage
router.post('/stages', authMiddleware, adminOnly, async (req, res) => {
  const { name, color } = req.body;
  const { data: existing } = await supabase.from('lead_stages').select('order_index').order('order_index', { ascending: false }).limit(1);
  const nextOrder = (existing?.[0]?.order_index || 0) + 1;

  const { data, error } = await supabase
    .from('lead_stages')
    .insert({ name, color: color || '#6366f1', order_index: nextOrder })
    .select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Update stage
router.put('/stages/:id', authMiddleware, adminOnly, async (req, res) => {
  const { name, color } = req.body;
  const { data, error } = await supabase
    .from('lead_stages')
    .update({ name, color })
    .eq('id', req.params.id)
    .select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Delete stage
router.delete('/stages/:id', authMiddleware, adminOnly, async (req, res) => {
  await supabase.from('lead_stages').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// Get auto-reply rules
router.get('/rules/all', authMiddleware, async (req, res) => {
  const { data } = await supabase.from('auto_reply_rules').select('*').order('created_at');
  res.json(data);
});

// Create auto-reply rule
router.post('/rules', authMiddleware, adminOnly, async (req, res) => {
  const { name, type, keywords, reply_text, is_active } = req.body;
  const { data, error } = await supabase
    .from('auto_reply_rules')
    .insert({ name, type, keywords, reply_text, is_active })
    .select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Update rule
router.put('/rules/:id', authMiddleware, adminOnly, async (req, res) => {
  const { name, keywords, reply_text, is_active } = req.body;
  const { data, error } = await supabase
    .from('auto_reply_rules')
    .update({ name, keywords, reply_text, is_active })
    .eq('id', req.params.id)
    .select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Delete rule
router.delete('/rules/:id', authMiddleware, adminOnly, async (req, res) => {
  await supabase.from('auto_reply_rules').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// Get notifications
router.get('/notifications/all', authMiddleware, async (req, res) => {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  res.json(data);
});

// Mark notifications read
router.put('/notifications/read', authMiddleware, async (req, res) => {
  await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
  res.json({ success: true });
});

module.exports = router;
