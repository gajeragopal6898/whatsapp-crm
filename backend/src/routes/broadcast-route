const router = require('express').Router();
const auth = require('../middleware/auth');
const supabase = require('../supabase');
const { sendMessage } = require('../whatsapp');
const { callAI } = require('../ai');

// ─── GET ALL BROADCASTS ───────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  const { data } = await supabase
    .from('broadcasts')
    .select('*')
    .order('created_at', { ascending: false });
  res.json(data || []);
});

// ─── FILTER LEADS FOR BROADCAST ───────────────────────────────────────────────
router.post('/filter', auth, async (req, res) => {
  const { filter_type, filter_data } = req.body;
  try {
    let leads = [];

    if (filter_type === 'product') {
      // Filter by product recommended in AI memory
      const { data: memories } = await supabase
        .from('customer_memory')
        .select('phone, lead_id, products_recommended, health_concerns')
        .contains('products_recommended', [filter_data.product]);

      if (memories?.length) {
        const phones = memories.map(m => m.phone);
        const { data } = await supabase.from('leads').select('id, name, phone, stage:lead_stages(name)')
          .in('phone', phones);
        leads = (data || []).map(l => ({
          ...l,
          match_reason: `Asked about ${filter_data.product}`
        }));
      }

    } else if (filter_type === 'date_range') {
      const { data } = await supabase.from('leads')
        .select('id, name, phone, created_at, stage:lead_stages(name)')
        .gte('created_at', filter_data.from)
        .lte('created_at', filter_data.to + 'T23:59:59Z')
        .order('created_at', { ascending: false });
      leads = (data || []).map(l => ({
        ...l,
        match_reason: `Lead from ${new Date(l.created_at).toLocaleDateString('en-IN')}`
      }));

    } else if (filter_type === 'stage') {
      const { data: stages } = await supabase.from('lead_stages')
        .select('id').eq('name', filter_data.stage);
      if (stages?.[0]) {
        const { data } = await supabase.from('leads')
          .select('id, name, phone, stage:lead_stages(name)')
          .eq('stage_id', stages[0].id);
        leads = (data || []).map(l => ({
          ...l,
          match_reason: `Stage: ${filter_data.stage}`
        }));
      }

    } else if (filter_type === 'no_reply') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (filter_data.days || 3));
      const { data } = await supabase.from('leads')
        .select('id, name, phone, last_message_at, stage:lead_stages(name)')
        .lte('last_message_at', cutoff.toISOString())
        .not('phone', 'like', '%@%');
      leads = (data || []).map(l => ({
        ...l,
        match_reason: `No reply for ${filter_data.days || 3}+ days`
      }));

    } else if (filter_type === 'ai_tag') {
      // Filter by AI memory summary tags
      const { data: memories } = await supabase
        .from('customer_memory')
        .select('phone, lead_id, conversation_summary, order_history');

      const tag = filter_data.tag?.toLowerCase();
      const matched = (memories || []).filter(m => {
        const summary = (m.conversation_summary || '').toLowerCase();
        const orders = (m.order_history || []).join(' ').toLowerCase();
        if (tag === 'interested') return orders.includes('interested') || summary.includes('interest');
        if (tag === 'not_interested') return summary.includes('not interested') || summary.includes('no interest');
        if (tag === 'ordered') return orders.length > 0;
        return summary.includes(tag);
      });

      if (matched.length) {
        const phones = matched.map(m => m.phone);
        const { data } = await supabase.from('leads').select('id, name, phone, stage:lead_stages(name)')
          .in('phone', phones);
        leads = (data || []).map(l => ({
          ...l,
          match_reason: `AI tag: ${filter_data.tag}`
        }));
      }

    } else if (filter_type === 'manual') {
      // Return all leads for manual selection
      const { data } = await supabase.from('leads')
        .select('id, name, phone, last_message_at, stage:lead_stages(name)')
        .not('phone', 'like', '%@%')
        .order('last_message_at', { ascending: false })
        .limit(200);
      leads = (data || []).map(l => ({ ...l, match_reason: 'Manual selection' }));
    }

    // Filter out invalid phones
    leads = leads.filter(l => l.phone && !l.phone.includes('@') && !l.phone.includes('broadcast'));
    res.json({ leads, total: leads.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AI GENERATE FOLLOW-UP MESSAGE ───────────────────────────────────────────
router.post('/ai-message', auth, async (req, res) => {
  const { context, tone, product } = req.body;
  try {
    const prompt = `Write a short WhatsApp follow-up message for Dhwakat Herbal customers.

Context: ${context || 'General follow-up'}
Tone: ${tone || 'Friendly and helpful'}
${product ? `Product: ${product}` : ''}

Rules:
- Write in Gujarati (primary) 
- Max 3 sentences
- Warm and helpful tone
- Do NOT mention price
- Do NOT say you are AI
- End with: Order karva mate WhatsApp karo: 9023935773

Write 3 different message options (label them 1, 2, 3):`;

    const reply = await callAI(prompt);
    res.json({ suggestions: reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CREATE BROADCAST ─────────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  const { name, message, filter_type, filter_data, recipients, scheduled_at } = req.body;
  try {
    const { data, error } = await supabase.from('broadcasts').insert({
      name, message, filter_type, filter_data,
      recipients: JSON.stringify(recipients || []),
      total_count: (recipients || []).length,
      status: scheduled_at ? 'scheduled' : 'draft',
      scheduled_at: scheduled_at || null,
      created_by: req.user.id
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SEND BROADCAST ───────────────────────────────────────────────────────────
router.post('/:id/send', auth, async (req, res) => {
  const { id } = req.params;
  try {
    const { data: broadcast } = await supabase.from('broadcasts').select('*').eq('id', id).single();
    if (!broadcast) return res.status(404).json({ error: 'Not found' });

    const recipients = typeof broadcast.recipients === 'string'
      ? JSON.parse(broadcast.recipients) : broadcast.recipients || [];

    await supabase.from('broadcasts').update({ status: 'sending' }).eq('id', id);

    let sent = 0, failed = 0;
    const io = req.app.get('io');

    for (const recipient of recipients) {
      try {
        await sendMessage(recipient.phone, broadcast.message);
        sent++;

        // Save to messages & leads
        const { data: lead } = await supabase.from('leads').select('id').eq('phone', recipient.phone).single();
        if (lead) {
          await supabase.from('messages').insert({
            lead_id: lead.id, phone: recipient.phone,
            content: broadcast.message, direction: 'outgoing', is_read: true
          });
          await supabase.from('leads').update({
            last_message: broadcast.message,
            last_message_at: new Date().toISOString()
          }).eq('id', lead.id);
        }

        // Small delay between messages to avoid WhatsApp ban
        await new Promise(r => setTimeout(r, 1500));

        // Emit progress
        io.emit('broadcast:progress', { id, sent, failed, total: recipients.length });

      } catch (e) {
        failed++;
        console.error(`Failed to send to ${recipient.phone}:`, e.message);
      }
    }

    await supabase.from('broadcasts').update({
      status: 'sent', sent_count: sent,
      failed_count: failed, sent_at: new Date().toISOString()
    }).eq('id', id);

    res.json({ success: true, sent, failed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET FOLLOWUP RULES ───────────────────────────────────────────────────────
router.get('/followup-rules', auth, async (req, res) => {
  const { data } = await supabase.from('followup_rules').select('*').order('created_at');
  res.json(data || []);
});

router.post('/followup-rules', auth, async (req, res) => {
  const { data, error } = await supabase.from('followup_rules').insert(req.body).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.patch('/followup-rules/:id', auth, async (req, res) => {
  const { data, error } = await supabase.from('followup_rules').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/followup-rules/:id', auth, async (req, res) => {
  await supabase.from('followup_rules').delete().eq('id', req.params.id);
  res.json({ success: true });
});

module.exports = router;
