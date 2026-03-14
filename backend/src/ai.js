const https = require('https');
const supabase = require('./supabase');

const GROQ_KEY   = process.env.GROQ_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
let groqFails = 0;
let geminiFails = 0;

// ─── COMPLETE DHWAKAT HERBAL KNOWLEDGE BASE — ALL 40 PRODUCTS ────────────────
const DHWAKAT_KB = `
BUSINESS: Dhwakat Herbal
Owner: Shreyas Ramani | Surat, Gujarat | Manufacturing: Haryana
Order WhatsApp: 9023935773

COMPLETE PRODUCT LIST BY HEALTH CONDITION:
Depression / Stress / Anxiety → Manoveda (Syrup, Tablet/Capsule)
Sleep Problems / Insomnia → ShayanVeda (Syrup, Tablet/Capsule)
Migraine / Headache → Shiroveda (Syrup, Tablet/Capsule, Oil)
Brain / Memory / Focus → Smritiveda (Syrup, Tablet/Capsule), Brahmi Powder, Ashwagandha
Allergy → Allergy-GO (Syrup, Tablet/Capsule)
Weak Immunity → Immuno Plus (Syrup, Tablet/Capsule), Amla Powder, Neem Powder
Frequent Cold / Cough / Respiratory → Shwasveda (Syrup, Tablet/Capsule, Oil)
Cholesterol → Hridayaveda (Syrup, Tablet/Capsule)
Blood Pressure → RaktaSneha (Syrup, Tablet/Capsule)
Diabetes / Blood Sugar → GlucoVeda (Syrup, Tablet/Capsule, Powder)
Weight Loss → MedoharMukta (Syrup, Tablet/Capsule, Powder)
Weight Gain → Poshakveda (Syrup, Tablet/Capsule, Powder)
Acidity / Gas / Bloating → Agnimukta (Syrup, Tablet/Capsule, Powder)
Constipation → Rechaka Veda (Syrup, Tablet/Capsule, Powder), Ishabgool Powder, Harad Powder, Tripha Powder
Piles / Fissure → GudaShanti (Syrup, Tablet/Capsule)
Liver Detox → Yakritshuddhi (Syrup, Tablet/Capsule)
Detox / Blood Purifier → Raktaveda (Syrup, Tablet/Capsule)
Acne / Pimples → AcnoVeda (Syrup, Tablet/Capsule), Neem Powder
Skin Glow / Skin Care → NikharVeda (Syrup, Tablet/Capsule, Powder)
Hair Fall / Hair Growth → RomaVardhak (Syrup, Tablet/Capsule, Oil)
PCOS / PCOD → Feminoveda (Syrup, Tablet/Capsule)
Period Pain / Menstrual Pain → Ritushanti (Syrup, Tablet/Capsule)
Iron Deficiency / Anemia → Lohaveda (Syrup, Tablet/Capsule)
Sexual Wellness (Women) → Vajraveda (Syrup, Tablet/Capsule, Powder, Oil)
Sexual Wellness / Vitality (Men) → Vajraveda, Shilajit Cap (Tablet/Capsule), Musli Powder, Ashwagandha (Tablet/Capsule, Powder)
De-addiction / Withdrawal → Manomukta (Syrup, Tablet/Capsule)
Joint Pain / Arthritis → Sandhiveda (Syrup, Tablet/Capsule, Powder, Oil), Moringa Powder
Kidney / Renal Stone → GO_Lith (Syrup, Tablet/Capsule)
Energy / Vitality / Overall Wellness → Satvik Multivita (Syrup, Tablet/Capsule, Powder), Lohaveda

HERB COLLECTION (Single Herbs):
Ashwagandha — Stress, Vitality, Sexual Wellness, Brain Health (Tablet/Capsule, Powder)
Shilajit — Stamina, Sexual Wellness, Energy (Tablet/Capsule)
Amla — Immunity, Vitamin C, Skin (Powder)
Brahmi — Memory, Brain, Cognition (Powder)
Neem — Skin Purification, Immunity (Powder)
Musli (Safed Musli) — Sexual Wellness, Strength (Powder)
Ishabgool (Psyllium Husk) — Constipation, Digestion (Powder)
Harad (Terminalia Chebula) — Constipation, Digestion (Powder)
Moringa — Joint Support, Anti-inflammatory, Nutrition (Powder)
Tripha (Triphala) — Constipation, Digestive Detox (Powder)

PRODUCT FORMS:
Syrup — Easy to consume, quick absorption, good for elderly and children
Tablet/Capsule — Convenient, pre-measured, best for busy lifestyle
Powder — Traditional form, mix with water/milk/honey
Oil — External use for joints, headache, hair, massage

CONVERSATION RULES:
1. First ask what health problem the customer has
2. Only after knowing the problem → recommend the right product
3. Mention: available in Syrup/Tablet/Capsule/Powder/Oil (whichever applies)
4. For ordering → tell them to WhatsApp on 9023935773
5. Never mention price or GMP or Ayush certification
6. Never say you are AI
`;

