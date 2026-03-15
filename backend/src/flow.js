const supabase = require('./supabase');
const { generateReply } = require('./ai');

// ─── FLOW MESSAGES ─────────────────────────────────────────────────────────────
const MESSAGES = {
  en: {
    welcome: `🌿 Welcome to *Dhwakat Herbal*!\n\nIndia's trusted Ayurvedic brand.\n\nPlease select your language:\n1️⃣ English\n2️⃣ हिंदी (Hindi)\n3️⃣ ગુજરાતી (Gujarati)`,
    health_concern: `What is your health concern? Please reply with a number:\n\n1️⃣ Mental Health (Stress/Anxiety/Sleep/Memory)\n2️⃣ Digestive Health (Acidity/Gas/Constipation)\n3️⃣ Women's Health (PCOS/Periods/Iron)\n4️⃣ Skin & Hair (Acne/Hair Fall/Glow)\n5️⃣ Joints & Bones (Joint Pain/Arthritis)\n6️⃣ Immunity & Respiratory (Cold/Cough/Allergy)\n7️⃣ Weight Management (Loss/Gain)\n8️⃣ Diabetes/BP/Cholesterol\n9️⃣ Men's Wellness (Energy/Vitality)\n🔟 Other (type your concern)`,
    duration: `How long have you had this problem?\n\n1️⃣ Less than 1 week\n2️⃣ 1 week - 1 month\n3️⃣ 1 to 6 months\n4️⃣ More than 6 months`,
    tried_medicine: `Have you tried any medicine before for this?\n\n1️⃣ Yes (Ayurvedic)\n2️⃣ Yes (Allopathic/English medicine)\n3️⃣ No, first time`,
    age_group: `What is your age group? (Optional - press 0 to skip)\n\n1️⃣ Below 18\n2️⃣ 18 to 35\n3️⃣ 36 to 55\n4️⃣ Above 55\n0️⃣ Skip`,
    form_preference: `Which form do you prefer?\n\n1️⃣ Syrup (easy to take, fast action)\n2️⃣ Tablet/Capsule (convenient)\n3️⃣ Powder (traditional, mix with milk/water)\n4️⃣ Oil (external use only)\n5️⃣ No preference`,
    escalate_msg: `Thank you! 🙏 Our health expert will contact you shortly.\n\nWhat is your preferred time for a call?\n1️⃣ Morning (9am - 12pm)\n2️⃣ Afternoon (12pm - 4pm)\n3️⃣ Evening (4pm - 8pm)`,
    agent_notified: (time) => `Thank you! ✅ Our agent will call you during *${time}*.\n\nFor urgent enquiries, WhatsApp us: *9023935773*`,
  },
  hi: {
    welcome: `🌿 *Dhwakat Herbal* में आपका स्वागत है!\n\nभारत का विश्वसनीय आयुर्वेदिक ब्रांड।\n\nकृपया अपनी भाषा चुनें:\n1️⃣ English\n2️⃣ हिंदी (Hindi)\n3️⃣ ગુજરાતી (Gujarati)`,
    health_concern: `आपको कौन सी स्वास्थ्य समस्या है? नंबर से जवाब दें:\n\n1️⃣ मानसिक स्वास्थ्य (तनाव/चिंता/नींद/याददाश्त)\n2️⃣ पाचन स्वास्थ्य (एसिडिटी/गैस/कब्ज)\n3️⃣ महिला स्वास्थ्य (PCOS/पीरियड्स/आयरन)\n4️⃣ त्वचा और बाल (मुहांसे/बालों का झड़ना)\n5️⃣ जोड़ और हड्डियां (जोड़ों का दर्द)\n6️⃣ रोग प्रतिरोधक क्षमता (सर्दी/खांसी/एलर्जी)\n7️⃣ वजन प्रबंधन (घटाना/बढ़ाना)\n8️⃣ मधुमेह/बीपी/कोलेस्ट्रॉल\n9️⃣ पुरुष स्वास्थ्य (ऊर्जा/जीवन शक्ति)\n🔟 अन्य (अपनी समस्या लिखें)`,
    duration: `यह समस्या कब से है?\n\n1️⃣ 1 हफ्ते से कम\n2️⃣ 1 हफ्ता - 1 महीना\n3️⃣ 1 से 6 महीने\n4️⃣ 6 महीने से ज्यादा`,
    tried_medicine: `क्या आपने पहले कोई दवाई ली है?\n\n1️⃣ हाँ (आयुर्वेदिक)\n2️⃣ हाँ (अंग्रेजी दवाई)\n3️⃣ नहीं, पहली बार`,
    age_group: `आपकी उम्र क्या है? (0 दबाएं अगर नहीं बताना)\n\n1️⃣ 18 से कम\n2️⃣ 18 से 35\n3️⃣ 36 से 55\n4️⃣ 55 से ज्यादा\n0️⃣ छोड़ें`,
    form_preference: `आप कौन सा रूप पसंद करते हैं?\n\n1️⃣ सिरप (आसान, जल्दी असर)\n2️⃣ टेबलेट/कैप्सूल (सुविधाजनक)\n3️⃣ पाउडर (दूध/पानी में मिलाएं)\n4️⃣ तेल (बाहरी उपयोग)\n5️⃣ कोई प्राथमिकता नहीं`,
    escalate_msg: `धन्यवाद! 🙏 हमारे स्वास्थ्य विशेषज्ञ जल्द आपसे संपर्क करेंगे।\n\nकॉल के लिए आपका पसंदीदा समय?\n1️⃣ सुबह (9am - 12pm)\n2️⃣ दोपहर (12pm - 4pm)\n3️⃣ शाम (4pm - 8pm)`,
    agent_notified: (time) => `धन्यवाद! ✅ हमारा एजेंट *${time}* में कॉल करेगा।\n\nजरूरी पूछताछ के लिए: *9023935773*`,
  },
  gu: {
    welcome: `🌿 *Dhwakat Herbal* માં આપનું સ્વાગત છે!\n\nભારતનો વિશ્વસનીય આયુર્વેદિક બ્રાન્ડ।\n\nકૃપા કરી આપની ભાષા પસંદ કરો:\n1️⃣ English\n2️⃣ हिंदी (Hindi)\n3️⃣ ગુજરાતી (Gujarati)`,
    health_concern: `આપને કઈ સ્વાસ્થ્ય સમસ્યા છે? નંબર દ્વારા જવાબ આપો:\n\n1️⃣ માનસિક સ્વાસ્થ્ય (તણાવ/ચિંતા/ઊંઘ/યાદશક્તિ)\n2️⃣ પાચન સ્વાસ્થ્ય (એસિડિટી/ગેસ/કબ્જ)\n3️⃣ સ્ત્રી સ્વાસ્થ્ય (PCOS/પીરિયડ્સ/આયર્ન)\n4️⃣ ત્વચા અને વાળ (ખીલ/વાળ ખરવા/ચળ)\n5️⃣ સાંધા અને હાડકા (સાંધાનો દુઃખાવો)\n6️⃣ રોગ પ્રતિકારક શક્તિ (શરદી/ખાંસી/એલર્જી)\n7️⃣ વજન વ્યવસ્થાપન (ઘટાડવું/વધારવું)\n8️⃣ ડાયાબિટીસ/BP/કોલેસ્ટ્રોલ\n9️⃣ પુરુષ સ્વાસ્થ્ય (ઊર્જા/શક્તિ)\n🔟 અન્ય (આપની સમસ્યા લખો)`,
    duration: `આ સમસ્યા કેટલા સમયથી છે?\n\n1️⃣ 1 અઠવાડિયાથી ઓછી\n2️⃣ 1 અઠવાડિયો - 1 મહિનો\n3️⃣ 1 થી 6 મહિના\n4️⃣ 6 મહિનાથી વધુ`,
    tried_medicine: `શું આપે પહેલાં કોઈ દવા લીધી છે?\n\n1️⃣ હા (આયુર્વેદિક)\n2️⃣ હા (અંગ્રેજી દવા)\n3️⃣ ના, પ્રથમ વખત`,
    age_group: `આપની ઉંમર શું છે? (0 દબાવો જો ન જણાવવું હોય)\n\n1️⃣ 18 વર્ષથી ઓછી\n2️⃣ 18 થી 35 વર્ષ\n3️⃣ 36 થી 55 વર્ષ\n4️⃣ 55 વર્ષથી વધુ\n0️⃣ છોડો`,
    form_preference: `આપ કઈ ઔષધ સ્વરૂપ પસંદ કરો છો?\n\n1️⃣ સીરપ (સરળ, ઝડપી અસર)\n2️⃣ ટેબ્લેટ/કેપ્સ્યૂલ (સગવડભર્યું)\n3️⃣ પાઉડર (દૂધ/પાણીમાં ભેળવો)\n4️⃣ તેલ (બાહ્ય ઉપયોગ)\n5️⃣ કોઈ પ્રાધાન્ય નથી`,
    escalate_msg: `આભાર! 🙏 આપણા સ્વાસ્થ્ય નિષ્ણાત ટૂંક સમયમાં સંપર્ક કરશે.\n\nફોન કૉલ માટે આપનો પ્રિય સમય?\n1️⃣ સવારે (9am - 12pm)\n2️⃣ બપોરે (12pm - 4pm)\n3️⃣ સાંજે (4pm - 8pm)`,
    agent_notified: (time) => `આભાર! ✅ આપણો એજન્ટ *${time}* માં કૉલ કરશે.\n\nજરૂરી પૂછપ્રછ માટે: *9023935773*`,
  }
};

