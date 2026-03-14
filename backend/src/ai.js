const https = require('https');
const supabase = require('./supabase');

// ─── API KEYS ─────────────────────────────────────────────────────────────────
const GROQ_KEY    = process.env.GROQ_API_KEY;
const GEMINI_KEY  = process.env.GEMINI_API_KEY;

let groqFails   = 0;
let geminiFails = 0;

// ─── DHWAKAT HERBAL FULL KNOWLEDGE BASE ──────────────────────────────────────
const DHWAKAT_KB = `
BUSINESS IDENTITY:
Name: Dhwakat Herbal
Owner: Shreyas Ramani
City: Surat, Gujarat
Manufacturing: Haryana
Certifications: GMP Certified + Ayush Ministry Certified
Products: 40+ Ayurvedic products across 18+ wellness categories
Price: All products under ₹500
Delivery: Free on prepaid (3-4 days) | COD available (5-7 days) | Pan-India

BRAND VALUES:
- Ancient family recipes passed through generations
- 100% natural, no harsh chemicals, no side effects
- Affordable premium Ayurveda for every Indian family
- Warm, helpful, trustworthy communication

PRODUCTS BY HEALTH CONDITION:
Stress/Anxiety/Depression → Manoveda (Syrup, Tablet/Capsule)
Sleep Problems/Insomnia → ShayanVeda (Syrup, Tablet/Capsule)
Migraine/Headache → Shiroveda (Syrup, Tablet/Capsule, Oil)
Brain/Memory/Focus → Smritiveda (Syrup, Tablet/Capsule), Brahmi Powder, Ashwagandha Cap
Immunity Boost → Immuno Plus (Syrup, Tablet/Capsule), Amla Powder, Neem Powder
Allergy → Allergy-GO (Syrup, Tablet/Capsule)
Cold/Cough/Respiratory → Shwasveda (Syrup, Tablet/Capsule, Oil)
Cholesterol → Hridayaveda (Syrup, Tablet/Capsule)
Blood Pressure → RaktaSneha (Syrup, Tablet/Capsule)
Diabetes/Blood Sugar → GlucoVeda (Syrup, Tablet/Capsule, Powder)
Weight Loss → MedoharMukta (Syrup, Tablet/Capsule, Powder)
Weight Gain → Poshakveda (Syrup, Tablet/Capsule, Powder)
Acidity/Gas/Bloating → Agnimukta (Syrup, Tablet/Capsule, Powder)
Constipation → Rechaka Veda (Syrup, Tablet/Capsule), Ishabgool Powder
Piles/Fissure → GudaShanti (Syrup, Tablet/Capsule)
Blood Purification/Detox → Raktaveda (Syrup, Tablet/Capsule)
Liver Detox → Yakritshuddhi (Syrup, Tablet/Capsule)
Acne/Pimples → AcnoVeda (Syrup, Tablet/Capsule)
Skin Glow/Care → NikharVeda (Syrup, Tablet/Capsule, Powder)
Hair Fall/Growth → RomaVardhak (Syrup, Tablet/Capsule, Oil)
PCOS/PCOD → Feminoveda (Syrup, Tablet/Capsule)
Period Pain → Ritushanti (Syrup, Tablet/Capsule)
Iron Deficiency/Anemia → Lohaveda (Syrup, Tablet/Capsule)
Women's Sexual Wellness → Vajraveda (Syrup, Tablet/Capsule, Powder, Oil)
Men's Sexual Wellness/Vitality → Vajraveda, Shilajit Cap, Musli Powder, Ashwagandha Powder
Stamina/Energy/Vitality → Satvik Multivita (Syrup, Tablet/Capsule, Powder), Lohaveda
Joint Pain/Arthritis → Sandhiveda (Syrup, Tablet/Capsule, Powder, Oil), Moringa Powder
Kidney/Renal Stone → GO_Lith (Syrup, Tablet/Capsule)
De-addiction/Withdrawal → Manomukta (Syrup, Tablet/Capsule)
Digestive Detox → Triphala Powder
General Wellness → Satvik Multivita, Moringa Powder

PRODUCT FORMS GUIDE:
- Powder (Churna): Traditional, mix with water/milk/honey, flexible dosing
- Syrup (Arka): Easy consumption, quick absorption, good for elderly/children
- Tablet/Capsule (Vati): Convenient, pre-measured, best for busy people
- Oil (Taila): External application for joints, headache, hair, massage

CONVERSATION FLOW:
1. Greet warmly, ask health concern
2. Listen for: condition, age group, preferred form, allergies
3. Recommend by condition → product name → available forms → price under ₹500
4. Build trust: mention GMP+Ayush certified, ancient recipes, natural
5. Close: free delivery on prepaid, COD available, pan-India

IMPORTANT DISCLAIMERS (use when relevant):
- These are Ayurvedic wellness supplements, not replacement for medical treatment
- For serious/chronic conditions, consult your doctor alongside our products
- Individual results may vary; consistent use with healthy lifestyle gives best results
- Products do not cure diseases; they support natural wellness

SAMPLE RESPONSES:
- Stress query: Recommend Manoveda + ShayanVeda if also sleep issue
- PCOS query: Recommend Feminoveda + Ritushanti together
- Diabetes + BP: Recommend GlucoVeda + RaktaSneha (advise doctor consultation)
- Price question: All under ₹500, free delivery on prepaid
- Efficacy question: GMP certified, ancient recipes, natural ingredients
`;

