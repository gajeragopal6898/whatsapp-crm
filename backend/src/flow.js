const supabase = require('./supabase');
const { callAI } = require('./ai');

// ─── TRILINGUAL FLOW MESSAGES ─────────────────────────────────────────────────
const FLOW_MSG = {
  welcome: `🙏 *Dhwakat Herbal* માં આપનું સ્વાગત છે! અમે તમને કુદરતી રીતે સ્વસ્થ રહેવામાં મદદ કરવા માટે ઉત્સુક છીએ.
Dhwakat Herbal में आपका स्वागत है। हम आपको स्वस्थ रखने के लिए यहाँ हैं।
Welcome to *Dhwakat Herbal*! We are here to help you stay healthy naturally.

કૃપા કરીને ભાષા પસંદ કરો | कृपया भाषा चुनें | Please choose language:
1️⃣ ગુજરાતી
2️⃣ हिंदी
3️⃣ English`,

  name_capture_gu: `🙏 આપનું નામ જણાવો.\nઉદા: Rahul Patel`,
  name_capture_hi: `🙏 कृपया अपना नाम लिखें।\nउदा: Rahul Patel`,
  name_capture_en: `🙏 Please type your name.\nExample: Rahul Patel`,

  health_concern_gu: `{name}આપને કઈ સ્વાસ્થ્ય સમસ્યા છે? નંબર દ્વારા જવાબ આપો:

1️⃣ માનસિક સ્વાસ્થ્ય (Stress, Depression, ઊંઘ, Brain)
2️⃣ પાચન અને પેટ (Acidity, Gas, Kabaj, Piles)
3️⃣ સાંધા અને સ્નાયુ (Joint Pain, Arthritis)
4️⃣ વજન (Weight Loss / Weight Gain)
5️⃣ ત્વચા અને વાળ (Acne, Hair Fall, Skin Glow)
6️⃣ પર્સનલ વેલનેસ (PCOS, Periods, Sexual Wellness)
7️⃣ અન્ય (Immunity, Diabetes, Kidney, Detox)`,

  health_concern_hi: `{name}आपको कौन सी स्वास्थ्य समस्या है? नंबर से जवाब दें:

1️⃣ मानसिक स्वास्थ्य (Stress, Depression, नींद, Brain)
2️⃣ पाचन (Acidity, Gas, कब्ज, Piles)
3️⃣ जोड़ और मांसपेशी (Joint Pain, Arthritis)
4️⃣ वजन (Weight Loss / Weight Gain)
5️⃣ त्वचा और बाल (Acne, Hair Fall, Skin Glow)
6️⃣ Personal Wellness (PCOS, Periods, Sexual Wellness)
7️⃣ अन्य (Immunity, Diabetes, Kidney, Detox)`,

  health_concern_en: `{name}What health issue are you facing? Reply with number:

1️⃣ Mental Health (Stress, Depression, Sleep, Brain)
2️⃣ Digestion (Acidity, Gas, Constipation, Piles)
3️⃣ Joint Pain (Arthritis, Muscle Pain)
4️⃣ Weight Management (Weight Loss / Weight Gain)
5️⃣ Skin & Hair (Acne, Hair Fall, Skin Glow)
6️⃣ Personal Wellness (PCOS, Periods, Sexual Wellness)
7️⃣ Other (Immunity, Diabetes, Kidney Stone, Detox)`,

  duration_gu: `આ સમસ્યા તમને કેટલા સમયથી છે?
1️⃣ 1 મહિનાથી ઓછું
2️⃣ 1 થી 6 મહિના
3️⃣ 6 મહિનાથી વધુ`,

  duration_hi: `यह समस्या आपको कब से है?
1️⃣ 1 महीने से कम
2️⃣ 1 से 6 महीने
3️⃣ 6 महीने से ज़्यादा`,

  duration_en: `How long have you had this problem?
1️⃣ Less than 1 month
2️⃣ 1 to 6 months
3️⃣ More than 6 months`,

  medicine_gu: `શું તમે આ સમસ્યા માટે પહેલાં કોઈ દવા લીધી છે?
1️⃣ હા
2️⃣ ના`,

  medicine_hi: `क्या आपने इस समस्या के लिए पहले कोई दवा ली है?
1️⃣ हाँ
2️⃣ नहीं`,

  medicine_en: `Have you taken any medicine before for this?
1️⃣ Yes
2️⃣ No`,

  age_gu: `તમારી ઉંમર કેટલી છે?
1️⃣ 18 વર્ષથી ઓછી
2️⃣ 18 થી 45
3️⃣ 45 થી વધુ`,

  age_hi: `आपकी उम्र कितनी है?
1️⃣ 18 से कम
2️⃣ 18 से 45
3️⃣ 45 से ज़्यादा`,

  age_en: `What is your age group?
1️⃣ Below 18
2️⃣ 18 to 45
3️⃣ Above 45`,

  pincode_gu: `📦 આપનો Pincode અથવા શહેરનું નામ જણાવો.\nઉદા: 395001 અથવા Surat\nDelivery & courier selection માટે જરૂરી છે.`,
  pincode_hi: `📦 कृपया अपना Pincode या शहर बताएं।\nउदा: 395001 या Surat\nडिलीवरी के लिए जरूरी है।`,
  pincode_en: `📦 Please share your Pincode or City.\nE.g. 395001 or Surat\nRequired for delivery.`,

  ai_suggestion_gu: `{name}ની માહિતી માટે આભાર! 🙏\nઆપ જણાવેલ માહિતી અનુસાર, આપણા નિષ્ણાત આપ માટે સૌથી ઉપયોગી આયુર્વેદિક ઉત્પાદન સૂચવશે.\nઓર્ડર confirm કરવા આપણી ટીમ આપને call કરશે.`,
  ai_suggestion_hi: `{name}जानकारी के लिए धन्यवाद! 🙏\nआपके द्वारा दी गई जानकारी के आधार पर हमारी टीम सही उत्पाद सुझाएगी।\nऑर्डर कन्फर्म करने के लिए हमारी टीम आपको कॉल करेगी।`,
  ai_suggestion_en: `Thank you {name}! 🙏\nBased on your answers, our health expert will suggest the best Ayurvedic product for you.\nOur team will call you to confirm your order.`,

  callback_gu: `કૃપા કરીને call સમય પસંદ કરો:
1️⃣ સવારે 10:00 - 12:00
2️⃣ બપોરે 12:00 - 03:00
3️⃣ બપોરે 03:00 - 06:00
4️⃣ સાંજે 06:00 - 09:00`,

  callback_hi: `कृपया call का समय चुनें:
1️⃣ सुबह 10:00 - 12:00
2️⃣ दोपहर 12:00 - 03:00
3️⃣ शाम 03:00 - 06:00
4️⃣ शाम 06:00 - 09:00`,

  callback_en: `Please choose your preferred call time:
1️⃣ Morning 10:00 AM - 12:00 PM
2️⃣ Afternoon 12:00 PM - 03:00 PM
3️⃣ Evening 03:00 PM - 06:00 PM
4️⃣ Evening 06:00 PM - 09:00 PM`,
};