const CALL_TIMES = {
  en: { '1': 'Morning (9am-12pm)', '2': 'Afternoon (12pm-4pm)', '3': 'Evening (4pm-8pm)' },
  hi: { '1': 'सुबह (9am-12pm)', '2': 'दोपहर (12pm-4pm)', '3': 'शाम (4pm-8pm)' },
  gu: { '1': 'સવારે (9am-12pm)', '2': 'બપોરે (12pm-4pm)', '3': 'સાંજે (4pm-8pm)' }
};

const HEALTH_CATEGORIES = {
  '1': 'Mental Health (Stress/Anxiety/Sleep/Memory)',
  '2': 'Digestive Health (Acidity/Gas/Constipation)',
  '3': "Women's Health (PCOS/Periods/Iron)",
  '4': 'Skin & Hair (Acne/Hair Fall)',
  '5': 'Joints & Bones (Joint Pain/Arthritis)',
  '6': 'Immunity & Respiratory (Cold/Cough/Allergy)',
  '7': 'Weight Management',
  '8': 'Diabetes/BP/Cholesterol',
  '9': "Men's Wellness (Energy/Vitality)",
  '10': 'Other'
};

// ─── GET/CREATE CONVERSATION STATE ───────────────────────────────────────────
async function getState(phone) {
  try {
    const { data } = await supabase.from('conversation_state').select('*').eq('phone', phone).single();
    return data;
  } catch { return null; }
}

