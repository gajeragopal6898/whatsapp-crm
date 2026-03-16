const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const supabase = require('./supabase');
const { generateReply } = require('./ai');
const { processFlow, shouldUseFlow } = require('./flow');

// Dedup cache — prevent processing same message twice
const recentMessages = new Map();
function isDuplicate(phone, content) {
  const key = `${phone}:${content.slice(0, 50)}`;
  const now = Date.now();
  if (recentMessages.has(key) && now - recentMessages.get(key) < 5000) return true;
  recentMessages.set(key, now);
  // Cleanup old entries
  if (recentMessages.size > 200) {
    const cutoff = now - 10000;
    for (const [k, t] of recentMessages) if (t < cutoff) recentMessages.delete(k);
  }
  return false;
}

let sock = null;
let currentQR = null;
let isConnected = false;
let reconnectTimer = null;
let keepAliveTimer = null;

// JID map: phone -> real JID for reliable sending
const jidMap = {};

// Auth directory - use /tmp for Railway
const AUTH_DIR = '/tmp/wa-auth';

function ensureAuthDir() {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// Save auth state to Supabase so it survives Railway restarts
async function saveAuthToSupabase() {
  try {
    if (!fs.existsSync(AUTH_DIR)) return;
    const files = fs.readdirSync(AUTH_DIR);
    const authData = {};
    for (const file of files) {
      const content = fs.readFileSync(path.join(AUTH_DIR, file), 'utf8');
      authData[file] = content;
    }
    await supabase.from('settings').upsert({
      key: 'wa_auth_backup',
      value: { data: authData, saved_at: new Date().toISOString() }
    }, { onConflict: 'key' });
  } catch (e) { console.log('Auth backup error:', e.message); }
}

// Restore auth from Supabase on startup
async function restoreAuthFromSupabase() {
  try {
    ensureAuthDir();
    const { data } = await supabase.from('settings').select('value').eq('key', 'wa_auth_backup').single();
    if (!data?.value?.data) return false;
    const authData = data.value.data;
    for (const [filename, content] of Object.entries(authData)) {
      fs.writeFileSync(path.join(AUTH_DIR, filename), content, 'utf8');
    }
    console.log('✅ WhatsApp auth restored from Supabase');
    return true;
  } catch (e) {
    console.log('No auth backup found, need fresh QR scan');
    return false;
  }
}

function extractPhone(jid) {
  if (!jid) return null;
  return jid.split('@')[0];
}

function getSendJid(phone) {
  const clean = phone.split('@')[0];
  if (jidMap[clean]) return jidMap[clean];
  return `${clean}@s.whatsapp.net`;
}

async function initWhatsApp(io) {
  try {
    ensureAuthDir();
    await restoreAuthFromSupabase();

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    console.log('Starting WhatsApp with version:', version);

    sock = makeWASocket({
      version, auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['WhatsApp CRM', 'Chrome', '1.0.0'],
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 20000,
      retryRequestDelayMs: 2000,
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
    });

    sock.ev.on('creds.update', async () => {
      await saveCreds();
      await saveAuthToSupabase(); // backup to Supabase on every creds update
    });

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        try {
          currentQR = await qrcode.toDataURL(qr);
          isConnected = false;
          io.emit('whatsapp:qr', { qr: currentQR });
          console.log('📱 QR code ready - scan with WhatsApp');
        } catch (e) { console.error('QR error:', e); }
      }

      if (connection === 'open') {
        isConnected = true;
        currentQR = null;
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

        const phone = extractPhone(sock.user?.id) || null;
        io.emit('whatsapp:connected', { phone });
        console.log('✅ WhatsApp connected! Phone:', phone);

        // Save auth immediately on connect
        await saveAuthToSupabase();

        // Keep-alive every 60 seconds
        if (keepAliveTimer) clearInterval(keepAliveTimer);
        keepAliveTimer = setInterval(async () => {
          if (sock && isConnected) {
            try {
              await sock.sendPresenceUpdate('available');
            } catch (e) { /* silent */ }
          }
        }, 60000);

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
        console.log('⚠️ WhatsApp disconnected. Code:', code, '| LoggedOut:', loggedOut);

        if (loggedOut) {
          // Clear saved auth on logout
          try {
            await supabase.from('settings').delete().eq('key', 'wa_auth_backup');
            if (fs.existsSync(AUTH_DIR)) fs.rmSync(AUTH_DIR, { recursive: true });
          } catch (e) {}
          console.log('🚪 Logged out - need fresh QR scan');
        } else {
          const delay = [401, 403].includes(code) ? 10000 : 5000;
          console.log(`🔄 Reconnecting in ${delay/1000}s...`);
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
        if (rawJid.includes('@g.us') || rawJid.includes('@broadcast')) continue;

        const phone = extractPhone(rawJid);
        if (!phone) continue;

        // CRITICAL: Store real JID for replies
        jidMap[phone] = rawJid;

        const content =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          msg.message?.videoMessage?.caption ||
          '[media]';

        const pushName = msg.pushName || phone;
        console.log(`📩 ${phone}: ${content}`);

        await handleIncomingMessage({ phone, content, pushName, io });
      }
    });

    return sock;
  } catch (err) {
    console.error('❌ WhatsApp init error:', err.message);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => initWhatsApp(io), 10000);
  }
}

