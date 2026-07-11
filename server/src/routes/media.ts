/**
 * Image generation + TTS (OpenAI-compatible station APIs).
 */

import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getStationsForModel } from '../services/modelInvocation';
import { normalizeModelName } from './models';
import type { AuthRequest } from '../types';

const router = Router();
router.use(requireAuth);

/**
 * POST /api/media/images
 * { model, prompt, size?, n? }
 */
router.post('/images', async (req: AuthRequest, res: Response) => {
  try {
    const { model, prompt, size = '1024x1024', n = 1 } = req.body || {};
    if (!model || !prompt?.trim()) {
      res.status(400).json({ success: false, error: 'model and prompt are required' });
      return;
    }
    const normalized = normalizeModelName(model);
    const stations = getStationsForModel(normalized);
    if (!stations.length) {
      res.status(400).json({ success: false, error: `No station for model ${normalized}` });
      return;
    }

    const errors: string[] = [];
    for (const s of stations) {
      try {
        const response = await fetch(`${s.station.baseUrl}/images/generations`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${s.station.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: s.modelId,
            prompt: prompt.trim(),
            n: Math.min(Number(n) || 1, 4),
            size,
          }),
        });
        if (!response.ok) {
          const t = await response.text().catch(() => '');
          errors.push(`${s.station.name}: ${response.status} ${t.slice(0, 200)}`);
          continue;
        }
        const data = (await response.json()) as any;
        const images: { url?: string; b64_json?: string }[] = data.data || [];
        const normalizedImages = images.map((img) => ({
          url: img.url || (img.b64_json ? `data:image/png;base64,${img.b64_json}` : null),
          revisedPrompt: (img as any).revised_prompt || null,
        })).filter((i) => i.url);

        if (!normalizedImages.length) {
          errors.push(`${s.station.name}: empty image payload`);
          continue;
        }

        res.json({
          success: true,
          data: {
            modelUsed: `${s.modelId} @ ${s.station.name}`,
            images: normalizedImages,
          },
        });
        return;
      } catch (err: any) {
        errors.push(`${s.station.name}: ${err.message}`);
      }
    }

    res.status(502).json({ success: false, error: errors.join(' | ') || 'Image generation failed' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/media/tts  (OpenAI-compatible /audio/speech)
 * { model, input, voice? }
 * returns base64 audio
 */
router.post('/tts', async (req: AuthRequest, res: Response) => {
  try {
    const { model, input, voice = 'alloy', responseFormat = 'mp3' } = req.body || {};
    if (!model || !input?.trim()) {
      res.status(400).json({ success: false, error: 'model and input are required' });
      return;
    }
    const text = String(input).slice(0, 4096);
    const normalized = normalizeModelName(model);
    const stations = getStationsForModel(normalized);
    if (!stations.length) {
      res.status(400).json({ success: false, error: `No station for model ${normalized}` });
      return;
    }

    const errors: string[] = [];
    for (const s of stations) {
      try {
        const response = await fetch(`${s.station.baseUrl}/audio/speech`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${s.station.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: s.modelId,
            input: text,
            voice,
            response_format: responseFormat,
          }),
        });
        if (!response.ok) {
          const t = await response.text().catch(() => '');
          errors.push(`${s.station.name}: ${response.status} ${t.slice(0, 200)}`);
          continue;
        }
        const buf = Buffer.from(await response.arrayBuffer());
        const b64 = buf.toString('base64');
        const mime =
          responseFormat === 'wav'
            ? 'audio/wav'
            : responseFormat === 'opus'
              ? 'audio/opus'
              : 'audio/mpeg';

        res.json({
          success: true,
          data: {
            modelUsed: `${s.modelId} @ ${s.station.name}`,
            mimeType: mime,
            base64: b64,
            dataUrl: `data:${mime};base64,${b64}`,
          },
        });
        return;
      } catch (err: any) {
        errors.push(`${s.station.name}: ${err.message}`);
      }
    }

    res.status(502).json({ success: false, error: errors.join(' | ') || 'TTS failed' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Lightweight intent hint for client (rules only) */
router.post('/intent', (req: AuthRequest, res: Response) => {
  const text = String(req.body?.text || '').trim();
  const lower = text.toLowerCase();
  const imageHints =
    /画一|画个|画张|生成.*图|出一张图|做一张|插画|封面图|海报|draw\s|generate\s+(an?\s+)?image|picture of|illustration|文生图|ai\s*绘画/i;
  const ttsHints =
    /读出来|朗读|念给我|语音播报|转成语音|text to speech|\btts\b|speak this|read aloud/i;

  let intent: 'chat' | 'image' | 'tts' = 'chat';
  if (imageHints.test(text) || imageHints.test(lower)) intent = 'image';
  else if (ttsHints.test(text) || ttsHints.test(lower)) intent = 'tts';

  res.json({ success: true, data: { intent } });
});

export default router;
