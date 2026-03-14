const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino     = require('pino');
const qrcode   = require('qrcode');
const https    = require('https');
const supabase = require('./supabase');
const { generateReply, isAIPaused } = require('./ai');

let sock        = null;
let currentQR   = null;
let isConnected = false;

// ── All 29 product names (must match product_media.product_name exactly) ──────
const ALL_PRODUCTS = [
  'Manoveda','ShayanVeda','Shiroveda','Manomukta',
  'Smritiveda','Immuno Plus','Shwasveda','Allergy-GO',
  'Hridayaveda','RaktaSneha','GlucoVeda',
  'MedoharMukta','Poshakveda',
  'Agnimukta','Rechaka Veda','Yakritshuddhi','Raktaveda','GudaShanti',
  'Sandhiveda',
  'RomaVardhak','AcnoVeda','NikharVeda',
  'Feminoveda','Ritushanti','Lohaveda','Vajraveda',
  'Satvik Multivita','GO_Lith',
  'Ashwagandha','Shilajit Cap','Amla','Brahmi','Neem','Musli',
  'Isabgool','Harad','Moringa','Triphala',
];

// ── Detect which product(s) are mentioned in a reply text ────────────────────
function detectProductsInReply(replyText) {
  if (!replyText) return [];
  return ALL_PRODUCTS.filter(p =>
    replyText.toLowerCase().includes(p.toLowerCase())
  );
}

// ── Fetch media URLs for a product ───────────────────────────────────────────
async function getProductMedia(productName) {
  try {
    const { data } = await supabase
      .from('product_media')
      .select('image_url, video_url')
      .eq('product_name', productName)
      .single();
    return data || null;
  } catch { return null; }
}

