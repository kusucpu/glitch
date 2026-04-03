const FREE_DEFAULT = ['nova-fast'];

const BYOP_FREE = [
  'nova-fast', 'openai-fast', 'openai',
  'gemini-fast', 'gemini-search',
  'mistral', 'qwen-coder', 'qwen-large',
  'qwen-vision', 'qwen-safety',
  'deepseek', 'minimax', 'kimi', 'glm',
  'claude-fast', 'perplexity-fast',
  'perplexity-reasoning', 'midijourney'
];

const POLLINATIONS_URL = 'https://gen.pollinations.ai/v1/chat/completions';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, model = 'nova-fast', userKey } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'messages required' });

  let apiKey;

  if (userKey) {
    if (!BYOP_FREE.includes(model)) {
      return res.status(403).json({ error: 'model not available' });
    }
    apiKey = userKey;
  } else {
    if (!FREE_DEFAULT.includes(model)) {
      return res.status(403).json({ error: 'bring your own key to use this model' });
    }
    apiKey = process.env.POLLINATIONS_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'server key not configured' });
  }

  try {
    const upstream = await fetch(POLLINATIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages, temperature: 0.85, max_tokens: 900 })
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      console.error(`Pollinations ${upstream.status}:`, text.slice(0, 300));
      return res.status(502).json({ error: `upstream ${upstream.status}`, detail: text.slice(0, 200) });
    }

    try {
      return res.status(200).json(JSON.parse(text));
    } catch {
      return res.status(502).json({ error: 'invalid JSON from upstream', detail: text.slice(0, 200) });
    }
  } catch (err) {
    console.error('Fetch error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