const FINAL_MSG = {
  gu: (n, t) => `✅ આભાર! 🙏\n\n*Agent Name:* ${n}\n*Mobile:* 9023935773\n\nઆપ પસંદ કરેલ *${t}* સમય દરમ્યાન સ્વાસ્થ્ય નિષ્ણાત સંપર્ક કરશે.\n\n📲 ફોન ring પર રાખો.\n\n🌿 *Dhwakat – World of Ayurveda*`,
  hi: (n, t) => `✅ धन्यवाद! 🙏\n\n*Agent Name:* ${n}\n*Mobile:* 9023935773\n\n*${t}* के दौरान हमारे विशेषज्ञ आपसे संपर्क करेंगे।\n\n📲 फोन ring पर रखें।\n\n🌿 *Dhwakat – World of Ayurveda*`,
  en: (n, t) => `✅ Thank you! 🙏\n\n*Agent Name:* ${n}\n*Mobile:* 9023935773\n\nWill call you during *${t}*.\n\n📲 Please keep your phone on ring.\n\n🌿 *Dhwakat – World of Ayurveda*`,
};

const CALL_TIMES_MAP = {
  gu: { '1':'સવારે 10:00-12:00','2':'બપોરે 12:00-03:00','3':'બપોરે 03:00-06:00','4':'સાંજે 06:00-09:00' },
  hi: { '1':'सुबह 10:00-12:00','2':'दोपहर 12:00-03:00','3':'शाम 03:00-06:00','4':'शाम 06:00-09:00' },
  en: { '1':'Morning 10:00-12:00','2':'Afternoon 12:00-03:00','3':'Evening 03:00-06:00','4':'Evening 06:00-09:00' },
};

