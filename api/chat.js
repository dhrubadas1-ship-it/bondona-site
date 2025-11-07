// api/chat.js — Node.js Serverless with CORS + Science-only guard + kid-friendly tone
// Vercel will run this as a serverless function.
// Make sure Vercel env has: GROQ_API_KEY = gsk_...

export const config = { runtime: 'nodejs18.x' };

// ---------- helpers ----------
function send(res, status, data) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(status).json(data);
}

// ❶ STRICT SYSTEM PROMPT
//   - Scope: only Class 9 Science (NCERT/CBSE)
//   - Style: very simple words, short sentences, suitable for ~5-year-old understanding
const SYSTEM_PROMPT = `
You are "Bondona Tutor", a friendly teacher.
You ONLY help with CBSE Class 9 Science topics (Physics, Chemistry, Biology) from the NCERT syllabus:
- Physics: Motion, Force & Laws, Gravitation, Work & Energy, Sound.
- Chemistry: Matter in Our Surroundings; Is Matter Around Us Pure?; Atoms & Molecules; Structure of the Atom.
- Biology: The Fundamental Unit of Life; Tissues; Improvement in Food Resources.

STYLE (very important):
- Use very simple words and short sentences (about 10–12 words).
- Talk kindly, like to a 5-year-old. Be warm, patient, calm.
- Explain step by step. Use daily-life examples (ball, bucket, swing, rain, food).
- If a hard word appears, add a tiny meaning line: "Word: simple meaning."
- Use lists and tiny steps. No emojis. No slang.
- After the explanation, give a tiny 3–4 question quiz with simple choices.
- Be safe and age-appropriate. No medical/legal/financial advice. No hacking or adult content.

BEHAVIOR:
- If the user asks off-topic (not the above chapters), kindly refuse and suggest a topic from the list.
`;

// ❷ LIGHTWEIGHT ALLOWLIST (covers common chapter keywords)
const ALLOWED = [
  'matter','solid','liquid','gas','evaporation','condensation','sublimation','mixture','solution','distillation','chromatography',
  'element','compound','atom','molecule','mole','atomic mass','molar mass','valency','valence','isotope','isobar',
  'structure of atom','bohr','rutherford','thomson','electron','proton','neutron','electronic configuration','shell','orbital',
  'cell','cell wall','cell membrane','nucleus','mitochondria','chloroplast','osmosis','diffusion','tissue','xylem','phloem','epithelial',
  'force','newton','inertia','momentum','friction','work','energy','power','kinetic','potential','gravitation','gravity','free fall','buoyancy',
  'sound','frequency','amplitude','wavelength','echo','speed of sound','rarefaction','compression','intensity',
  'food resources','crop','manure','fertilizer','irrigation','pest','poultry','dairy'
].map(s => s.toLowerCase());

function looksAllowed(userText = '') {
  const t = String(userText || '').toLowerCase();
  if (!t.trim()) return false;
  // allow generic study words to pass; the system prompt will still constrain
  if (/(class\s*9|ncert|cbse|physics|chemistry|biology|science|chapter|topic|explain|define|example)/i.test(t)) return true;
  return ALLOWED.some(k => t.includes(k));
}

// ---------- main handler ----------
export default async function handler(req, res) {
  try {
    // CORS / method guards
    if (req.method === 'OPTIONS') return send(res, 204, { ok: true });
    if (req.method === 'GET')     return send(res, 405, { error: 'Method Not Allowed' });
    if (req.method !== 'POST')    return send(res, 405, { error: 'Method Not Allowed' });

    // Parse JSON body safely (Node serverless stream)
    const body = req.body && typeof req.body === 'object'
      ? req.body
      : await new Promise((resolve, reject) => {
          let data = '';
          req.on('data', c => (data += c));
          req.on('end', () => {
            try { resolve(data ? JSON.parse(data) : {}); }
            catch (e) { reject(e); }
          });
          req.on('error', reject);
        });

    let {
      messages = [],
      temperature = 0.3,
      max_tokens = 700,
      model = 'llama-3.1-8b-instant', // you can switch to a stronger model if your account allows
    } = body || {};

    const key = process.env.GROQ_API_KEY || '';
    if (!key || key.length < 10) {
      return send(res, 500, { error: 'Missing GROQ_API_KEY in Vercel env.' });
    }

    // Determine last user message (for quick off-topic guard)
    const last = Array.isArray(messages) && messages.length ? messages[messages.length - 1] : null;
    const lastUser = last && last.role === 'user' ? last.content : '';

    // Early guard: if off-topic, reply locally (no Groq call)
    if (!looksAllowed(lastUser)) {
      return send(res, 200, {
        reply:
`I am your Class 9 Science helper.
I can help with these topics only:
• Physics: Motion, Force & Laws, Gravitation, Work & Energy, Sound.
• Chemistry: Matter in Our Surroundings; Is Matter Around Us Pure?; Atoms & Molecules; Structure of the Atom.
• Biology: Cell; Tissues; Improvement in Food Resources.

Please ask about one of these. 
Example: "Explain Newton’s third law with a ball and wall."`
      });
    }

    // Prepend our strict system prompt if none is present
    const msgs = Array.isArray(messages) ? [...messages] : [];
    const hasSystem = msgs.find(m => m && m.role === 'system');
    if (!hasSystem) msgs.unshift({ role: 'system', content: SYSTEM_PROMPT });

    // Call Groq
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages: msgs, temperature, max_tokens }),
    });

    const text = await r.text(); // read once for better error messages
    if (!r.ok) {
      return send(res, 502, {
        error: 'Groq error',
        status: r.status,
        body: text.slice(0, 1200),
      });
    }

    let json;
    try { json = JSON.parse(text); }
    catch {
      return send(res, 502, { error: 'Groq returned non-JSON', body: text.slice(0, 800) });
    }

    const reply = json?.choices?.[0]?.message?.content || '';
    if (!reply) {
      return send(res, 500, { error: 'Empty reply from Groq', raw: json });
    }

    return send(res, 200, { reply });
  } catch (e) {
    return send(res, 500, { error: String(e) });
  }
}
