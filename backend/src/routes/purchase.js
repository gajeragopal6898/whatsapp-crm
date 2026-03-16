const router = require('express').Router();
const auth = require('../middleware/auth');
const supabase = require('../supabase');

// Get purchases for a lead
router.get('/lead/:leadId', auth, async (req, res) => {
  const { data } = await supabase.from('purchases').select('*')
    .eq('lead_id', req.params.leadId).order('purchase_date', { ascending: false });
  res.json(data || []);
});

// Add purchase
router.post('/', auth, async (req, res) => {
  const { lead_id, phone, product_name, quantity, purchase_date, course_days, notes } = req.body;
  if (!lead_id || !product_name || !purchase_date) {
    return res.status(400).json({ error: 'lead_id, product_name and purchase_date required' });
  }
  try {
    const { data, error } = await supabase.from('purchases').insert({
      lead_id, phone, product_name, quantity,
      purchase_date, course_days: course_days || 60,
      notes, created_by: req.user.id
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });

    // Update lead stage to Closed
    const { data: stage } = await supabase.from('lead_stages').select('id').eq('name', 'Closed').single();
    if (stage) await supabase.from('leads').update({ stage_id: stage.id }).eq('id', lead_id);

    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update purchase
router.patch('/:id', auth, async (req, res) => {
  const { data, error } = await supabase.from('purchases').update(req.body)
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Delete purchase
router.delete('/:id', auth, async (req, res) => {
  await supabase.from('purchases').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// Reset conversation flow for a lead (agent can restart the flow)
router.post('/reset-flow/:phone', auth, async (req, res) => {
  await supabase.from('conversation_state').delete().eq('phone', req.params.phone);
  res.json({ success: true, message: 'Flow reset - customer will get welcome message on next message' });
});

// Get conversation state
router.get('/flow-state/:phone', auth, async (req, res) => {
  try {
    const { data } = await supabase.from('conversation_state').select('*').eq('phone', req.params.phone).single();
    res.json(data || {});
  } catch {
    res.json({});
  }
});

module.exports = router;
