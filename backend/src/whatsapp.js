const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');
const supabase = require('./supabase');
const { generateReply } = require('./ai');

let sock = null;
let currentQR = null;
let isConnected = false;
let reconnectTimer = null;
let keepAliveTimer = null;

// Clean phone number - remove @lid, @s.whatsapp.net etc
function cleanPhone(jid) {
  if (!jid) return null;
  return jid.replace('@s.whatsapp.net', '').replace('@lid', '').replace(/@.*/g, '').trim();
}

// Format phone for sending
function formatJid(phone) {
  const clean = cleanPhone(phone);
  return `${clean}@s.whatsapp.net`;
}

async function initWhatsApp(io) {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('/tmp/whatsapp-auth');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version, auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['WhatsApp CRM', 'Chrome', '1.0.0'],
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      retryRequestDelayMs: 2000,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        try {
          currentQR = await qrcode.toDataURL(qr);
          isConnected = false;
          io.emit('whatsapp:qr', { qr: currentQR });
          console.log('QR code generated');
        } catch (e) { console.error('QR error:', e); }
      }

      if (connection === 'open') {
        isConnected = true;
        currentQR = null;
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

        const phone = cleanPhone(sock.user?.id) || null;
        io.emit('whatsapp:connected', { phone });
        console.log('✅ WhatsApp connected:', phone);

        // Keep-alive ping every 2 minutes to prevent Railway sleep disconnect
        if (keepAliveTimer) clearInterval(keepAliveTimer);
        keepAliveTimer = setInterval(() => {
          if (sock && isConnected) {
            sock.sendPresenceUpdate('available').catch(() => {});
          }
        }, 120000);

        await supabase.from('settings').upsert({
          key: 'whatsapp_session',
          value: { connected: true, phone, last_connected: new Date().toISOString() }
        }, { onConflict: 'key' });
      }

      if (connection === 'close') {
        isConnected = false;
        if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
        io.emit('whatsapp:disconnected', {});

        const code = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;
        console.log('WhatsApp disconnected. Code:', code, 'LoggedOut:', loggedOut);

        if (!loggedOut) {
          const delay = code === 408 ? 3000 : 5000;
          console.log(`Reconnecting in ${delay/1000}s...`);
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => initWhatsApp(io), delay);
        }
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (msg.key.fromMe || !msg.message) continue;
        const rawJid = msg.key.remoteJid || '';
        if (rawJid.includes('@g.us')) continue; // skip groups

        const phone = cleanPhone(rawJid);
        if (!phone) continue;

        const content =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          '[media]';

        const pushName = msg.pushName || phone;
        console.log(`📩 Message from ${phone}: ${content}`);

        await handleIncomingMessage({ phone, content, pushName, io });
      }
    });

    return sock;
  } catch (err) {
    console.error('WhatsApp init error:', err);
    setTimeout(() => initWhatsApp(io), 10000);
  }
}

async function handleIncomingMessage({ phone, content, pushName, io }) {
  try {
    let { data: lead } = await supabase.from('leads').select('*').eq('phone', phone).single();
    const isNewLead = !lead;

    if (isNewLead) {
      const { data: stage } = await supabase.from('lead_stages').select('id').eq('is_default', true).single();
      const { data: newLead } = await supabase.from('leads').insert({
        name: pushName, phone,
        first_message: content,
        stage_id: stage?.id,
        last_message: content,
        last_message_at: new Date().toISOString(),
        message_count: 1,
        is_read: false
      }).select().single();
      lead = newLead;
      io.emit('lead:new', lead);
      console.log('✅ New lead created:', phone);
    } else {
      await supabase.from('leads').update({
        last_message: content,
        last_message_at: new Date().toISOString(),
        message_count: (lead.message_count || 0) + 1,
        is_read: false,
        name: lead.name || pushName
      }).eq('id', lead.id);
      io.emit('lead:updated', { ...lead, last_message: content });
    }

    await supabase.from('messages').insert({
      lead_id: lead.id, phone, content, direction: 'incoming', is_read: false
    });
    io.emit('message:new', { phone, content, direction: 'incoming', lead_id: lead.id });

    // Get AI settings
    const { data: aiRow } = await supabase.from('settings').select('value').eq('key', 'ai_settings').single();
    const aiSettings = aiRow?.value || {};

    if (aiSettings.enabled && aiSettings.mode !== 'off' && content !== '[media]') {
      await handleAIReply({ lead, content, aiSettings, io });
    } else {
      await processRuleReply({ phone, content, isNewLead, io, lead });
    }
  } catch (err) {
    console.error('Message handler error:', err);
  }
}