async function handleIncomingMessage({ phone, content, pushName, io }) {
  try {
    // Skip duplicate messages (Baileys sometimes fires twice)
    if (isDuplicate(phone, content)) {
      console.log(`⚠️ Duplicate message skipped: ${phone}`);
      return;
    }
    let { data: lead } = await supabase.from('leads').select('*').eq('phone', phone).single();
    const isNewLead = !lead;

    if (isNewLead) {
      const { data: stage } = await supabase.from('lead_stages').select('id').eq('is_default', true).single();
      const { data: newLead } = await supabase.from('leads').insert({
        name: pushName, phone, first_message: content,
        stage_id: stage?.id, last_message: content,
        last_message_at: new Date().toISOString(), message_count: 1, is_read: false
      }).select().single();
      lead = newLead;
      io.emit('lead:new', lead);
    } else {
      await supabase.from('leads').update({
        last_message: content, last_message_at: new Date().toISOString(),
        message_count: (lead.message_count || 0) + 1, is_read: false,
        name: lead.name || pushName
      }).eq('id', lead.id);
      io.emit('lead:updated', { ...lead, last_message: content });
    }

    await supabase.from('messages').insert({ lead_id: lead.id, phone, content, direction: 'incoming', is_read: false });
    io.emit('message:new', { phone, content, direction: 'incoming', lead_id: lead.id });

    const { data: aiRow } = await supabase.from('settings').select('value').eq('key', 'ai_settings').single();
    const aiSettings = aiRow?.value || {};

    if (!aiSettings.enabled || aiSettings.mode === 'off' || content === '[media]') {
      await processRuleReply({ phone, content, isNewLead, io, lead });
      return;
    }

    // Try conversation flow first
    const useFlow = await shouldUseFlow(phone);
    if (useFlow) {
      const handled = await processFlow({ phone, content, lead, io, sendMessage: sendMsg, saveOutgoing });
      if (handled) return;
    }

    // AI handles free conversation
    await handleAIReply({ lead, phone, content, aiSettings, io });

  } catch (err) { console.error('Message handler error:', err.message); }
}

