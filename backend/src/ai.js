const https = require('https');

// Groq is free - 14,400 requests/day, very fast
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = 'llama-3.1-8b-instant'; // Free Groq model

async function callGroq(prompt) {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY not set in Railway variables');

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7
    });

    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
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

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function generateReply({ customerMessage, businessContext, conversationHistory = [], customerName = '' }) {
  const historyText = conversationHistory.slice(-4).map(m =>
    `${m.direction === 'incoming' ? 'Customer' : 'Business'}: ${m.content}`
  ).join('\n');

  const prompt = `You are a helpful WhatsApp business assistant. Reply to the customer message.

BUSINESS INFO:
${businessContext || 'A professional business. Be helpful, polite and concise.'}

RULES:
- Detect language from customer message and reply in SAME language
- If Gujarati message → reply in Gujarati
- If Hindi message → reply in Hindi
- If English message → reply in English
- Keep reply short: 2-4 sentences only
- Be warm and professional
- No markdown, no asterisks, no bullet points
- Don't say you are AI
${customerName ? `- Customer name: ${customerName}` : ''}

${historyText ? `RECENT CHAT:\n${historyText}\n` : ''}

CUSTOMER: ${customerMessage}

Reply:`;

  return await callGroq(prompt);
}

async function summarizeConversation(messages) {
  const text = messages.map(m =>
    `${m.direction === 'incoming' ? 'Customer' : 'Agent'}: ${m.content}`
  ).join('\n');

  const prompt = `Summarize this WhatsApp business conversation in 2-3 bullet points. Be concise:\n\n${text}\n\nSummary:`;
  return await callGroq(prompt);
}

module.exports = { generateReply, summarizeConversation };