// ─── CHECK IF AI IS PAUSED FOR THIS PHONE ────────────────────────────────────
async function isAIPaused(phone) {
  try {
    const { data } = await supabase
      .from('leads')
      .select('ai_paused')
      .eq('phone', phone)
      .single();
    return data?.ai_paused === true;
  } catch { return false; }
}

// ─── CUSTOMER MEMORY ─────────────────────────────────────────────────────────
async function getCustomerMemory(phone) {
  try {
    // Only return memory from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data } = await supabase
      .from('customer_memory')
      .select('*')
      .eq('phone', phone)
      .gte('last_updated', thirtyDaysAgo.toISOString())
      .single();
    return data || null;
  } catch { return null; }
}

async function updateCustomerMemory(phone, leadId, updates) {
  try {
    const existing = await getCustomerMemory(phone);
    if (!existing) {
      await supabase.from('customer_memory').upsert({
        phone,
        lead_id: leadId,
        health_concerns: updates.health_concerns || [],
        products_recommended: updates.products_recommended || [],
        preferences: updates.preferences || {},
        order_history: updates.order_history || [],
        conversation_summary: updates.conversation_summary || '',
        last_updated: new Date().toISOString(),
        created_at: new Date().toISOString()
      }, { onConflict: 'phone' });
    } else {
      await supabase.from('customer_memory').update({
        health_concerns: mergeUnique(existing.health_concerns || [], updates.health_concerns || []),
        products_recommended: mergeUnique(existing.products_recommended || [], updates.products_recommended || []),
        preferences: { ...(existing.preferences || {}), ...(updates.preferences || {}) },
        order_history: mergeUnique(existing.order_history || [], updates.order_history || []),
        conversation_summary: updates.conversation_summary || existing.conversation_summary || '',
        last_updated: new Date().toISOString()
      }).eq('phone', phone);
    }
  } catch (e) { console.log('Memory update error:', e.message); }
}

function mergeUnique(a, b) { return [...new Set([...a, ...b])]; }

function formatMemoryForPrompt(memory) {
  if (!memory) return '';
  const parts = [];
  if (memory.preferences?.name) parts.push(`Customer name: ${memory.preferences.name}`);
  if (memory.health_concerns?.length) parts.push(`Previously mentioned health concerns: ${memory.health_concerns.join(', ')}`);
  if (memory.products_recommended?.length) parts.push(`Products recommended before: ${memory.products_recommended.join(', ')}`);
  if (memory.order_history?.length) parts.push(`Order history: ${memory.order_history.join(', ')}`);
  if (memory.conversation_summary) parts.push(`Previous chat summary: ${memory.conversation_summary}`);
  return parts.length ? `\nCUSTOMER HISTORY (last 30 days):\n${parts.join('\n')}\n` : '';
}

// ─── EXTRA KNOWLEDGE BASE ─────────────────────────────────────────────────────
async function getExtraKnowledge() {
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', 'ai_knowledge_base').single();
    return data?.value?.content || '';
  } catch { return ''; }
}

// ─── GROQ API ─────────────────────────────────────────────────────────────────
async function callGroq(prompt) {
  if (!GROQ_KEY) throw new Error('GROQ_API_KEY not set');
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.6
    });
    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      timeout: 20000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error('Groq: ' + json.error.message));
          const text = json.choices?.[0]?.message?.content;
          if (text) { groqFails = 0; resolve(text.trim()); }
          else reject(new Error('Groq: empty response'));
        } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Groq timeout')); });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

// ─── GEMINI API ───────────────────────────────────────────────────────────────
async function callGemini(prompt) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not set');
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 300 }
    });
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_KEY}`,
      method: 'POST',
      timeout: 20000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error('Gemini: ' + json.error.message));
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) { geminiFails = 0; resolve(text.trim()); }
          else reject(new Error('Gemini: empty response'));
        } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Gemini timeout')); });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

// ─── SMART API ROUTER ─────────────────────────────────────────────────────────
async function callAI(prompt) {
  if (groqFails < 3) {
    try {
      const r = await callGroq(prompt);
      console.log('✅ AI via Groq');
      return r;
    } catch (e) {
      groqFails++;
      console.log(`⚠️ Groq failed (${groqFails}/3): ${e.message} → trying Gemini`);
    }
  }
  if (geminiFails < 3) {
    try {
      const r = await callGemini(prompt);
      console.log('✅ AI via Gemini');
      groqFails = 0;
      return r;
    } catch (e) {
      geminiFails++;
      console.log(`⚠️ Gemini failed (${geminiFails}/3): ${e.message}`);
    }
  }
  groqFails = 0; geminiFails = 0;
  throw new Error('Both AI providers unavailable. Please try again shortly.');
}

// ─── EXTRACT & SAVE MEMORY FROM CONVERSATION ─────────────────────────────────
async function extractAndSaveMemory(phone, leadId, customerMessage, aiReply) {
  try {
    const extractPrompt = `Extract structured data from this conversation as JSON only. No explanation.

Customer: "${customerMessage}"
Assistant: "${aiReply}"