async function handleAIReply({ lead, phone, content, aiSettings, io }) {
  try {
    const lower = content.toLowerCase();
    const escalateWords = aiSettings.escalate_keywords || ['human', 'agent', 'person', 'manager'];
    if (escalateWords.some(w => lower.includes(w.toLowerCase()))) {
      const msg = 'Let me connect you with our team member. Please wait. 🙏';
      await sendWithDelay(phone, msg, 1);
      await saveOutgoing(lead.id, phone, msg, io);
      io.emit('lead:escalated', { lead_id: lead.id, phone, name: lead.name });
      return;
    }

    if (aiSettings.max_auto_replies > 0) {
      const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true })
        .eq('lead_id', lead.id).eq('direction', 'outgoing');
      if (count >= aiSettings.max_auto_replies) return;
    }

    const { data: ohRow } = await supabase.from('settings').select('value').eq('key', 'office_hours').single();
    const oh = ohRow?.value || {};
    if (oh.enabled) {
      const now = new Date(); const day = now.getDay(); const time = now.toTimeString().slice(0, 5);
      const inHours = (oh.days || [1,2,3,4,5]).includes(day) && time >= (oh.start || '09:00') && time <= (oh.end || '18:00');
      if (!inHours) {
        const { data: rules } = await supabase.from('auto_reply_rules').select('*').eq('type', 'away').eq('is_active', true).limit(1);
        if (rules?.[0]) { await sendWithDelay(phone, rules[0].reply_text, 1); await saveOutgoing(lead.id, phone, rules[0].reply_text, io); return; }
      }
    }

    const { data: history } = await supabase.from('messages').select('*')
      .eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(6);

    console.log('🤖 Generating AI reply...');
    const reply = await generateReply({
      customerMessage: content,
      businessContext: aiSettings.business_context || '',
      conversationHistory: (history || []).reverse(),
      customerName: lead.name || '',
      phone: phone,
      leadId: lead.id
    });
    console.log('✅ AI reply ready:', reply.slice(0, 50));

    if (aiSettings.mode === 'full') {
      await sendWithDelay(phone, reply, aiSettings.reply_delay || 3);
      await saveOutgoing(lead.id, phone, reply, io);
    } else {
      io.emit('ai:reply_suggestion', { lead_id: lead.id, phone, name: lead.name, suggested_reply: reply, customer_message: content });
    }
  } catch (err) {
    if (err.message === 'AI_PAUSED') { console.log('AI paused for ' + phone); return; }
    console.error('AI reply error:', err.message);
    await processRuleReply({ phone, content, isNewLead: false, io, lead });
  }
}

async function processRuleReply({ phone, content, isNewLead, io, lead }) {
  try {
    const { data: rules } = await supabase.from('auto_reply_rules').select('*').eq('is_active', true);
    if (!rules?.length) return;
    let replyText = null;
    if (isNewLead) { const r = rules.find(r => r.type === 'welcome'); if (r) replyText = r.reply_text; }
    if (!replyText) {
      const lower = content.toLowerCase();
      for (const rule of rules.filter(r => r.type === 'keyword')) {
        if ((rule.keywords || []).some(k => lower.includes(k.toLowerCase()))) {
          replyText = rule.reply_text;
          await supabase.from('auto_reply_rules').update({ trigger_count: (rule.trigger_count || 0) + 1 }).eq('id', rule.id);
          break;
        }
      }
    }
    if (replyText) { await sendMsg(phone, replyText); await saveOutgoing(lead.id, phone, replyText, io); }
  } catch (err) { console.error('Rule reply error:', err); }
}

async function sendWithDelay(phone, text, delaySecs = 3) {
  if (delaySecs > 0) await new Promise(r => setTimeout(r, delaySecs * 1000));
  await sendMsg(phone, text);
}

async function sendMsg(phone, text) {
  if (!sock || !isConnected) throw new Error('WhatsApp not connected');
  const jid = getSendJid(phone);
  console.log(`📤 Sending to ${jid}`);
  await sock.sendMessage(jid, { text });
}

async function saveOutgoing(leadId, phone, content, io) {
  await supabase.from('messages').insert({ lead_id: leadId, phone, content, direction: 'outgoing', is_read: true });
  await supabase.from('leads').update({ last_message: content, last_message_at: new Date().toISOString() }).eq('id', leadId);
  io.emit('message:new', { phone, content, direction: 'outgoing', lead_id: leadId });
}

async function sendMessage(phone, text) { await sendMsg(phone, text); }
function getStatus() { return { isConnected, currentQR }; }
module.exports = { initWhatsApp, sendMessage, getStatus };
