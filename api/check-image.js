import { list } from '@vercel/blob';

export default async function handler(req, res) {
  const jobId = req.query.jobId;
  if (!jobId) return res.status(400).json({ error: 'falta o parâmetro jobId' });

  const { blobs } = await list({ prefix: `job-${jobId}.json` });
  if (blobs.length === 0) {
    return res.status(200).json({ status: 'unknown' });
  }

  const statusRes = await fetch(blobs[0].url);
  const statusJson = await statusRes.json();
  res.status(200).json(statusJson);
}
