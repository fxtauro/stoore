export default async function handler(req, res) {
  const prompt = req.query.prompt;
  if (!prompt) return res.status(400).json({ error: 'falta o parâmetro prompt' });

  const apiKey = process.env.GEMINI_API_KEY;
  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
  contents: [{ parts: [{ text: `Generate a photorealistic image: ${prompt}` }] }],
  }),
    }
  );
  const data = await geminiRes.json();
  const part = data?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (!part) return res.status(500).json({ error: 'sem imagem gerada', raw: data });

  const { put } = await import('@vercel/blob');
  const buffer = Buffer.from(part.inlineData.data, 'base64');
  const blob = await put(`seltha-${Date.now()}.png`, buffer, {
    access: 'public',
    contentType: 'image/png',
  });

  res.status(200).json({ url: blob.url });
}
