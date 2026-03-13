const https = require('https');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.0-flash'; // Free tier model

async function callGemini(prompt) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 300,
      }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) resolve(text.trim());
          else reject(new Error('No response from Gemini: ' + data));
        } catch (e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function generateReply({ customerMessage, businessContext, conversationHistory = [], customerName = '' }) {
  const historyText = conversationHistory.slice(-4).map(m =>
    `${m.direction === 'incoming' ? 'Customer' : 'Business'}: ${m.content}`
  ).join('\n');

  const prompt = `You are a helpful business WhatsApp assistant. Reply to the customer message below.

BUSINESS INFORMATION:
${businessContext || 'A professional business. Be helpful, polite and concise.'}

INSTRUCTIONS:
- Detect the language of the customer message and reply in the SAME language
- If customer writes in Gujarati, reply in Gujarati
- If customer writes in Hindi, reply in Hindi  
- If customer writes in English, reply in English
- Keep replies short (2-4 sentences max)
- Be warm, professional and helpful
- Do NOT use markdown formatting
- Do NOT mention you are an AI
- Sign off as the business, not as "AI"
${customerName ? `- Customer name is: ${customerName}` : ''}

${historyText ? `RECENT CONVERSATION:\n${historyText}\n` : ''}

CUSTOMER MESSAGE: ${customerMessage}

Reply:`;

  return await callGemini(prompt);
}

async function summarizeConversation(messages) {
  const text = messages.map(m =>
    `${m.direction === 'incoming' ? 'Customer' : 'Agent'}: ${m.content}`
  ).join('\n');

  const prompt = `Summarize this WhatsApp business conversation in 2-3 bullet points. Be concise:

${text}

Summary:`;

  return await callGemini(prompt);
}

module.exports = { generateReply, summarizeConversation, callGemini };
