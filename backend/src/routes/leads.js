const router = require('express').Router();
const supabase = require('../supabase');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  const { page = 1, limit = 20, search, stage, assigned, date_from, date_to, product } = req.query;

  let query = supabase.from('leads')
    .select('*, stage:lead_stages(id,name,color), assignee:users!leads_assigned_to_fkey(id,name)', { count: 'exact' });

  if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
  if (stage) query = query.eq('stage_id', stage);
  if (assigned) query = query.eq('assigned_to', assigned);
  if (date_from) query = query.gte('created_at', date_from);
  if (date_to) query = query.lte('created_at', date_to + 'T23:59:59Z');

  // Product filter — search AI memory
  if (product) {
    const { data: memories } = await supabase.from('customer_memory')
      .select('phone').contains('products_recommended', [product]);
    const phones = (memories || []).map(m => m.phone);
    if (phones.length > 0) query = query.in('phone', phones);
    else return res.json({ data: [], total: 0, page: +page, limit: +limit });
  }

  query = query.order('last_message_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data, total: count, page: +page, limit: +limit });
});

router.get('/:id', auth, async (req, res) => {
  const { data, error } = await supabase.from('leads')
    .select('*, stage:lead_stages(id,name,color), assignee:users!leads_assigned_to_fkey(id,name)')
    .eq('id', req.params.id).single();
  if (error) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

router.patch('/:id', auth, async (req, res) => {
  const { data, error } = await supabase.from('leads').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  req.app.get('io').emit('lead:updated', data);
  res.json(data);
});

// Update lead name
router.patch('/:id/name', auth, async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const { data, error } = await supabase.from('leads').update({ name: name.trim() }).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  req.app.get('io').emit('lead:updated', data);
  res.json(data);
});

// Export CSV with all important columns
router.get('/export/csv', auth, async (req, res) => {
  const { stage, date_from, date_to } = req.query;
  let query = supabase.from('leads')
    .select('name, phone, first_message, last_message, last_message_at, message_count, notes, created_at, stage:lead_stages(name)');
  if (stage) query = query.eq('stage_id', stage);
  if (date_from) query = query.gte('created_at', date_from);
  if (date_to) query = query.lte('created_at', date_to + 'T23:59:59Z');
  query = query.order('created_at', { ascending: false });

  const { data } = await query;

  const headers = ['Name', 'Mobile Number', 'Stage', 'First Message', 'First Contact Date', 'Last Message', 'Last Active', 'Total Messages', 'Notes'];
  const rows = (data || []).map(r => [
    r.name || 'Unknown',
    r.phone,
    r.stage?.name || 'New',
    r.first_message || '',
    r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '',
    r.last_message || '',
    r.last_message_at ? new Date(r.last_message_at).toLocaleDateString('en-IN') : '',
    r.message_count || 0,
    r.notes || ''
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
  res.send([headers.join(','), ...rows].join('\n'));
});

module.exports = router;

// Delete lead with password verification
router.delete('/:id', auth, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });
  
  try {
    // Verify password against the requesting user
    const bcrypt = require('bcryptjs');
    const { data: user } = await supabase.from('users').select('password_hash').eq('id', req.user.id).single();
    const valid = user?.password_hash && await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Incorrect password' });
    
    // Delete messages first, then lead
    await supabase.from('messages').delete().eq('lead_id', req.params.id);
    await supabase.from('conversation_state').delete().eq('lead_id', req.params.id);
    await supabase.from('purchases').delete().eq('lead_id', req.params.id);
    await supabase.from('leads').delete().eq('id', req.params.id);
    
    req.app.get('io').emit('lead:deleted', { id: req.params.id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Transfer lead to another user
router.patch('/:id/transfer', auth, async (req, res) => {
  const { assigned_to } = req.body;
  if (!assigned_to) return res.status(400).json({ error: 'assigned_to required' });
  const { data, error } = await supabase.from('leads').update({ assigned_to }).eq('id', req.params.id).select('*, assignee:users!leads_assigned_to_fkey(id,name,email)').single();
  if (error) return res.status(500).json({ error: error.message });
  req.app.get('io').emit('lead:updated', data);
  res.json(data);
});