const HEALTH_CATEGORIES = {
  '1':'Mental Health (Stress/Depression/Sleep/Brain)',
  '2':'Digestion (Acidity/Gas/Constipation/Piles)',
  '3':'Joint & Muscle Pain',
  '4':'Weight Management',
  '5':'Skin & Hair',
  '6':'Personal Wellness (PCOS/Periods/Sexual)',
  '7':'Other (Immunity/Diabetes/Kidney/Detox)',
};

// ─── DB MESSAGE CACHE ──────────────────────────────────────────────────────────
let cachedFlowMsgs = null;
let cacheExpiry = 0;

async function getFlowMessages() {
  const now = Date.now();
  if (cachedFlowMsgs && now < cacheExpiry) return cachedFlowMsgs;
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', 'flow_messages').single();
    cachedFlowMsgs = data?.value || {};
    cacheExpiry = now + 60000;
    return cachedFlowMsgs;
  } catch { return {}; }
}

async function getMsg(key, lang) {
  const dbMsgs = await getFlowMessages();
  if (dbMsgs[`${key}_${lang}`]) return dbMsgs[`${key}_${lang}`];
  if (dbMsgs[key]) return dbMsgs[key];
  return FLOW_MSG[`${key}_${lang}`] || FLOW_MSG[key] || '';
}

// ─── STATE HELPERS ─────────────────────────────────────────────────────────────
async function getState(phone) {
  try {
    const { data } = await supabase.from('conversation_state').select('*').eq('phone', phone).single();
    return data;
  } catch { return null; }
}

async function setState(phone, leadId, updates) {
  const existing = await getState(phone);
  if (!existing) {
    await supabase.from('conversation_state').insert({ phone, lead_id: leadId, ...updates, updated_at: new Date().toISOString() });
  } else {
    await supabase.from('conversation_state').update({ ...updates, updated_at: new Date().toISOString() }).eq('phone', phone);
  }
}

async function resetState(phone, leadId) {
  await supabase.from('conversation_state').upsert({
    phone, lead_id: leadId, flow_step: 'language', language: null,
    collected_data: {}, ai_mode: false, escalated: false,
    escalated_at: null, updated_at: new Date().toISOString()
  }, { onConflict: 'phone' });
}