async function setState(phone, leadId, updates) {
  const existing = await getState(phone);
  if (!existing) {
    await supabase.from('conversation_state').insert({
      phone, lead_id: leadId, ...updates, updated_at: new Date().toISOString()
    });
  } else {
    await supabase.from('conversation_state').update({
      ...updates, updated_at: new Date().toISOString()
    }).eq('phone', phone);
  }
}

async function resetState(phone, leadId) {
  await supabase.from('conversation_state').upsert({
    phone, lead_id: leadId,
    flow_step: 'language', language: null,
    collected_data: {}, ai_mode: false,
    escalated: false, escalated_at: null,
    updated_at: new Date().toISOString()
  }, { onConflict: 'phone' });
}

// ─── NOTIFY AGENT ─────────────────────────────────────────────────────────────
async function notifyAgent(lead, collectedData, preferredTime, sendMessage, io) {
  // Create CRM notification
  await supabase.from('notifications').insert({
    title: '🚨 Agent Takeover Required',
    message: `Customer ${lead.name || lead.phone} needs human help. Preferred call: ${preferredTime}`,
    type: 'warning'
  });

  // Emit to dashboard
  io.emit('lead:escalated', {
    lead_id: lead.id,
    phone: lead.phone,
    name: lead.name,
    preferred_call_time: preferredTime,
    collected_data: collectedData,
    message: 'Customer needs agent assistance'
  });

  // Send WhatsApp to admin number
  const adminPhone = process.env.ADMIN_WHATSAPP || '9023935773';
  const summary = Object.entries(collectedData)
    .filter(([k]) => k !== 'raw')
    .map(([k, v]) => `${k}: ${v}`).join('\n');

  try {
    await sendMessage(adminPhone,
      `🚨 *AGENT REQUIRED*\n\nCustomer: ${lead.name || lead.phone}\nPhone: ${lead.phone}\nPreferred call: ${preferredTime}\n\n*Customer Info:*\n${summary}\n\nPlease call them!`
    );
  } catch (e) { console.log('Admin notify error:', e.message); }

  // Update lead stage to "Contacted"
  const { data: stage } = await supabase.from('lead_stages').select('id').eq('name', 'Contacted').single();
  if (stage) await supabase.from('leads').update({ stage_id: stage.id }).eq('id', lead.id);
}