Return ONLY this JSON:
{
  "health_concerns": ["any health conditions mentioned"],
  "products_recommended": ["any Dhwakat Herbal products mentioned"],
  "preferences": {"form": "syrup/tablet/powder/oil if mentioned", "language": "gujarati/hindi/english"},
  "order_intent": "yes/no/maybe",
  "summary": "one line summary"
}`;

    const raw = await callAI(extractPrompt);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return;
    const extracted = JSON.parse(match[0]);
    await updateCustomerMemory(phone, leadId, {
      health_concerns: extracted.health_concerns || [],
      products_recommended: extracted.products_recommended || [],
      preferences: extracted.preferences || {},
      order_history: extracted.order_intent === 'yes' ? [`Interested - ${new Date().toLocaleDateString('en-IN')}`] : [],
      conversation_summary: extracted.summary || ''
    });
  } catch (e) { console.log('Memory extraction (non-critical):', e.message); }
}

// ─── MAIN GENERATE REPLY ──────────────────────────────────────────────────────
async function generateReply({ customerMessage, businessContext, conversationHistory = [], customerName = '', phone = '', leadId = '' }) {

  // Check if AI is paused for this number
  if (phone && await isAIPaused(phone)) {
    throw new Error('AI_PAUSED');
  }

  const memory = phone ? await getCustomerMemory(phone) : null;
  const extraKnowledge = await getExtraKnowledge();
  const memoryText = formatMemoryForPrompt(memory);
  const customerNameFinal = memory?.preferences?.name || customerName;

  const historyText = conversationHistory.slice(-6).map(m =>
    `${m.direction === 'incoming' ? 'Customer' : 'Dhwakat'}: ${m.content}`
  ).join('\n');

  const prompt = `You are Dhwakat Herbal's friendly WhatsApp sales assistant. Your job is to understand the customer's health problem and recommend the right Dhwakat Herbal product.

${DHWAKAT_KB}
${extraKnowledge ? `\nEXTRA KNOWLEDGE:\n${extraKnowledge}` : ''}
${businessContext ? `\nBUSINESS NOTES:\n${businessContext}` : ''}
${memoryText}
${customerNameFinal ? `Customer name: ${customerNameFinal}` : ''}

LANGUAGE RULE — MOST IMPORTANT:
- Carefully read what language the customer is writing in
- If customer writes in Gujarati script → your ENTIRE reply must be in Gujarati only
- If customer writes in Hindi script → your ENTIRE reply must be in Hindi only
- If customer writes in English → your ENTIRE reply must be in English only
- DO NOT write the reply in two languages
- DO NOT add English translation after Gujarati reply
- ONE language per reply, matching exactly what the customer wrote

CONVERSATION LOGIC:
Step 1 — If customer says hi/hello/namaste or general greeting → warmly greet them and ask: "Tamne koi health problem che? (Your health concern?)"
Step 2 — If customer describes a health problem → recommend the correct product from the list above. Say product name, available form (Syrup/Tablet/Powder/Oil)
Step 3 — After recommending → say "Order karva mate WhatsApp karo: 9023935773"
Step 4 — If customer asks which form is better → guide them based on their lifestyle

PRODUCT RECOMMENDATION EXAMPLES:
- Maansik bimari / stress / anxiety / depression → Manoveda (Syrup, Tablet/Capsule)
- Uchi / uchhi uchhi uchti hova / insomnia / suvani takleef → ShayanVeda
- Vajan utharvanu / weight loss → MedoharMukta
- Diabetes / sugar → GlucoVeda
- BP / blood pressure → RaktaSneha
- Vaal padva / hair fall → RomaVardhak
- PCOS / periods / mahavari → Feminoveda / Ritushanti
- Joints / gathiya / sandhi / jangh → Sandhiveda
- Acidity / gas → Agnimukta
- Immunity / khansari / sardi → Immuno Plus / Shwasveda

STRICT RULES:
- Maximum 3-4 sentences only, keep it SHORT
- NEVER mention any price
- NEVER mention GMP or Ayush or certification
- Do NOT say you are AI or bot
- Use simple conversational language, like a friend helping
- Always be warm and caring

${historyText ? `RECENT CONVERSATION:\n${historyText}\n` : ''}
CUSTOMER MESSAGE: ${customerMessage}

REPLY (in same language as customer, max 4 sentences):`;

  const reply = await callAI(prompt);

  // Clean any garbled characters from reply
  const cleanReply = reply
    .replace(/[◆◇●○■□▲△▼▽★☆♦♠♣♥]/g, '')
    .replace(/\[.*?reply\]/gi, '')
    .trim();

  // Save memory in background
  if (phone && leadId) {
    extractAndSaveMemory(phone, leadId, customerMessage, cleanReply).catch(() => {});
  }

  return cleanReply;
}

async function summarizeConversation(messages) {
  const text = messages.map(m =>
    `${m.direction === 'incoming' ? 'Customer' : 'Agent'}: ${m.content}`
  ).join('\n');
  const prompt = `Summarize this Dhwakat Herbal WhatsApp conversation in 3 bullet points. Focus on health concerns, products discussed, customer intent.\n\n${text}\n\nSummary:`;
  return await callAI(prompt);
}

module.exports = { generateReply, summarizeConversation, getCustomerMemory, updateCustomerMemory, isAIPaused };
