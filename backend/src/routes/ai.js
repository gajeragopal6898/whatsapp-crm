const router = require('express').Router();
const auth = require('../middleware/auth');
const supabase = require('../supabase');
const { generateReply, summarizeConversation } = require('../ai');

// Get AI settings
router.get('/settings', auth, async (req, res) => {
  const { data } = await supabase.from('settings').select('value').eq('key', 'ai_settings').single();
  res.json(data?.value || {
    enabled: false,
    mode: 'semi', // full | semi | off
    business_context: '',
    reply_delay: 3,
    max_auto_replies: 5,
    escalate_keywords: ['human', 'agent', 'person', 'manager']
  });
});

// Save AI settings
router.post('/settings', auth, async (req, res) => {
  const { data, error } = await supabase.from('settings').upsert({
    key: 'ai_settings', value: req.body
  }, { onConflict: 'key' }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.value);
});

// Manually generate AI reply for a lead (preview)
router.post('/preview', auth, async (req, res) => {
  const { lead_id, message } = req.body;
  try {
    const { data: settings } = await supabase.from('settings').select('value').eq('key', 'ai_settings').single();
    const { data: messages } = await supabase.from('messages').select('*')
      .eq('lead_id', lead_id).order('created_at', { ascending: false }).limit(6);
    const { data: lead } = await supabase.from('leads').select('name').eq('id', lead_id).single();

    const reply = await generateReply({
      customerMessage: message,
      businessContext: settings?.value?.business_context || '',
      conversationHistory: (messages || []).reverse(),
      customerName: lead?.name || ''
    });
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Summarize a lead conversation
router.post('/summarize/:leadId', auth, async (req, res) => {
  try {
    const { data: messages } = await supabase.from('messages').select('*')
      .eq('lead_id', req.params.leadId).order('created_at', { ascending: true });
    if (!messages?.length) return res.json({ summary: 'No messages to summarize.' });
    const summary = await summarizeConversation(messages);
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