async function handleAIReply({ lead, content, aiSettings, io }) {
  try {
    // Check escalation keywords
    const lower = content.toLowerCase();
    const escalateWords = aiSettings.escalate_keywords || ['human', 'agent', 'person', 'manager'];
    if (escalateWords.some(w => lower.includes(w.toLowerCase()))) {
      const msg = 'Let me connect you with our team member. Please wait a moment. 🙏';
      await sendWithDelay(lead.phone, msg, 1);
      await saveOutgoing(lead.id, lead.phone, msg, io);
      io.emit('lead:escalated', { lead_id: lead.id, phone: lead.phone, name: lead.name });
      return;
    }

    // Check max replies
    if (aiSettings.max_auto_replies > 0) {
      const { count } = await supabase.from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('lead_id', lead.id).eq('direction', 'outgoing');
      if (count >= aiSettings.max_auto_replies) {
        console.log('Max AI replies reached for', lead.phone);
        return;
      }
    }

    // Check office hours
    const { data: ohRow } = await supabase.from('settings').select('value').eq('key', 'office_hours').single();
    const oh = ohRow?.value || {};
    if (oh.enabled) {
      const now = new Date();
      const day = now.getDay();
      const time = now.toTimeString().slice(0, 5);
      const inHours = (oh.days || [1,2,3,4,5]).includes(day) &&
        time >= (oh.start || '09:00') && time <= (oh.end || '18:00');
      if (!inHours) {
        const { data: rules } = await supabase.from('auto_reply_rules')
          .select('*').eq('type', 'away').eq('is_active', true).limit(1);
        if (rules?.[0]) {
          await sendWithDelay(lead.phone, rules[0].reply_text, 1);
          await saveOutgoing(lead.id, lead.phone, rules[0].reply_text, io);
          return;
        }
      }
    }

    // Get conversation history
    const { data: history } = await supabase.from('messages').select('*')
      .eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(6);

    console.log('🤖 Generating AI reply for', lead.phone);

    const reply = await generateReply({
      customerMessage: content,
      businessContext: aiSettings.business_context || '',
      conversationHistory: (history || []).reverse(),
      customerName: lead.name || ''
    });

    console.log('✅ AI reply generated:', reply.slice(0, 50));

    if (aiSettings.mode === 'full') {
      await sendWithDelay(lead.phone, reply, aiSettings.reply_delay || 3);
      await saveOutgoing(lead.id, lead.phone, reply, io);
    } else {
      // Semi-auto — suggest to agent
      io.emit('ai:reply_suggestion', {
        lead_id: lead.id, phone: lead.phone,
        name: lead.name, suggested_reply: reply,
        customer_message: content
      });
    }
  } catch (err) {
    console.error('AI reply error:', err.message);
    // Fallback to rule-based
    await processRuleReply({ phone: lead.phone, content, isNewLead: false, io, lead });
  }
}

async function processRuleReply({ phone, content, isNewLead, io, lead }) {
  try {
    const { data: rules } = await supabase.from('auto_reply_rules').select('*').eq('is_active', true);
    if (!rules?.length) return;

    let replyText = null;
    if (isNewLead) {
      const r = rules.find(r => r.type === 'welcome');
      if (r) replyText = r.reply_text;
    }
    if (!replyText) {
      const lower = content.toLowerCase();
      for (const rule of rules.filter(r => r.type === 'keyword')) {
        if ((rule.keywords || []).some(k => lower.includes(k.toLowerCase()))) {
          replyText = rule.reply_text;
          await supabase.from('auto_reply_rules')
            .update({ trigger_count: (rule.trigger_count || 0) + 1 }).eq('id', rule.id);
          break;
        }
      }
    }

    if (replyText) {
      await sendMsg(phone, replyText);
      await saveOutgoing(lead.id, phone, replyText, io);
    }
  } catch (err) { console.error('Rule reply error:', err); }
}

async function sendWithDelay(phone, text, delaySecs = 3) {
  if (delaySecs > 0) await new Promise(r => setTimeout(r, delaySecs * 1000));
  await sendMsg(phone, text);
}

async function sendMsg(phone, text) {
  if (!sock || !isConnected) throw new Error('WhatsApp not connected');
  const jid = formatJid(phone);
  await sock.sendMessage(jid, { text });
  console.log('✅ Sent to', jid, ':', text.slice(0, 30));
}

async function saveOutgoing(leadId, phone, content, io) {
  await supabase.from('messages').insert({
    lead_id: leadId, phone, content, direction: 'outgoing', is_read: true
  });
  await supabase.from('leads').update({
    last_message: content, last_message_at: new Date().toISOString()
  }).eq('id', leadId);
  io.emit('message:new', { phone, content, direction: 'outgoing', lead_id: leadId });
}

async function sendMessage(phone, text) {
  await sendMsg(phone, text);
}

function getStatus() { return { isConnected, currentQR }; }

module.exports = { initWhatsApp, sendMessage, getStatus };
