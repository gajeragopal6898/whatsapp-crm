const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const supabase = require('../config/supabase');

let client = null;
let qrCodeData = null;
let isConnected = false;
let io = null;

const initWhatsApp = (socketIo) => {
  io = socketIo;

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: './whatsapp-session' }),
    puppeteer: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ],
      headless: true
    }
  });

  client.on('qr', async (qr) => {
    console.log('QR Code received');
    qrCodeData = await qrcode.toDataURL(qr);
    isConnected = false;
    if (io) io.emit('whatsapp:qr', { qr: qrCodeData });
    await updateSessionStatus(false, null);
  });

  client.on('ready', async () => {
    console.log('WhatsApp connected!');
    isConnected = true;
    qrCodeData = null;
    const info = client.info;
    if (io) io.emit('whatsapp:ready', { phone: info.wid.user });
    await updateSessionStatus(true, info.wid.user);
  });

  client.on('disconnected', async () => {
    console.log('WhatsApp disconnected');
    isConnected = false;
    if (io) io.emit('whatsapp:disconnected');
    await updateSessionStatus(false, null);
  });

  client.on('message', async (msg) => {
    if (msg.fromMe) return;
    if (msg.from === 'status@broadcast') return;

    const phone = msg.from.replace('@c.us', '');
    const content = msg.body;

    console.log(`New message from ${phone}: ${content}`);

    try {
      await handleIncomingMessage(phone, content, msg);
    } catch (err) {
      console.error('Error handling message:', err);
    }
  });

  client.initialize();
};

const handleIncomingMessage = async (phone, content, msg) => {
  // Save message to DB
  const { data: existingLead } = await supabase
    .from('leads')
    .select('*')
    .eq('phone', phone)
    .single();

  let lead = existingLead;
  const isNewLead = !existingLead;

  if (isNewLead) {
    // Get default stage
    const { data: defaultStage } = await supabase
      .from('lead_stages')
      .select('id')
      .eq('is_default', true)
      .single();

    // Create new lead
    const { data: newLead } = await supabase
      .from('leads')
      .insert({
        phone,
        name: msg.notifyName || phone,
        first_message: content,
        last_message: content,
        last_message_at: new Date().toISOString(),
        stage_id: defaultStage?.id,
        message_count: 1,
        is_read: false
      })
      .select()
      .single();

    lead = newLead;

    // Notify frontend
    if (io) io.emit('lead:new', lead);

    // Create notification
    await supabase.from('notifications').insert({
      title: 'New Lead!',
      message: `New message from ${msg.notifyName || phone}: "${content.substring(0, 50)}"`,
      type: 'lead'
    });
  } else {
    // Update existing lead
    await supabase
      .from('leads')
      .update({
        last_message: content,
        last_message_at: new Date().toISOString(),
        message_count: (existingLead.message_count || 0) + 1,
        is_read: false
      })
      .eq('id', existingLead.id);

    if (io) io.emit('lead:updated', { ...existingLead, last_message: content });
  }

  // Save message record
  await supabase.from('messages').insert({
    lead_id: lead.id,
    phone,
    content,
    direction: 'incoming',
    is_read: false
  });

  if (io) io.emit('message:new', { phone, content, direction: 'incoming', lead_id: lead.id });

  // Handle auto-replies
  await handleAutoReply(phone, content, isNewLead);
};

const handleAutoReply = async (phone, content, isNewLead) => {
  const { data: rules } = await supabase
    .from('auto_reply_rules')
    .select('*')
    .eq('is_active', true);

  if (!rules || rules.length === 0) return;

  // Check office hours for away message
  const { data: settingsRow } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'office_hours')
    .single();

  const officeHours = settingsRow?.value;
  let isAway = false;

  if (officeHours?.enabled) {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const day = now.getDay();
    const [startH, startM] = officeHours.start.split(':').map(Number);
    const [endH, endM] = officeHours.end.split(':').map(Number);
    const currentMins = hour * 60 + minute;
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;
    const isWorkDay = officeHours.days.includes(day);
    isAway = !isWorkDay || currentMins < startMins || currentMins > endMins;
  }

  let replyText = null;

  // Priority: away > welcome > keyword > menu
  if (isAway) {
    const awayRule = rules.find(r => r.type === 'away');
    if (awayRule) replyText = awayRule.reply_text;
  } else if (isNewLead) {
    const welcomeRule = rules.find(r => r.type === 'welcome');
    if (welcomeRule) replyText = welcomeRule.reply_text;
  } else {
    // Check keyword rules
    const lowerContent = content.toLowerCase();
    const keywordRule = rules.find(r =>
      r.type === 'keyword' &&
      r.keywords?.some(kw => lowerContent.includes(kw.toLowerCase()))
    );
    if (keywordRule) {
      replyText = keywordRule.reply_text;
    } else {
      // Check menu rule
      const menuRule = rules.find(r => r.type === 'menu');
      if (menuRule && (content === '1' || content === '2' || content === '3' || content === '4')) {
        // Handle menu selection
        const options = menuRule.reply_text.split('\n');
        replyText = `You selected option ${content}. Our team will assist you shortly!`;
      }
    }
  }

  if (replyText) {
    await sendMessage(phone, replyText);
  }
};

const sendMessage = async (phone, text) => {
  if (!isConnected || !client) {
    throw new Error('WhatsApp not connected');
  }
  const chatId = `${phone}@c.us`;
  await client.sendMessage(chatId, text);

  // Save outgoing message
  const { data: lead } = await supabase
    .from('leads')
    .select('id')
    .eq('phone', phone)
    .single();

  if (lead) {
    await supabase.from('messages').insert({
      lead_id: lead.id,
      phone,
      content: text,
      direction: 'outgoing',
      is_read: true
    });

    if (io) io.emit('message:new', { phone, content: text, direction: 'outgoing', lead_id: lead.id });
  }
};

const updateSessionStatus = async (connected, phone) => {
  await supabase
    .from('settings')
    .update({
      value: {
        connected,
        phone,
        last_connected: connected ? new Date().toISOString() : null
      }
    })
    .eq('key', 'whatsapp_session');
};

const disconnectWhatsApp = async () => {
  if (client) {
    await client.destroy();
    client = null;
    isConnected = false;
    qrCodeData = null;
  }
};

const getStatus = () => ({ isConnected, qrCodeData });

module.exports = { initWhatsApp, sendMessage, getStatus, disconnectWhatsApp };