// ─── CUSTOMER MEMORY ─────────────────────────────────────────────────────────
async function getCustomerMemory(phone) {
  try {
    const { data } = await supabase
      .from('customer_memory')
      .select('*')
      .eq('phone', phone)
      .single();
    return data || null;
  } catch { return null; }
}

async function updateCustomerMemory(phone, leadId, updates) {
  try {
    const existing = await getCustomerMemory(phone);
    if (!existing) {
      // Create new memory record
      await supabase.from('customer_memory').insert({
        phone,
        lead_id: leadId,
        health_concerns: updates.health_concerns || [],
        products_recommended: updates.products_recommended || [],
        preferences: updates.preferences || {},
        order_history: updates.order_history || [],
        conversation_summary: updates.conversation_summary || '',
        last_updated: new Date().toISOString()
      });
    } else {
      // Update existing — merge arrays, don't replace
      const merged = {
        health_concerns: mergeUnique(existing.health_concerns || [], updates.health_concerns || []),
        products_recommended: mergeUnique(existing.products_recommended || [], updates.products_recommended || []),
        preferences: { ...(existing.preferences || {}), ...(updates.preferences || {}) },
        order_history: mergeUnique(existing.order_history || [], updates.order_history || []),
        conversation_summary: updates.conversation_summary || existing.conversation_summary || '',
        last_updated: new Date().toISOString()
      };
      await supabase.from('customer_memory').update(merged).eq('phone', phone);
    }
  } catch (e) { console.error('Memory update error:', e.message); }
}

function mergeUnique(arr1, arr2) {
  return [...new Set([...arr1, ...arr2])];
}

function formatMemoryForPrompt(memory) {
  if (!memory) return '';
  const parts = [];
  if (memory.preferences?.name) parts.push(`Customer name: ${memory.preferences.name}`);
  if (memory.health_concerns?.length) parts.push(`Known health concerns: ${memory.health_concerns.join(', ')}`);
  if (memory.products_recommended?.length) parts.push(`Previously recommended: ${memory.products_recommended.join(', ')}`);
  if (memory.order_history?.length) parts.push(`Order history: ${memory.order_history.join(', ')}`);
  if (memory.conversation_summary) parts.push(`Previous conversation summary: ${memory.conversation_summary}`);
  return parts.length ? `\nCUSTOMER MEMORY:\n${parts.join('\n')}\n` : '';
}

// ─── EXTRA KNOWLEDGE BASE (uploaded docs) ────────────────────────────────────
async function getExtraKnowledge() {
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'ai_knowledge_base')
      .single();
    return data?.value?.content || '';
  } catch { return ''; }
}

// ─── GROQ API CALL ────────────────────────────────────────────────────────────
async function callGroq(prompt) {
  if (!GROQ_KEY) throw new Error('GROQ_API_KEY not set');
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 350,
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
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error('Groq: ' + (json.error.message || JSON.stringify(json.error))));
          const text = json.choices?.[0]?.message?.content;
          if (text) { groqFails = 0; resolve(text.trim()); }
          else reject(new Error('Groq: no response'));
        } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Groq timeout')); });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

// ─── GEMINI API CALL ──────────────────────────────────────────────────────────
async function callGemini(prompt) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not set');
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 350 }
    });
    const path = `/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_KEY}`;
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path, method: 'POST', timeout: 20000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error('Gemini: ' + (json.error.message || JSON.stringify(json.error))));
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) { geminiFails = 0; resolve(text.trim()); }
          else reject(new Error('Gemini: no response'));
        } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Gemini timeout')); });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

