const router = require('express').Router();
const supabase = require('../supabase');
const auth = require('../middleware/auth');
const { generateReply, summarizeConversation, getCustomerMemory, callAI } = require('../ai');

router.get('/settings', auth, async (req, res) => {
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', 'ai_settings').single();
    res.json(data?.value || {});
  } catch { res.json({}); }
});

router.post('/settings', auth, async (req, res) => {
  try {
    const { error } = await supabase.from('settings').upsert(
      { key: 'ai_settings', value: req.body },
      { onConflict: 'key' }
    );
    if (error) {
      console.error('AI settings save error:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json({ success: true });
  } catch (e) {
    console.error('AI settings exception:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post('/preview', auth, async (req, res) => {
  try {
    const { message } = req.body;
    const { data: settings } = await supabase.from('settings').select('value').eq('key', 'ai_settings').single();
    const reply = await generateReply({
      customerMessage: message || 'Hello',
      businessContext: settings?.value?.business_context || '',
      conversationHistory: [],
      customerName: 'Test Customer',
    });
    res.json({ reply });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/summarize/:leadId', auth, async (req, res) => {
  try {
    const { data: messages } = await supabase.from('messages').select('*')
      .eq('lead_id', req.params.leadId).order('created_at').limit(50);
    const summary = await summarizeConversation(messages || []);
    res.json({ summary });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/memory/:phone', auth, async (req, res) => {
  try {
    const memory = await getCustomerMemory(req.params.phone);
    res.json(memory || {});
  } catch { res.json({}); }
});

router.patch('/memory/:phone', auth, async (req, res) => {
  try {
    await supabase.from('customer_memory').update(req.body).eq('phone', req.params.phone);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/knowledge', auth, async (req, res) => {
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', 'knowledge_documents').single();
    res.json(data?.value?.docs || []);
  } catch { res.json([]); }
});

router.post('/knowledge', auth, async (req, res) => {
  try {
    const { data: existing } = await supabase.from('settings').select('value').eq('key', 'knowledge_documents').single().catch(() => ({ data: null }));
    const docs = existing?.value?.docs || [];
    const newDoc = { ...req.body, id: Date.now().toString(), created_at: new Date().toISOString(), is_active: true };
    docs.push(newDoc);
    await supabase.from('settings').upsert({ key: 'knowledge_documents', value: { docs } }, { onConflict: 'key' });
    res.json(newDoc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/knowledge/:id', auth, async (req, res) => {
  try {
    const { data: existing } = await supabase.from('settings').select('value').eq('key', 'knowledge_documents').single();
    const docs = (existing?.value?.docs || []).map(d => d.id === req.params.id ? { ...d, ...req.body } : d);
    await supabase.from('settings').upsert({ key: 'knowledge_documents', value: { docs } }, { onConflict: 'key' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/status', auth, async (req, res) => {
  res.json({
    groq: !!process.env.GROQ_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    model: 'llama-3.3-70b-versatile'
  });
});

module.exports = router;
