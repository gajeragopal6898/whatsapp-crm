const router = require('express').Router();
const supabase = require('../supabase');
const auth = require('../middleware/auth');
const { sendMessage } = require('../whatsapp');

router.get('/:leadId', auth, async (req, res) => {
  const { data } = await supabase.from('messages').select('*').eq('lead_id', req.params.leadId).order('created_at', { ascending: true });
  await supabase.from('messages').update({ is_read: true }).eq('lead_id', req.params.leadId).eq('direction', 'incoming');
  await supabase.from('leads').update({ is_read: true }).eq('id', req.params.leadId);
  res.json(data || []);
});

router.post('/send', auth, async (req, res) => {
  const { phone, text, lead_id } = req.body;
  try {
    await sendMessage(phone, text);
    const { data } = await supabase.from('messages').insert({ lead_id, phone, content: text, direction: 'outgoing', is_read: true }).select().single();
    await supabase.from('leads').update({ last_message: text, last_message_at: new Date().toISOString() }).eq('id', lead_id);
    req.app.get('io').emit('message:new', data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
