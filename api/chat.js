const FREE_MODELS = ['nova-fast'];
const BYOP_MODELS = [
  'nova-fast', 'qwen-safety', 'gemini-fast', 'mistral', 'qwen-coder',
  'gemini-search', 'perplexity-fast', 'openai-fast', 'openai',
  'qwen-vision', 'minimax', 'deepseek', 'perplexity-reasoning',
  'openai-audio', 'midijourney', 'claude-fast', 'kimi', 'glm', 'qwen-large'
];
const POLLINATIONS_URL = 'https://text.pollinations.ai/openai';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, model = 'nova-fast', userKey } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'messages required' });

  let apiKey = null;

  if (userKey) {
    if (!BYOP_MODELS.includes(model)) return res.status(403).json({ error: 'model not available' });
    apiKey = userKey;
  } else if (FREE_MODELS.includes(model)) {
    apiKey = process.env.POLLINATIONS_API_KEY || null;
  } else {
    return res.status(403).json({ error: 'bring your own pollen to use this model' });
  }

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  try {
    const upstream = await fetch(POLLINATIONS_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, temperature: 0.85, max_tokens: 800 })
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