// ── Download a URL into a Buffer ─────────────────────────────────────────────
function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : require('http');
    mod.get(url, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ── Send media (image then video) for a product to a JID ────────────────────
async function sendProductMedia(jid, productName) {
  try {
    const media = await getProductMedia(productName);
    if (!media) return;

    // Send image
    if (media.image_url) {
      try {
        const imgBuffer = await downloadBuffer(media.image_url);
        const ext = media.image_url.split('.').pop().split('?')[0].toLowerCase();
        const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
        await sock.sendMessage(jid, {
          image: imgBuffer,
          mimetype: mime,
          caption: `📸 ${productName}`,
        });
        console.log(`✅ Sent image for ${productName}`);
        // Small delay between image and video
        await new Promise(r => setTimeout(r, 1500));
      } catch (imgErr) {
        console.error(`Image send error for ${productName}:`, imgErr.message);
      }
    }

    // Send video
    if (media.video_url) {
      try {
        const vidBuffer = await downloadBuffer(media.video_url);
        await sock.sendMessage(jid, {
          video: vidBuffer,
          mimetype: 'video/mp4',
          caption: `🎥 ${productName} — Product Video`,
        });
        console.log(`✅ Sent video for ${productName}`);
      } catch (vidErr) {
        console.error(`Video send error for ${productName}:`, vidErr.message);
      }
    }
  } catch (err) {
    console.error(`sendProductMedia error for ${productName}:`, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
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
      currentQR   = await qrcode.toDataURL(qr);
      isConnected = false;
      io.emit('whatsapp:qr', { qr: currentQR });
      console.log('QR code generated');
    }

    if (connection === 'open') {
      isConnected = true;
      currentQR   = null;
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
      if (shouldReconnect) setTimeout(() => initWhatsApp(io), 5000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      if (!msg.message)   continue;

      const jid   = msg.key.remoteJid;
      const phone = jid?.replace('@s.whatsapp.net', '');
      if (!phone || phone.includes('@g.us')) continue;

      const content =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        '[media]';

      const pushName = msg.pushName || phone;
      console.log(`New message from ${phone}: ${content}`);

      await handleIncomingMessage({ phone, jid, content, pushName, io, msg });
    }
  });

  return sock;
}

// ─────────────────────────────────────────────────────────────────────────────
async function handleIncomingMessage({ phone, jid, content, pushName, io }) {
  try {
    // Get or create lead
    let { data: lead } = await supabase
      .from('leads').select('*').eq('phone', phone).single();

    const isNewLead = !lead;

    if (isNewLead) {
      const { data: stage } = await supabase
        .from('lead_stages').select('id').eq('is_default', true).single();

      const { data: newLead } = await supabase
        .from('leads')
        .insert({
          name: pushName, phone,
          first_message: content,
          stage_id: stage?.id,
          last_message: content,
          last_message_at: new Date().toISOString(),
          message_count: 1,
          is_read: false,
        })
        .select().single();

      lead = newLead;
      io.emit('lead:new', lead);
    } else {
      await supabase.from('leads').update({
        last_message: content,
        last_message_at: new Date().toISOString(),
        message_count: (lead.message_count || 0) + 1,
        is_read: false,
      }).eq('id', lead.id);
      io.emit('lead:updated', { ...lead, last_message: content });
    }

    // Save inbound message
    await supabase.from('messages').insert({
      lead_id: lead.id, phone, content,
      direction: 'inbound', is_read: false,
    });
    io.emit('message:new', { phone, content, direction: 'inbound', lead_id: lead.id });

    // ── AI Auto-Reply ─────────────────────────────────────────────────────────
    await processAIReply({ phone, jid, content, lead, isNewLead, io });

  } catch (err) {
    console.error('Error handling message:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
async function processAIReply({ phone, jid, content, lead, isNewLead, io }) {
  try {
    // Check AI paused for this lead
    if (lead?.ai_paused) {
      console.log(`AI paused for ${phone}`);
      return;
    }

    // Load AI settings
    const { data: aiSettingRow } = await supabase
      .from('settings').select('value').eq('key', 'ai_settings').single();
    const aiSettings = aiSettingRow?.value || {};

    if (!aiSettings.enabled) return;

    // Load recent conversation history (last 10 messages)
    const { data: history } = await supabase
      .from('messages')
      .select('content, direction, created_at')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const conversationHistory = (history || []).reverse().map(m => ({
      content: m.content,
      direction: m.direction === 'inbound' ? 'incoming' : 'outgoing',
    }));

    // Generate AI reply
    const replyText = await generateReply({
      customerMessage: content,
      businessContext: aiSettings.businessContext || '',
      conversationHistory,
      customerName: lead?.name || '',
      phone,
      leadId: lead?.id || '',
    });

    if (!replyText) return;

    // Send text reply
    await sock.sendMessage(jid, { text: replyText });

    // Save outbound message
    await supabase.from('messages').insert({
      lead_id: lead.id, phone,
      content: replyText,
      direction: 'outbound',
      is_read: true,
    });
    io.emit('message:new', { phone, content: replyText, direction: 'outbound', lead_id: lead.id });

    console.log(`AI replied to ${phone}: ${replyText.substring(0, 60)}...`);

    // ── AUTO-SEND PRODUCT MEDIA ───────────────────────────────────────────────
    // Detect which products were mentioned in the AI reply
    const mentionedProducts = detectProductsInReply(replyText);
    if (mentionedProducts.length > 0 && sock) {
      console.log(`Sending media for products: ${mentionedProducts.join(', ')}`);
      // Small delay so text arrives first
      await new Promise(r => setTimeout(r, 2000));
      // Send media for each mentioned product (max 2 to avoid spam)
      for (const product of mentionedProducts.slice(0, 2)) {
        await sendProductMedia(jid, product);
      }
    }

  } catch (err) {
    if (err.message === 'AI_PAUSED') {
      console.log(`AI paused for ${phone}`);
    } else {
      console.error('AI reply error:', err.message);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
async function sendMessage(phone, text) {
  if (!sock || !isConnected) throw new Error('WhatsApp not connected');
  const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
}

// Send media manually (from CRM chat panel — future use)
async function sendMediaToPhone(phone, productName) {
  if (!sock || !isConnected) throw new Error('WhatsApp not connected');
  const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
  await sendProductMedia(jid, productName);
}

function getStatus() {
  return { isConnected, currentQR };
}

module.exports = { initWhatsApp, sendMessage, sendMediaToPhone, getStatus };