// ─── NOTIFY AGENT ─────────────────────────────────────────────────────────────
async function notifyAgent(lead, collectedData, preferredTime, sendMessage, io) {
  await supabase.from('notifications').insert({
    title: '🚨 Agent Required',
    message: `Customer ${lead.name || lead.phone} needs help. Call: ${preferredTime}`,
    type: 'warning'
  });

  io.emit('lead:escalated', { lead_id: lead.id, phone: lead.phone, name: lead.name, preferred_call_time: preferredTime, collected_data: collectedData });

  let adminNumbers = [];
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', 'admin_numbers').single();
    if (data?.value?.numbers) adminNumbers = data.value.numbers;
  } catch {}
  if (!adminNumbers.length) adminNumbers = [{ phone: process.env.ADMIN_WHATSAPP || '6353360578', name: 'Shreyas Ramani', notify: true }];

  const summary = Object.entries(collectedData).filter(([k]) => k !== 'raw').map(([k, v]) => `${k}: ${v}`).join('\n');
  const alertMsg = `🚨 *AGENT REQUIRED*\n\nCustomer: ${lead.name || lead.phone}\nPhone: +${lead.phone}\nCall Time: ${preferredTime}\nPincode: ${lead.pincode || 'N/A'}\n\n*Details:*\n${summary}\n\nCall on: 9023935773`;

  for (const admin of adminNumbers.filter(a => a.notify !== false)) {
    try { await sendMessage(admin.phone, alertMsg); } catch (e) { console.log(`Notify error:`, e.message); }
  }

  const { data: stage } = await supabase.from('lead_stages').select('id').eq('name', 'Contacted').single();
  if (stage) await supabase.from('leads').update({ stage_id: stage.id }).eq('id', lead.id);
}

// ─── EXTRACT PINCODE ──────────────────────────────────────────────────────────
function extractPincode(msg) {
  const match = msg.match(/\b[1-9][0-9]{5}\b/);
  return match ? match[0] : null;
}

// ─── AI PRODUCT RECOMMENDATION ────────────────────────────────────────────────
async function generateRecommendation(collectedData, lang, lead) {
  const { data: aiSettings } = await supabase.from('settings').select('value').eq('key', 'ai_settings').single().catch(() => ({ data: null }));
  const biz = aiSettings?.value?.business_context || '';
  const langName = lang === 'gu' ? 'Gujarati' : lang === 'hi' ? 'Hindi' : 'English';

  const prompt = `You are Dhwakat Herbal's WhatsApp health advisor. Recommend the best Ayurvedic product.

PRODUCTS BY CONDITION:
Mental Health/Stress/Anxiety/Depression → Manoveda (Syrup, Tablet)
Sleep/Insomnia → ShayanVeda (Syrup, Tablet)
Memory/Brain → Smritiveda, Brahmi Powder
Headache/Migraine → Shiroveda (Syrup, Tablet, Oil)
Acidity/Gas/Bloating → Agnimukta (Syrup, Tablet, Powder)
Constipation → Rechaka Veda, Ishabgool, Tripha
Piles/Fissure → GudaShanti
PCOS/Periods → Feminoveda | Period Pain → Ritushanti
Iron/Anemia → Lohaveda | Skin/Acne → AcnoVeda | Hair Fall → RomaVardhak
Joint Pain/Arthritis → Sandhiveda (Syrup, Tablet, Powder, Oil) + Moringa
Diabetes → GlucoVeda | BP → RaktaSneha | Cholesterol → Hridayaveda
Immunity/Cold/Cough → Immuno Plus, Shwasveda
Weight Loss → MedoharMukta | Weight Gain → Poshakveda
Sexual/Men's Wellness → Vajraveda, Shilajit, Ashwagandha, Musli
Kidney Stone → GO_Lith | Liver → Yakritshuddhi | Detox → Raktaveda
De-addiction → Manomukta | Vitality/Energy → Satvik Multivita
${biz}

CUSTOMER PROFILE:
Name: ${lead?.name || 'Customer'}
Health Concern: ${collectedData.health_concern || 'Not specified'}
Duration: ${collectedData.duration || 'Not specified'}
Previously tried medicine: ${collectedData.tried_medicine || 'Not specified'}
Age: ${collectedData.age_group || 'Not specified'}

WRITE IN: ${langName} ONLY
MAX 3-4 sentences. Warm helpful tone.
DO NOT mention price. DO NOT mention GMP/certification.
End with: Order WhatsApp: 9023935773

RECOMMENDATION:`;

  const raw = await callAI(prompt);
  return raw.replace(/[◆◇●○■□▲△▼▽★☆♦♠♣♥❓❔\uFFFD]/g, '').replace(/\s{2,}/g, ' ').trim();
}

