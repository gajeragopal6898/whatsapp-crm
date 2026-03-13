// rules.js
const router = require('express').Router();
const supabase = require('../supabase');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  const { data } = await supabase.from('auto_reply_rules').select('*').order('created_at');
  res.json(data || []);
});

router.post('/', auth, async (req, res) => {
  const { data, error } = await supabase.from('auto_reply_rules').insert(req.body).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.patch('/:id', auth, async (req, res) => {
  const { data, error } = await supabase.from('auto_reply_rules').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', auth, async (req, res) => {
  await supabase.from('auto_reply_rules').delete().eq('id', req.params.id);
  res.json({ success: true });
});

module.exports = router;
