// src/routes/ai.js
const router   = require('express').Router();
const auth     = require('../middleware/auth');
const supabase = require('../supabase');
const { generateReply, summarizeConversation, getCustomerMemory } = require('../ai');

// ── GET /api/ai/status — check which API keys are configured ─────────────────
router.get('/status', auth, async (req, res) => {
  res.json({
    groq:   { configured: !!process.env.GROQ_API_KEY },
    gemini: { configured: !!process.env.GEMINI_API_KEY },
  });
});

// ── POST /api/ai/test — test AI reply ────────────────────────────────────────
router.post('/test', auth, async (req, res) => {
  try {
    const { message, businessContext } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    const reply = await generateReply({
      customerMessage: message,
      businessContext: businessContext || '',
      conversationHistory: [],
      customerName: 'Test User',
      phone: '',
      leadId: '',
    });

    // Detect which provider was used (simple heuristic)
    const provider = process.env.GROQ_API_KEY ? 'groq' : 'gemini';

    // Detect language
    const lang = /[\u0A80-\u0AFF]/.test(message) ? 'gujarati'
               : /[\u0900-\u097F]/.test(message) ? 'hindi'
               : 'english';

    res.json({ success: true, reply, provider, language: lang });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/ai/knowledge — list knowledge documents ─────────────────────────
router.get('/knowledge', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('knowledge_documents')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai/knowledge — add a knowledge document ────────────────────────
router.post('/knowledge', auth, async (req, res) => {
  try {
    const { name, content, file_type } = req.body;
    if (!name || !content) return res.status(400).json({ error: 'name and content required' });
    const { data, error } = await supabase
      .from('knowledge_documents')
      .insert({ name, content, file_type: file_type || 'text', is_active: true })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/ai/knowledge/:id — toggle active ───────────────────────────────
router.patch('/knowledge/:id', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('knowledge_documents')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/ai/knowledge/:id ─────────────────────────────────────────────
router.delete('/knowledge/:id', auth, async (req, res) => {
  try {
    await supabase.from('knowledge_documents').delete().eq('id', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/ai/memory/:phone — get customer memory ──────────────────────────
router.get('/memory/:phone', auth, async (req, res) => {
  try {
    const memory = await getCustomerMemory(req.params.phone);
    res.json(memory || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai/summarize — summarize conversation ──────────────────────────
router.post('/summarize', auth, async (req, res) => {
  try {
    const { leadId } = req.body;
    if (!leadId) return res.status(400).json({ error: 'leadId required' });
    const { data: messages } = await supabase
      .from('messages')
      .select('content, direction')
      .eq('lead_id', leadId)
      .order('created_at')
      .limit(50);
    if (!messages?.length) return res.json({ summary: 'No messages yet.' });
    const summary = await summarizeConversation(messages);
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
