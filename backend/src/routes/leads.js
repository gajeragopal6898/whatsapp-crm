const express = require('express');
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get all leads
router.get('/', authMiddleware, async (req, res) => {
  const { stage, search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('leads')
    .select('*, lead_stages(name, color), users(name)', { count: 'exact' })
    .order('last_message_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (stage) query = query.eq('stage_id', stage);
  if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data, total: count, page: Number(page), limit: Number(limit) });
});

// Get single lead with messages
router.get('/:id', authMiddleware, async (req, res) => {
  const { data: lead } = await supabase
    .from('leads')
    .select('*, lead_stages(name, color), users(name)')
    .eq('id', req.params.id)
    .single();

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('lead_id', req.params.id)
    .order('created_at');

  // Mark as read
  await supabase.from('leads').update({ is_read: true }).eq('id', req.params.id);

  res.json({ lead, messages });
});

// Update lead
router.put('/:id', authMiddleware, async (req, res) => {
  const { name, stage_id, assigned_to, notes, follow_up_at, follow_up_done } = req.body;
  const { data, error } = await supabase
    .from('leads')
    .update({ name, stage_id, assigned_to, notes, follow_up_at, follow_up_done })
    .eq('id', req.params.id)
    .select('*, lead_stages(name, color)')
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Export leads to CSV
router.get('/export/csv', authMiddleware, async (req, res) => {
  const { data: leads } = await supabase
    .from('leads')
    .select('*, lead_stages(name)')
    .order('created_at', { ascending: false });

  const headers = ['Name', 'Phone', 'Stage', 'First Message', 'Last Message', 'Follow Up', 'Notes', 'Created At'];
  const rows = leads.map(l => [
    l.name || '',
    l.phone,
    l.lead_stages?.name || '',
    (l.first_message || '').replace(/,/g, ';'),
    (l.last_message || '').replace(/,/g, ';'),
    l.follow_up_at || '',
    (l.notes || '').replace(/,/g, ';'),
    new Date(l.created_at).toLocaleDateString()
  ]);

  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
  res.send(csv);
});

// Get lead stats
router.get('/stats/summary', authMiddleware, async (req, res) => {
  const { data: leads } = await supabase.from('leads').select('stage_id, is_read, created_at, follow_up_at, follow_up_done');
  const { data: stages } = await supabase.from('lead_stages').select('*');

  const today = new Date().toDateString();
  const newToday = leads.filter(l => new Date(l.created_at).toDateString() === today).length;
  const unread = leads.filter(l => !l.is_read).length;
  const followUps = leads.filter(l => l.follow_up_at && !l.follow_up_done && new Date(l.follow_up_at) <= new Date()).length;

  const byStage = stages.map(s => ({
    ...s,
    count: leads.filter(l => l.stage_id === s.id).length
  }));

  res.json({ total: leads.length, newToday, unread, followUps, byStage });
});

module.exports = router;