// ─── SMART API ROUTER — auto-switch on failure ────────────────────────────────
async function callAI(prompt) {
  // Try Groq first (faster), switch to Gemini on failure
  if (groqFails < 3) {
    try {
      const result = await callGroq(prompt);
      console.log('✅ AI reply via Groq');
      return result;
    } catch (e) {
      groqFails++;
      console.log(`⚠️ Groq failed (${groqFails}/3): ${e.message} — trying Gemini...`);
    }
  }

  // Fallback to Gemini
  if (geminiFails < 3) {
    try {
      const result = await callGemini(prompt);
      console.log('✅ AI reply via Gemini');
      groqFails = 0; // reset groq counter after successful gemini
      return result;
    } catch (e) {
      geminiFails++;
      console.log(`⚠️ Gemini failed (${geminiFails}/3): ${e.message}`);
    }
  }

  // Both failed — reset counters for next attempt
  groqFails = 0; geminiFails = 0;
  throw new Error('Both AI providers unavailable. Please try again shortly.');
}

// ─── EXTRACT MEMORY FROM CONVERSATION ────────────────────────────────────────
async function extractAndSaveMemory(phone, leadId, customerMessage, aiReply) {
  try {
    const extractPrompt = `From this conversation, extract structured data as JSON only. No explanation.

Customer message: "${customerMessage}"
AI reply: "${aiReply}"

Extract:
{
  "health_concerns": ["list any health conditions mentioned"],
  "products_recommended": ["list any Dhwakat Herbal products mentioned in AI reply"],
  "preferences": {"form": "syrup/tablet/powder/oil if mentioned", "language": "detected language"},
  "order_intent": "yes/no/maybe - did customer show interest in buying?",
  "summary": "1 sentence summary of this interaction"
}

Return ONLY valid JSON:`;

    const raw = await callAI(extractPrompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const extracted = JSON.parse(jsonMatch[0]);
    await updateCustomerMemory(phone, leadId, {
      health_concerns: extracted.health_concerns || [],
      products_recommended: extracted.products_recommended || [],
      preferences: extracted.preferences || {},
      order_history: extracted.order_intent === 'yes' ? [`Interested - ${new Date().toLocaleDateString('en-IN')}`] : [],
      conversation_summary: extracted.summary || ''
    });
  } catch (e) {
    console.log('Memory extraction error (non-critical):', e.message);
  }
}

// ─── MAIN GENERATE REPLY FUNCTION ────────────────────────────────────────────
async function generateReply({ customerMessage, businessContext, conversationHistory = [], customerName = '', phone = '', leadId = '' }) {
  // Get customer memory
  const memory = phone ? await getCustomerMemory(phone) : null;

  // Get extra knowledge (uploaded docs)
  const extraKnowledge = await getExtraKnowledge();

  // Build conversation history text
  const historyText = conversationHistory.slice(-5).map(m =>
    `${m.direction === 'incoming' ? 'Customer' : 'Dhwakat Assistant'}: ${m.content}`
  ).join('\n');

  const memoryText = formatMemoryForPrompt(memory);
  const customerNameFromMemory = memory?.preferences?.name || customerName;

  const prompt = `You are Dhwakat Herbal's WhatsApp AI assistant. Reply to the customer helpfully.

${DHWAKAT_KB}
${extraKnowledge ? `\nADDITIONAL KNOWLEDGE:\n${extraKnowledge}` : ''}
${businessContext ? `\nBUSINESS NOTES:\n${businessContext}` : ''}
${memoryText}

LANGUAGE RULES (VERY IMPORTANT):
- Detect the language of the customer's message
- If customer writes in Gujarati → reply FULLY in Gujarati
- If customer writes in Hindi → reply FULLY in Hindi  
- If customer writes in English → reply FULLY in English
- If mixed → match their primary language
${customerNameFromMemory ? `\nCustomer name: ${customerNameFromMemory}` : ''}

REPLY RULES:
- Keep reply to 3-5 sentences maximum
- Always recommend specific product name for health concerns
- Mention price under ₹500 and free delivery on prepaid
- No markdown, no asterisks, no bullet points in reply
- Do NOT say you are AI
- Be warm like a helpful friend

${historyText ? `RECENT CONVERSATION:\n${historyText}\n` : ''}
CUSTOMER: ${customerMessage}

REPLY:`;

  const reply = await callAI(prompt);

  // Save memory in background (don't await to avoid slowing reply)
  if (phone && leadId) {
    extractAndSaveMemory(phone, leadId, customerMessage, reply).catch(() => {});
  }

  return reply;
}

// ─── SUMMARIZE CONVERSATION ───────────────────────────────────────────────────
async function summarizeConversation(messages) {
  const text = messages.map(m =>
    `${m.direction === 'incoming' ? 'Customer' : 'Agent'}: ${m.content}`
  ).join('\n');
  const prompt = `Summarize this Dhwakat Herbal WhatsApp conversation in 3 bullet points. Focus on: health concerns, products discussed, customer intent.\n\n${text}\n\nSummary:`;
  return await callAI(prompt);
}

module.exports = { generateReply, summarizeConversation, getCustomerMemory, updateCustomerMemory };