// ─── GENERATE PRODUCT RECOMMENDATION ─────────────────────────────────────────
async function generateRecommendation(collectedData, lang, lead) {
  const { data: aiSettings } = await supabase.from('settings').select('value').eq('key', 'ai_settings').single();
  const businessContext = aiSettings?.value?.business_context || '';

  const langName = lang === 'gu' ? 'Gujarati' : lang === 'hi' ? 'Hindi' : 'English';

  const prompt = `You are Dhwakat Herbal's WhatsApp assistant. Based on customer information, recommend the best Ayurvedic product.

PRODUCTS:
- Mental Health (Stress/Anxiety/Depression) → Manoveda (Syrup, Tablet)
- Sleep/Insomnia → ShayanVeda (Syrup, Tablet)
- Memory/Brain → Smritiveda (Syrup, Tablet), Brahmi Powder
- Headache/Migraine → Shiroveda (Syrup, Tablet, Oil)
- Acidity/Gas → Agnimukta (Syrup, Tablet, Powder)
- Constipation → Rechaka Veda (Syrup, Tablet), Ishabgool
- Women's Health/PCOS → Feminoveda (Syrup, Tablet)
- Period Pain → Ritushanti (Syrup, Tablet)
- Iron/Anemia → Lohaveda (Syrup, Tablet)
- Skin/Acne → AcnoVeda (Syrup, Tablet)
- Hair Fall → RomaVardhak (Syrup, Tablet, Oil)
- Joint Pain → Sandhiveda (Syrup, Tablet, Powder, Oil)
- Diabetes → GlucoVeda (Syrup, Tablet, Powder)
- Blood Pressure → RaktaSneha (Syrup, Tablet)
- Cholesterol → Hridayaveda (Syrup, Tablet)
- Immunity/Cold/Cough → Immuno Plus, Shwasveda
- Weight Loss → MedoharMukta (Syrup, Tablet, Powder)
- Weight Gain → Poshakveda (Syrup, Tablet, Powder)
- Men's Wellness/Energy → Vajraveda, Shilajit, Ashwagandha
- Kidney Stone → GO_Lith
- Liver Detox → Yakritshuddhi
- De-addiction → Manomukta
${businessContext}

CUSTOMER INFORMATION:
- Health Concern: ${collectedData.health_concern || 'Not specified'}
- Problem Duration: ${collectedData.duration || 'Not specified'}
- Previous Medicine: ${collectedData.tried_medicine || 'Not specified'}
- Age Group: ${collectedData.age_group || 'Not specified'}
- Preferred Form: ${collectedData.form_preference || 'No preference'}
- Customer Name: ${lead?.name || 'Customer'}

INSTRUCTIONS:
- Reply ONLY in ${langName}
- Recommend 1-2 most suitable products with clear reasons
- Mention which form based on their preference
- End with: Order on WhatsApp 9023935773
- Maximum 4 sentences
- No price, no certification mention
- Warm and caring tone

RECOMMENDATION:`;

  return await generateReply({
    customerMessage: `Recommend product based on: ${JSON.stringify(collectedData)}`,
    businessContext,
    conversationHistory: [],
    customerName: lead?.name || '',
    phone: lead?.phone || '',
    leadId: lead?.id || ''
  }).catch(() => null) || await require('./ai').callAI(prompt);
}

