// api/chat.js
export default async function handler(req, res) {
  try {
    // Parse request body (the front end sends { messages })
    const { messages = [] } = await req.json?.() || req.body || {};

    // Call Groq API
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.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}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages,
        temperature: 0.3
      })
    });

    const out = await r.json();
    const reply = out?.choices?.[0]?.message?.content || 'No reply';
    res.status(200).json({ reply });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
