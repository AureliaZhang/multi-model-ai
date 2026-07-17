/**
 * Image generation + TTS (OpenAI-compatible station APIs).
 */

import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getStationsForModel } from '../services/modelInvocation';
import { normalizeModelName } from '../services/normalizeModelName';
import { logApiUsage } from '../services/usageLog';
import type { AuthRequest } from '../types';
import { getErrorMessage } from '../utils/errors';

const router = Router();
router.use(requireAuth);

router.post('/images', async (req: AuthRequest, res: Response) => {
  const started = Date.now();
  try {
    const { model, prompt, size = '1024x1024', n = 1 } = req.body || {};
    if (!model || !prompt?.trim()) {
      res.status(400).json({ success: false, error: 'model and prompt are required' });
      return;
    }
    const normalized = normalizeModelName(model);
    const isAdmin = req.user?.role === 'admin';
    const stations = getStationsForModel(normalized, { adminPool: isAdmin });
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
          logApiUsage({
            userId: req.user?.id,
            username: req.user?.username,
            role: req.user?.role,
            kind: 'image',
            modelNormalized: normalized,
            stationId: s.station.id,
            stationName: s.station.name,
            status: 'http_error',
            httpStatus: response.status,
            errorMessage: t.slice(0, 500),
            latencyMs: Date.now() - started,
          });
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

        logApiUsage({
          userId: req.user?.id,
          username: req.user?.username,
          role: req.user?.role,
          kind: 'image',
          modelNormalized: normalized,
          modelUsed: `${s.modelId} @ ${s.station.name}`,
          stationId: s.station.id,
          stationName: s.station.name,
          status: 'ok',
          latencyMs: Date.now() - started,
        });

        res.json({
          success: true,
          data: {
            modelUsed: `${s.modelId} @ ${s.station.name}`,
            images: normalizedImages,
          },
        });
        return;
      } catch (err: unknown) {
        errors.push(`${s.station.name}: ${getErrorMessage(err)}`);
      }
    }

    logApiUsage({
      userId: req.user?.id,
      username: req.user?.username,
      role: req.user?.role,
      kind: 'image',
      modelNormalized: normalized,
      status: 'error',
      errorMessage: errors.join(' | ') || 'Image generation failed',
      latencyMs: Date.now() - started,
    });
    res.status(502).json({ success: false, error: errors.join(' | ') || 'Image generation failed' });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

router.post('/tts', async (req: AuthRequest, res: Response) => {
  const started = Date.now();
  try {
    const { model, input, voice = 'alloy', responseFormat = 'mp3' } = req.body || {};
    if (!model || !input?.trim()) {
      res.status(400).json({ success: false, error: 'model and input are required' });
      return;
    }
    const text = String(input).slice(0, 4096);
    const normalized = normalizeModelName(model);
    const isAdmin = req.user?.role === 'admin';
    const stations = getStationsForModel(normalized, { adminPool: isAdmin });
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
          logApiUsage({
            userId: req.user?.id,
            username: req.user?.username,
            role: req.user?.role,
            kind: 'tts',
            modelNormalized: normalized,
            stationId: s.station.id,
            stationName: s.station.name,
            status: 'http_error',
            httpStatus: response.status,
            errorMessage: t.slice(0, 500),
            latencyMs: Date.now() - started,
          });
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

        logApiUsage({
          userId: req.user?.id,
          username: req.user?.username,
          role: req.user?.role,
          kind: 'tts',
          modelNormalized: normalized,
          modelUsed: `${s.modelId} @ ${s.station.name}`,
          stationId: s.station.id,
          stationName: s.station.name,
          status: 'ok',
          promptTokens: Math.ceil(text.length / 4),
          latencyMs: Date.now() - started,
        });

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
      } catch (err: unknown) {
        errors.push(`${s.station.name}: ${getErrorMessage(err)}`);
      }
    }

    logApiUsage({
      userId: req.user?.id,
      username: req.user?.username,
      role: req.user?.role,
      kind: 'tts',
      modelNormalized: normalized,
      status: 'error',
      errorMessage: errors.join(' | ') || 'TTS failed',
      latencyMs: Date.now() - started,
    });
    res.status(502).json({ success: false, error: errors.join(' | ') || 'TTS failed' });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

router.post('/intent', (req: AuthRequest, res: Response) => {
  const text = String(req.body?.text || '').trim();
  const lower = text.toLowerCase();
  const imageHints =
    /画一|画个|画张|生成.*图|出一张图|做一张|插画|封面图|海报|draw\s|generate\s+(an?\s+)?image|picture of|illustration|文生图|ai\s*绘画|帮我画/i;
  const ttsHints =
    /读出来|朗读|念给我|语音播报|转成语音|text to speech|\btts\b|speak this|read aloud/i;

  let intent: 'chat' | 'image' | 'tts' = 'chat';
  if (imageHints.test(text) || imageHints.test(lower)) intent = 'image';
  else if (ttsHints.test(text) || ttsHints.test(lower)) intent = 'tts';

  res.json({ success: true, data: { intent } });
});

export default router;