// ─── MAIN FLOW PROCESSOR ──────────────────────────────────────────────────────
async function processFlow({ phone, content, lead, io, sendMessage, saveOutgoing }) {
  const msg = content.trim();
  const msgLower = msg.toLowerCase();
  const msgNum = msg.replace(/[^\d]/g, '');

  let state = await getState(phone);

  // ── NEW CUSTOMER or RESET ──
  if (!state || state.flow_step === 'welcome' || state.flow_step === 'done') {
    await resetState(phone, lead.id);
    await sendMessage(phone, MESSAGES.gu.welcome);
    await saveOutgoing(lead.id, phone, MESSAGES.gu.welcome, io);
    await setState(phone, lead.id, { flow_step: 'language' });
    return true;
  }

  // ── IF ESCALATED — AI or agent mode ──
  if (state.escalated) {
    if (state.flow_step === 'call_time') {
      const lang = state.language || 'gu';
      const times = CALL_TIMES[lang];
      const time = times[msgNum] || times['2'];
      const replyMsg = MESSAGES[lang].agent_notified(time);
      await sendMessage(phone, replyMsg);
      await saveOutgoing(lead.id, phone, replyMsg, io);
      await notifyAgent(lead, state.collected_data || {}, time, sendMessage, io);
      await setState(phone, lead.id, { flow_step: 'done', preferred_call_time: time });
      return true;
    }
    // AI handles freely after escalation
    return false;
  }

  // ── AI MODE — customer broke chain ──
  if (state.ai_mode) return false;

  const lang = state.language || 'gu';
  const M = MESSAGES[lang];

  // ── LANGUAGE SELECTION ──
  if (state.flow_step === 'language') {
    let selectedLang = null;
    if (msgNum === '1' || msgLower.includes('english')) selectedLang = 'en';
    else if (msgNum === '2' || msgLower.includes('hindi') || msgLower.includes('हिंदी')) selectedLang = 'hi';
    else if (msgNum === '3' || msgLower.includes('gujarati') || msgLower.includes('ગુજ')) selectedLang = 'gu';
    else {
      // Not a valid menu option — switch to AI mode
      await setState(phone, lead.id, { ai_mode: true });
      return false;
    }
    await setState(phone, lead.id, { language: selectedLang, flow_step: 'health_concern' });
    const reply = MESSAGES[selectedLang].health_concern;
    await sendMessage(phone, reply);
    await saveOutgoing(lead.id, phone, reply, io);
    return true;
  }

  // ── HEALTH CONCERN ──
  if (state.flow_step === 'health_concern') {
    let concern = null;
    if (msgNum && HEALTH_CATEGORIES[msgNum]) {
      concern = HEALTH_CATEGORIES[msgNum];
    } else if (msg.length > 3) {
      // Free text — let AI handle
      concern = msg;
    } else {
      await setState(phone, lead.id, { ai_mode: true });
      return false;
    }
    const data = { ...(state.collected_data || {}), health_concern: concern };
    await setState(phone, lead.id, { flow_step: 'duration', collected_data: data });
    const reply = M.duration;
    await sendMessage(phone, reply);
    await saveOutgoing(lead.id, phone, reply, io);
    return true;
  }

  // ── DURATION ──
  if (state.flow_step === 'duration') {
    const durations = { '1': 'Less than 1 week', '2': '1 week - 1 month', '3': '1-6 months', '4': '6+ months' };
    const duration = durations[msgNum] || msg;
    const data = { ...(state.collected_data || {}), duration };
    await setState(phone, lead.id, { flow_step: 'tried_medicine', collected_data: data });
    const reply = M.tried_medicine;
    await sendMessage(phone, reply);
    await saveOutgoing(lead.id, phone, reply, io);
    return true;
  }

  // ── TRIED MEDICINE ──
  if (state.flow_step === 'tried_medicine') {
    const options = { '1': 'Yes (Ayurvedic)', '2': 'Yes (Allopathic)', '3': 'No, first time' };
    const tried = options[msgNum] || msg;
    const data = { ...(state.collected_data || {}), tried_medicine: tried };
    await setState(phone, lead.id, { flow_step: 'age_group', collected_data: data });
    const reply = M.age_group;
    await sendMessage(phone, reply);
    await saveOutgoing(lead.id, phone, reply, io);
    return true;
  }

  // ── AGE GROUP ──
  if (state.flow_step === 'age_group') {
    const ages = { '0': 'Not specified', '1': 'Below 18', '2': '18-35', '3': '36-55', '4': 'Above 55' };
    const age = ages[msgNum] || 'Not specified';
    const data = { ...(state.collected_data || {}), age_group: age };
    await setState(phone, lead.id, { flow_step: 'form_preference', collected_data: data });
    const reply = M.form_preference;
    await sendMessage(phone, reply);
    await saveOutgoing(lead.id, phone, reply, io);
    return true;
  }

  // ── FORM PREFERENCE → RECOMMEND ──
  if (state.flow_step === 'form_preference') {
    const forms = { '1': 'Syrup', '2': 'Tablet/Capsule', '3': 'Powder', '4': 'Oil', '5': 'No preference' };
    const form = forms[msgNum] || 'No preference';
    const data = { ...(state.collected_data || {}), form_preference: form };
    await setState(phone, lead.id, {
      flow_step: 'recommended', collected_data: data, ai_mode: true
    });

    // Generate AI recommendation
    const recommendation = await generateRecommendation(data, lang, lead);
    await sendMessage(phone, recommendation);
    await saveOutgoing(lead.id, phone, recommendation, io);

    // Update lead stage to Qualified
    const { data: stage } = await supabase.from('lead_stages').select('id').eq('name', 'Qualified').single();
    if (stage) await supabase.from('leads').update({ stage_id: stage.id }).eq('id', lead.id);

    return true;
  }

  // ── FALLBACK — switch to AI ──
  await setState(phone, lead.id, { ai_mode: true });
  return false;
}

// ─── CHECK IF SHOULD USE FLOW ─────────────────────────────────────────────────
async function shouldUseFlow(phone) {
  const state = await getState(phone);
  // Use flow if: no state, welcome step, or active flow step (not ai_mode, not done)
  if (!state) return true;
  if (state.ai_mode) return false;
  if (state.escalated && state.flow_step !== 'call_time') return false;
  if (state.flow_step === 'done') return false;
  return true;
}

module.exports = { processFlow, shouldUseFlow, getState, setState, notifyAgent, MESSAGES };
