const router = require('express').Router();
const supabase = require('../supabase');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  const { data } = await supabase.from('settings').select('*');
  const result = {};
  (data || []).forEach(r => result[r.key] = r.value);
  res.json(result);
});

router.get('/stages', auth, async (req, res) => {
  const { data } = await supabase.from('lead_stages').select('*').order('order_index');
  res.json(data || []);
});

router.post('/stages', auth, async (req, res) => {
  const { data, error } = await supabase.from('lead_stages').insert(req.body).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.patch('/stages/:id', auth, async (req, res) => {
  const { data, error } = await supabase.from('lead_stages').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/stages/:id', auth, async (req, res) => {
  await supabase.from('lead_stages').delete().eq('id', req.params.id);
  res.json({ success: true });
});

router.patch('/:key', auth, async (req, res) => {
  const { data, error } = await supabase.from('settings').upsert({ key: req.params.key, value: req.body }, { onConflict: 'key' }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
