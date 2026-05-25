export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY tidak dikonfigurasi. Sila tambah dalam Vercel Environment Variables.'
    });
  }

  const { messages, systemPrompt } = req.body || {};
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Request tidak valid: messages array diperlukan.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20251001',
        max_tokens: 2000,
        system: systemPrompt || 'You are a helpful assistant.',
        messages,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Anthropic error:', JSON.stringify(data));
      return res.status(response.status).json({
        error: data.error?.message || `Anthropic API error ${response.status}`
      });
    }

    const text = (data.content || []).map(b => b.text || '').join('');
    if (!text) return res.status(500).json({ error: 'AI returned empty response.' });
    return res.status(200).json({ result: text });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
