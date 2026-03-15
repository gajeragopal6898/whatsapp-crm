const router = require('express').Router();
const auth = require('../middleware/auth');
const supabase = require('../supabase');

// ─── GET purchases for a lead ─────────────────────────────────────────────────
router.get('/lead/:leadId', auth, async (req, res) => {
  const { data } = await supabase
    .from('purchases')
    .select('*')
    .eq('lead_id', req.params.leadId)
    .order('purchase_date', { ascending: false });
  res.json(data || []);
});

// ─── GET all purchases (with optional phone filter) ───────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { phone, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('purchases')
      .select('*, leads (id, name, phone)')
      .order('purchase_date', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (phone) query = query.eq('phone', phone);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET follow-ups due ───────────────────────────────────────────────────────
// Returns day-10, day-45, and course-complete follow-ups that are pending
router.get('/followups/due', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const day10Date = new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0];
    const day45Date = new Date(Date.now() - 45 * 86400000).toISOString().split('T')[0];

    const [{ data: day10, error: e1 }, { data: day45, error: e2 }, { data: complete, error: e3 }] =
      await Promise.all([
        supabase.from('purchases').select('*, leads (id, name, phone)')
          .eq('followup_day_10_sent', false).lte('purchase_date', day10Date),
        supabase.from('purchases').select('*, leads (id, name, phone)')
          .eq('followup_day_45_sent', false).lte('purchase_date', day45Date),
        supabase.from('purchases').select('*, leads (id, name, phone)')
          .eq('followup_complete_sent', false)
      ]);

    if (e1 || e2 || e3) throw e1 || e2 || e3;

    const completeDue = (complete || []).filter(p => {
      const doneDate = new Date(p.purchase_date);
      doneDate.setDate(doneDate.getDate() + (p.course_days || 60));
      return doneDate.toISOString().split('T')[0] <= today;
    });

    res.json({
      day_10_due: day10 || [],
      day_45_due: day45 || [],
      complete_due: completeDue
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET conversation flow state ──────────────────────────────────────────────
router.get('/flow-state/:phone', auth, async (req, res) => {
  const { data } = await supabase
    .from('conversation_state')
    .select('*')
    .eq('phone', req.params.phone)
    .single()
    .catch(() => ({ data: null }));
  res.json(data || {});
});

// ─── ADD purchase ─────────────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  const { lead_id, phone, product_name, quantity, purchase_date, course_days, notes } = req.body;

  if (!lead_id || !product_name || !purchase_date) {
    return res.status(400).json({ error: 'lead_id, product_name and purchase_date required' });
  }

  try {
    const { data, error } = await supabase
      .from('purchases')
      .insert({
        lead_id, phone, product_name, quantity,
        purchase_date, course_days: course_days || 60,
        notes, created_by: req.user.id
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Update lead stage to Closed
    const { data: stage } = await supabase
      .from('lead_stages').select('id').eq('name', 'Closed').single();
    if (stage) await supabase.from('leads').update({ stage_id: stage.id }).eq('id', lead_id);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── RESET conversation flow for a lead ──────────────────────────────────────
router.post('/reset-flow/:phone', auth, async (req, res) => {
  await supabase.from('conversation_state').delete().eq('phone', req.params.phone);
  res.json({ success: true, message: 'Flow reset - customer will get welcome message on next message' });
});

// ─── UPDATE purchase ──────────────────────────────────────────────────────────
router.patch('/:id', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('purchases')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── DELETE purchase ──────────────────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  await supabase.from('purchases').delete().eq('id', req.params.id);
  res.json({ success: true });
});

module.exports = router;
