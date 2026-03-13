const https = require('https');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = 'llama-3.1-8b-instant';

async function callGroq(prompt) {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY not set in Railway variables');

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 250,
      temperature: 0.7
    });

    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      timeout: 25000, // 25 second timeout
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error.message || JSON.stringify(json.error)));
          const text = json.choices?.[0]?.message?.content;
          if (text) resolve(text.trim());
          else reject(new Error('No response from Groq: ' + data));
        } catch (e) { reject(e); }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Groq request timed out'));
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

  const prompt = `You are a WhatsApp business assistant. Give a SHORT reply (2-3 sentences max).

BUSINESS: ${businessContext || 'A professional business.'}

RULES:
- Reply in the SAME language as the customer
- Gujarati in → Gujarati out, Hindi in → Hindi out, English in → English out
- Short and friendly reply only
- No bullet points, no asterisks
- Do not say you are AI
${customerName ? `- Customer: ${customerName}` : ''}

${historyText ? `CHAT HISTORY:\n${historyText}\n` : ''}
CUSTOMER MESSAGE: ${customerMessage}
YOUR REPLY:`;

  return await callGroq(prompt);
}

async function summarizeConversation(messages) {
  const text = messages.map(m =>
    `${m.direction === 'incoming' ? 'Customer' : 'Agent'}: ${m.content}`
  ).join('\n');
  const prompt = `Summarize this WhatsApp conversation in 2-3 bullet points:\n\n${text}\n\nSummary:`;
  return await callGroq(prompt);
}

module.exports = { generateReply, summarizeConversation };
