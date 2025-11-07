// api/chat.js
export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    if (req.method === 'OPTIONS' || req.method === 'GET') {
      return new Response(JSON.stringify({ ok: true, method: req.method }), {
        headers: { 'content-type': 'application/json' },
        status: req.method === 'GET' ? 405 : 204
      });
    }
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        headers: { 'content-type': 'application/json' }, status: 405
      });
    }

    const { messages = [], temperature = 0.3, max_tokens = 700 } = await req.json();

    const hasKey = !!(process.env.GROQ_API_KEY && String(process.env.GROQ_API_KEY).length > 10);

    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY || ''}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages,
        temperature,
        max_tokens
      })
    });

    const groqText = await r.text(); // read once
    let parsed;
    try { parsed = JSON.parse(groqText); } catch { parsed = null; }

    if (!r.ok) {
      return new Response(JSON.stringify({
        error: 'Groq error',
        hasKey,
        status: r.status,
        body: groqText.slice(0, 1000) // truncate for safety
      }), { headers: { 'content-type': 'application/json' }, status: 502 });
    }

    const reply = parsed?.choices?.[0]?.message?.content;
    if (!reply) {
      return new Response(JSON.stringify({
        error: 'Empty reply',
        hasKey,
        status: r.status,
        body: groqText.slice(0, 1000)
      }), { headers: { 'content-type': 'application/json' }, status: 500 });
    }

    return new Response(JSON.stringify({ reply }), {
      headers: { 'content-type': 'application/json' }, status: 200
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      headers: { 'content-type': 'application/json' }, status: 500
    });
  }
}
