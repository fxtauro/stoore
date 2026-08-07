import { put } from '@vercel/blob';
import { waitUntil } from '@vercel/functions';
import sharp from 'sharp';
import { readFileSync } from 'fs';
import path from 'path';

async function generateAndStore(jobId, prompt) {
  try {
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
    const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);

    if (!part) {
      await put(`job-${jobId}.json`, JSON.stringify({ status: 'error', message: 'sem imagem gerada', raw: data }), {
        access: 'public',
        contentType: 'application/json',
        allowOverwrite: true,
      });
      return;
    }

    const baseImage = Buffer.from(part.inlineData.data, 'base64');
    const baseMeta = await sharp(baseImage).metadata();
    const imgWidth = baseMeta.width;
    const imgHeight = baseMeta.height;

    const logoPath = path.join(process.cwd(), 'assets', 'logo-seltha.png');
    const logoBuffer = readFileSync(logoPath);

    const logoWidth = Math.round(imgWidth * 0.14);
    const resizedLogo = await sharp(logoBuffer).resize({ width: logoWidth }).toBuffer();
    const logoMeta = await sharp(resizedLogo).metadata();

    const margin = Math.round(imgWidth * 0.03);
    const padding = Math.round(logoWidth * 0.06);
    const plateWidth = logoMeta.width + padding * 2;
    const plateHeight = logoMeta.height + padding * 2;
    const plateRadius = Math.round(plateHeight * 0.2);

    const plateSvg = `<svg width="${plateWidth}" height="${plateHeight}">
      <rect width="${plateWidth}" height="${plateHeight}" rx="${plateRadius}" ry="${plateRadius}" fill="white" fill-opacity="0.95"/>
    </svg>`;

    const left = imgWidth - plateWidth - margin;
    const top = imgHeight - plateHeight - margin;

    const finalImage = await sharp(baseImage)
      .composite([
        { input: Buffer.from(plateSvg), left, top },
        { input: resizedLogo, left: left + padding, top: top + padding },
      ])
      .png()
      .toBuffer();

    const blob = await put(`seltha-${jobId}.png`, finalImage, {
      access: 'public',
      contentType: 'image/png',
    });

    await put(`job-${jobId}.json`, JSON.stringify({ status: 'done', url: blob.url }), {
      access: 'public',
      contentType: 'application/json',
      allowOverwrite: true,
    });
  } catch (err) {
    await put(`job-${jobId}.json`, JSON.stringify({ status: 'error', message: String(err) }), {
      access: 'public',
      contentType: 'application/json',
      allowOverwrite: true,
    });
  }
}

export default async function handler(req, res) {
  const prompt = req.query.prompt;
  if (!prompt) return res.status(400).json({ error: 'falta o parâmetro prompt' });

  const jobId = Date.now() + '-' + Math.random().toString(36).slice(2, 8);

  await put(`job-${jobId}.json`, JSON.stringify({ status: 'pending' }), {
    access: 'public',
    contentType: 'application/json',
  });

  waitUntil(generateAndStore(jobId, prompt));

  res.status(202).json({ jobId });
}
