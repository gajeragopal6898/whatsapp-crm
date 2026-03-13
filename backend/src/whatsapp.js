const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');
const supabase = require('./supabase');

let sock = null;
let currentQR = null;
let isConnected = false;

async function initWhatsApp(io) {
  const { state, saveCreds } = await useMultiFileAuthState('/tmp/whatsapp-auth');
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['WhatsApp CRM', 'Chrome', '1.0.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      currentQR = await qrcode.toDataURL(qr);
      isConnected = false;
      io.emit('whatsapp:qr', { qr: currentQR });
      console.log('QR code generated');
    }

    if (connection === 'open') {
      isConnected = true;
      currentQR = null;
      const phone = sock.user?.id?.split(':')[0] || null;
      io.emit('whatsapp:connected', { phone });
      console.log('WhatsApp connected:', phone);

      await supabase.from('settings').upsert({
        key: 'whatsapp_session',
        value: { connected: true, phone, last_connected: new Date().toISOString() }
      }, { onConflict: 'key' });
    }

    if (connection === 'close') {
      isConnected = false;
      io.emit('whatsapp:disconnected', {});
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('WhatsApp disconnected. Reconnecting:', shouldReconnect);
      if (shouldReconnect) {
        setTimeout(() => initWhatsApp(io), 5000);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      if (!msg.message) continue;

      const phone = msg.key.remoteJid?.replace('@s.whatsapp.net', '');
      if (!phone || phone.includes('@g.us')) continue; // skip groups

      const content =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        '[media]';

      const pushName = msg.pushName || phone;

      console.log(`New message from ${phone}: ${content}`);

      // Save message & upsert lead
      await handleIncomingMessage({ phone, content, pushName, io, msg });
    }
  });

  return sock;
}

async function handleIncomingMessage({ phone, content, pushName, io }) {
  try {
    // Get or create lead
    let { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('phone', phone)
      .single();

    const isNewLead = !lead;

    if (isNewLead) {
      // Get default stage
      const { data: stage } = await supabase
        .from('lead_stages')
        .select('id')
        .eq('is_default', true)
        .single();

      const { data: newLead } = await supabase
        .from('leads')
        .insert({
          name: pushName,
          phone,
          first_message: content,
          stage_id: stage?.id,
          last_message: content,
          last_message_at: new Date().toISOString(),
          message_count: 1,
          is_read: false
        })
        .select()
        .single();

      lead = newLead;
      io.emit('lead:new', lead);
    } else {
      await supabase
        .from('leads')
        .update({
          last_message: content,
          last_message_at: new Date().toISOString(),
          message_count: (lead.message_count || 0) + 1,
          is_read: false
        })
        .eq('id', lead.id);

      io.emit('lead:updated', { ...lead, last_message: content });
    }

    // Save message
    await supabase.from('messages').insert({
      lead_id: lead.id,
      phone,
      content,
      direction: 'incoming',
      is_read: false
    });

    io.emit('message:new', { phone, content, direction: 'incoming', lead_id: lead.id });

    // Check auto-reply rules
    await processAutoReply({ phone, content, isNewLead, io });

  } catch (err) {
    console.error('Error handling message:', err);
  }
}

async function processAutoReply({ phone, content, isNewLead, io }) {
  try {
    const { data: rules } = await supabase
      .from('auto_reply_rules')
      .select('*')
      .eq('is_active', true);

    if (!rules?.length) return;

    // Check office hours
    const { data: settingRow } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'office_hours')
      .single();

    const officeHours = settingRow?.value || {};
    let isInOfficeHours = true;

    if (officeHours.enabled) {
      const now = new Date();
      const day = now.getDay();
      const time = now.toTimeString().slice(0, 5);
      const days = officeHours.days || [1, 2, 3, 4, 5];
      isInOfficeHours = days.includes(day) &&
        time >= (officeHours.start || '09:00') &&
        time <= (officeHours.end || '18:00');
    }

    let replyText = null;

    // Welcome message for new leads
    if (isNewLead) {
      const welcomeRule = rules.find(r => r.type === 'welcome');
      if (welcomeRule) replyText = welcomeRule.reply_text;
    }

    // Away message if outside office hours
    if (!isInOfficeHours && !replyText) {
      const awayRule = rules.find(r => r.type === 'away');
      if (awayRule) replyText = awayRule.reply_text;
    }

    // Keyword matching
    if (!replyText) {
      const lower = content.toLowerCase();
      for (const rule of rules.filter(r => r.type === 'keyword')) {
        const keywords = rule.keywords || [];
        if (keywords.some(k => lower.includes(k.toLowerCase()))) {
          replyText = rule.reply_text;

          // Update trigger count
          await supabase
            .from('auto_reply_rules')
            .update({ trigger_count: (rule.trigger_count || 0) + 1 })
            .eq('id', rule.id);
          break;
        }
      }
    }

    if (replyText && sock) {
      await sock.sendMessage(`${phone}@s.whatsapp.net`, { text: replyText });

      // Save outgoing message
      const { data: lead } = await supabase.from('leads').select('id').eq('phone', phone).single();
      if (lead) {
        await supabase.from('messages').insert({
          lead_id: lead.id,
          phone,
          content: replyText,
          direction: 'outgoing',
          is_read: true
        });
        io.emit('message:new', { phone, content: replyText, direction: 'outgoing', lead_id: lead.id });
      }
    }
  } catch (err) {
    console.error('Auto-reply error:', err);
  }
}

async function sendMessage(phone, text) {
  if (!sock || !isConnected) throw new Error('WhatsApp not connected');
  await sock.sendMessage(`${phone}@s.whatsapp.net`, { text });
}

function getStatus() {
  return { isConnected, currentQR };
}

module.exports = { initWhatsApp, sendMessage, getStatus };
