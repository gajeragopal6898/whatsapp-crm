const router = require('express').Router();
const auth = require('../middleware/auth');
const supabase = require('../supabase');
const { generateReply, summarizeConversation, getCustomerMemory } = require('../ai');

// ─── AI SETTINGS ─────────────────────────────────────────────────────────────
router.get('/settings', auth, async (req, res) => {
  const { data } = await supabase.from('settings').select('value').eq('key', 'ai_settings').single();
  res.json(data?.value || {
    enabled: false, mode: 'semi',
    business_context: '',
    reply_delay: 3,
    max_auto_replies: 5,
    escalate_keywords: ['human', 'agent', 'person', 'manager', 'owner']
  });
});

router.post('/settings', auth, async (req, res) => {
  const { data, error } = await supabase.from('settings').upsert({
    key: 'ai_settings', value: req.body
  }, { onConflict: 'key' }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.value);
});

// ─── TEST AI REPLY ────────────────────────────────────────────────────────────
router.post('/preview', auth, async (req, res) => {
  const { message, lead_id, phone } = req.body;
  try {
    const { data: settings } = await supabase.from('settings').select('value').eq('key', 'ai_settings').single();
    const { data: messages } = lead_id ? await supabase.from('messages').select('*')
      .eq('lead_id', lead_id).order('created_at', { ascending: false }).limit(6) : { data: [] };
    const { data: lead } = lead_id ? await supabase.from('leads').select('name, phone').eq('id', lead_id).single() : { data: null };

    const reply = await generateReply({
      customerMessage: message,
      businessContext: settings?.value?.business_context || '',
      conversationHistory: (messages || []).reverse(),
      customerName: lead?.name || '',
      phone: phone || lead?.phone || '',
      leadId: lead_id || ''
    });
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SUMMARIZE CONVERSATION ───────────────────────────────────────────────────
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

// ─── CUSTOMER MEMORY ──────────────────────────────────────────────────────────
router.get('/memory/:phone', auth, async (req, res) => {
  try {
    const memory = await getCustomerMemory(req.params.phone);
    res.json(memory || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/memory/:phone', auth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('customer_memory')
      .update({ ...req.body, last_updated: new Date().toISOString() })
      .eq('phone', req.params.phone).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── KNOWLEDGE BASE DOCUMENTS ─────────────────────────────────────────────────
router.get('/knowledge', auth, async (req, res) => {
  const { data } = await supabase.from('knowledge_documents')
    .select('id, name, file_type, is_active, created_at')
    .order('created_at', { ascending: false });
  res.json(data || []);
});

router.post('/knowledge', auth, async (req, res) => {
  const { name, content, file_type } = req.body;
  if (!name || !content) return res.status(400).json({ error: 'Name and content required' });
  try {
    const { data, error } = await supabase.from('knowledge_documents')
      .insert({ name, content, file_type: file_type || 'text', is_active: true })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });

    // Update combined knowledge base in settings
    await rebuildKnowledgeBase();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/knowledge/:id', auth, async (req, res) => {
  const { data, error } = await supabase.from('knowledge_documents')
    .update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  await rebuildKnowledgeBase();
  res.json(data);
});

router.delete('/knowledge/:id', auth, async (req, res) => {
  await supabase.from('knowledge_documents').delete().eq('id', req.params.id);
  await rebuildKnowledgeBase();
  res.json({ success: true });
});

async function rebuildKnowledgeBase() {
  const { data: docs } = await supabase.from('knowledge_documents')
    .select('name, content').eq('is_active', true);
  const combined = (docs || []).map(d => `=== ${d.name} ===\n${d.content}`).join('\n\n');
  await supabase.from('settings').upsert({
    key: 'ai_knowledge_base', value: { content: combined, updated_at: new Date().toISOString() }
  }, { onConflict: 'key' });
}

// ─── API STATUS ───────────────────────────────────────────────────────────────
router.get('/status', auth, (req, res) => {
  res.json({
    groq: { configured: !!process.env.GROQ_API_KEY, provider: 'Groq (Llama 3.1)', limit: '14400/day' },
    gemini: { configured: !!process.env.GEMINI_API_KEY, provider: 'Google Gemini', limit: '1500/day' },
    active: process.env.GROQ_API_KEY ? 'groq' : process.env.GEMINI_API_KEY ? 'gemini' : 'none'
  });
});

module.exports = router;
