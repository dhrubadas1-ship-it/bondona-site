// api/chat.js
export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    // Allow OPTIONS/GET probes
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

    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.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}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages,
        temperature,
        max_tokens
      })
    });

    if (!r.ok) {
      const text = await r.text();
      return new Response(JSON.stringify({ error: 'Groq error', detail: text }), {
        headers: { 'content-type': 'application/json' }, status: 502
      });
    }

    const out = await r.json();
    const reply = out?.choices?.[0]?.message?.content;
    if (!reply) {
      return new Response(JSON.stringify({ error: 'Empty reply', detail: out }), {
        headers: { 'content-type': 'application/json' }, status: 500
      });
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
