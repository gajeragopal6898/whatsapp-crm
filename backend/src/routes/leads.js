const router = require('express').Router();
const supabase = require('../supabase');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  const { page = 1, limit = 20, search, stage, assigned } = req.query;
  let query = supabase.from('leads').select('*, stage:lead_stages(id,name,color), assignee:users!leads_assigned_to_fkey(id,name)', { count: 'exact' });
  if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
  if (stage) query = query.eq('stage_id', stage);
  if (assigned) query = query.eq('assigned_to', assigned);
  query = query.order('last_message_at', { ascending: false }).range((page - 1) * limit, page * limit - 1);
  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data, total: count, page: +page, limit: +limit });
});

router.get('/:id', auth, async (req, res) => {
  const { data, error } = await supabase.from('leads').select('*, stage:lead_stages(id,name,color), assignee:users!leads_assigned_to_fkey(id,name)').eq('id', req.params.id).single();
  if (error) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

router.patch('/:id', auth, async (req, res) => {
  const { data, error } = await supabase.from('leads').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  req.app.get('io').emit('lead:updated', data);
  res.json(data);
});

router.get('/export/csv', auth, async (req, res) => {
  const { data } = await supabase.from('leads').select('name, phone, first_message, last_message, last_message_at, message_count, notes, created_at');
  const headers = ['Name', 'Phone', 'First Message', 'Last Message', 'Last Message At', 'Message Count', 'Notes', 'Created At'];
  const rows = data.map(r => [r.name, r.phone, r.first_message, r.last_message, r.last_message_at, r.message_count, r.notes, r.created_at].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','));
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
  res.send([headers.join(','), ...rows].join('\n'));
});

module.exports = router;