// ─── MAIN FLOW ─────────────────────────────────────────────────────────────────
async function processFlow({ phone, content, lead, io, sendMessage, saveOutgoing }) {
  const msg = content.trim();
  const msgLower = msg.toLowerCase();
  const msgNum = msg.replace(/[^\d]/g, '');

  let state = await getState(phone);
  const now = new Date();
  const isStale = state?.updated_at && (now - new Date(state.updated_at)) > 24 * 60 * 60 * 1000;

  // New customer or stale
  if (!state || state.flow_step === 'done' || isStale) {
    await resetState(phone, lead.id);
    let welcomeMsg = FLOW_MSG.welcome;
    try { const db = await getFlowMessages(); if (db.welcome) welcomeMsg = db.welcome; } catch {}
    await sendMessage(phone, welcomeMsg);
    await saveOutgoing(lead.id, phone, welcomeMsg, io);
    await setState(phone, lead.id, { flow_step: 'language' });
    return true;
  }

  if (state.ai_mode && !state.escalated) return false;

  // Escalated — waiting for call time choice
  if (state.escalated && state.flow_step === 'call_time') {
    const lang = state.language || 'gu';
    const time = CALL_TIMES_MAP[lang]?.[msgNum] || CALL_TIMES_MAP[lang]?.['2'];
    let agentName = 'Dhwakat Herbal Team';
    try {
      const { data } = await supabase.from('settings').select('value').eq('key', 'admin_numbers').single();
      const notifyNums = (data?.value?.numbers || []).filter(n => n.notify !== false);
      if (notifyNums.length > 0) agentName = notifyNums[0].name;
    } catch {}

    const replyMsg = FINAL_MSG[lang](agentName, time);
    await sendMessage(phone, replyMsg);
    await saveOutgoing(lead.id, phone, replyMsg, io);
    await notifyAgent(lead, state.collected_data || {}, time, sendMessage, io);
    await setState(phone, lead.id, { flow_step: 'done', preferred_call_time: time });
    return true;
  }

  if (state.escalated) return false;

  const lang = state.language || 'gu';

  // LANGUAGE
  if (state.flow_step === 'language') {
    let selectedLang = null;
    if (msgNum === '1' || msgLower.includes('gujarati') || msgLower.includes('gu')) selectedLang = 'gu';
    else if (msgNum === '2' || msgLower.includes('hindi') || msgLower.includes('हिंदी') || msgLower.includes('hindi')) selectedLang = 'hi';
    else if (msgNum === '3' || msgLower.includes('english') || msgLower.includes('en')) selectedLang = 'en';
    else { await setState(phone, lead.id, { ai_mode: true }); return false; }

    await setState(phone, lead.id, { language: selectedLang, flow_step: 'name' });
    const reply = await getMsg('name_capture', selectedLang);
    await sendMessage(phone, reply);
    await saveOutgoing(lead.id, phone, reply, io);
    return true;
  }

  // NAME
  if (state.flow_step === 'name') {
    const name = msg.length >= 2 && msg.length <= 60 && !msg.match(/^\d+$/) ? msg : null;
    if (name) await supabase.from('leads').update({ name }).eq('id', lead.id);
    const data = { ...(state.collected_data || {}), customer_name: name || '' };
    await setState(phone, lead.id, { flow_step: 'health_concern', collected_data: data });
    const template = await getMsg('health_concern', lang);
    const reply = template.replace('{name}', name ? `${name}, ` : '');
    await sendMessage(phone, reply);
    await saveOutgoing(lead.id, phone, reply, io);
    return true;
  }

  // HEALTH CONCERN
  if (state.flow_step === 'health_concern') {
    const concern = HEALTH_CATEGORIES[msgNum] || (msg.length > 3 ? msg : null);
    if (!concern) { await setState(phone, lead.id, { ai_mode: true }); return false; }
    const data = { ...(state.collected_data || {}), health_concern: concern };
    await setState(phone, lead.id, { flow_step: 'duration', collected_data: data });
    await sendMessage(phone, await getMsg('duration', lang));
    await saveOutgoing(lead.id, phone, await getMsg('duration', lang), io);
    return true;
  }

  // DURATION
  if (state.flow_step === 'duration') {
    const dur = { gu:{'1':'<1 મહિ','2':'1-6 મહિ','3':'6+ મહિ'}, hi:{'1':'<1 माह','2':'1-6 माह','3':'6+ माह'}, en:{'1':'<1 mo','2':'1-6 mo','3':'6+ mo'} };
    const duration = dur[lang]?.[msgNum] || msg;
    const data = { ...(state.collected_data || {}), duration };
    await setState(phone, lead.id, { flow_step: 'medicine', collected_data: data });
    await sendMessage(phone, await getMsg('medicine', lang));
    await saveOutgoing(lead.id, phone, await getMsg('medicine', lang), io);
    return true;
  }

  // MEDICINE
  if (state.flow_step === 'medicine') {
    const tried = { gu:{'1':'હા','2':'ના'}, hi:{'1':'हाँ','2':'नहीं'}, en:{'1':'Yes','2':'No'} }[lang]?.[msgNum] || msg;
    const data = { ...(state.collected_data || {}), tried_medicine: tried };
    await setState(phone, lead.id, { flow_step: 'age', collected_data: data });
    await sendMessage(phone, await getMsg('age', lang));
    await saveOutgoing(lead.id, phone, await getMsg('age', lang), io);
    return true;
  }

  // AGE
  if (state.flow_step === 'age') {
    const age = { gu:{'1':'<18','2':'18-45','3':'45+'}, hi:{'1':'<18','2':'18-45','3':'45+'}, en:{'1':'<18','2':'18-45','3':'45+'} }[lang]?.[msgNum] || msg;
    const data = { ...(state.collected_data || {}), age_group: age };
    await setState(phone, lead.id, { flow_step: 'pincode', collected_data: data });
    await sendMessage(phone, await getMsg('pincode', lang));
    await saveOutgoing(lead.id, phone, await getMsg('pincode', lang), io);
    return true;
  }

  // PINCODE
  if (state.flow_step === 'pincode') {
    const pincode = extractPincode(msg);
    const city = !pincode && msg.length > 1 ? msg.trim().slice(0, 30) : null;
    if (pincode) await supabase.from('leads').update({ pincode }).eq('id', lead.id);
    if (city) await supabase.from('leads').update({ city }).eq('id', lead.id);

    const data = { ...(state.collected_data || {}), pincode: pincode || city || msg };
    await setState(phone, lead.id, { flow_step: 'call_time', collected_data: data, escalated: true, ai_mode: false });

    // AI recommendation
    const rec = await generateRecommendation(data, lang, lead);
    await sendMessage(phone, rec);
    await saveOutgoing(lead.id, phone, rec, io);

    // AI summary + callback
    await new Promise(r => setTimeout(r, 1500));
    const aiMsg = (await getMsg('ai_suggestion', lang)).replace('{name}', data.customer_name ? data.customer_name + ' ' : '');
    await sendMessage(phone, aiMsg);
    await saveOutgoing(lead.id, phone, aiMsg, io);

    await new Promise(r => setTimeout(r, 1000));
    const cbMsg = await getMsg('callback', lang);
    await sendMessage(phone, cbMsg);
    await saveOutgoing(lead.id, phone, cbMsg, io);

    // Update stage
    const { data: stage } = await supabase.from('lead_stages').select('id').eq('name', 'Qualified').single();
    if (stage) await supabase.from('leads').update({ stage_id: stage.id }).eq('id', lead.id);

    return true;
  }

  await setState(phone, lead.id, { ai_mode: true });
  return false;
}

async function shouldUseFlow(phone) {
  const state = await getState(phone);
  if (!state) return true;
  if (state.escalated && state.flow_step === 'call_time') return true;
  if (state.ai_mode) return false;
  if (state.flow_step === 'done') return false;
  if (state.escalated) return false;
  return true;
}

module.exports = { processFlow, shouldUseFlow, getState, setState, notifyAgent, FLOW_MSG };
