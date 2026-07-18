import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  filterStationsForModel,
  invokeModel,
  streamInvokeModel,
  extractSseContentDelta,
  type StationPick,
} from './modelInvocation';
import type { StationModelJoinRow } from '../dbRows';
import { _resetRoundRobin } from './loadBalancer';

function row(
  partial: Partial<StationModelJoinRow> & Pick<StationModelJoinRow, 'model_id' | 'id' | 'name'>
): StationModelJoinRow {
  return {
    base_url: 'https://a.example/v1',
    api_key: 'k',
    health_status: 'healthy',
    enabled: 1,
    ...partial,
  };
}

function pick(id: string, name: string, baseUrl = `https://${id}.example/v1`): StationPick {
  return {
    station: { id, name, baseUrl, apiKey: 'k', healthStatus: 'healthy' },
    modelId: 'gpt-4o',
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('filterStationsForModel', () => {
  it('keeps only matching normalized model ids', () => {
    const rows = [
      row({ model_id: 'GPT-4o', id: 's1', name: 'A' }),
      row({ model_id: 'claude-3', id: 's2', name: 'B' }),
    ];
    const out = filterStationsForModel(rows, 'gpt-4o');
    expect(out).toHaveLength(1);
    expect(out[0].station.id).toBe('s1');
  });

  it('prefers healthy over unhealthy; falls back to unhealthy only', () => {
    const mixed = [
      row({ model_id: 'm', id: 'bad', name: 'Bad', health_status: 'unhealthy' }),
      row({ model_id: 'm', id: 'good', name: 'Good', health_status: 'healthy' }),
    ];
    expect(filterStationsForModel(mixed, 'm').map((p) => p.station.id)).toEqual(['good']);

    const onlyBad = [
      row({ model_id: 'm', id: 'bad', name: 'Bad', health_status: 'unhealthy' }),
    ];
    expect(filterStationsForModel(onlyBad, 'm').map((p) => p.station.id)).toEqual(['bad']);
  });
});

describe('invokeModel failover', () => {
  beforeEach(() => {
    _resetRoundRobin();
  });

  it('fails fast when no stations serve the model', async () => {
    const result = await invokeModel(
      { modelNormalizedName: 'missing', messages: [{ role: 'user', content: 'hi' }] },
      { getStations: () => [] }
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/No enabled station/);
  });

  it('tries the next station after HTTP error and marks the first unhealthy', async () => {
    const marks: Array<{ id: string; status: string }> = [];
    const stations = [pick('s1', 'Alpha'), pick('s2', 'Beta')];
    let calls = 0;
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      calls += 1;
      const u = String(url);
      if (u.includes('s1')) return jsonResponse({ error: 'nope' }, 500);
      return jsonResponse({ choices: [{ message: { content: 'hello from beta' } }] });
    });

    const result = await invokeModel(
      { modelNormalizedName: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }], timeoutMs: 5_000 },
      {
        getStations: () => stations,
        fetchImpl: fetchImpl as typeof fetch,
        markStationHealth: (id, status) => marks.push({ id, status }),
      }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toBe('hello from beta');
    expect(result.stationId).toBe('s2');
    expect(calls).toBe(2);
    expect(marks).toContainEqual({ id: 's1', status: 'unhealthy' });
    expect(marks).toContainEqual({ id: 's2', status: 'healthy' });
  });

  it('skips empty content and continues failover', async () => {
    const stations = [pick('s1', 'Empty'), pick('s2', 'Full')];
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes('s1')) {
        return jsonResponse({ choices: [{ message: { content: '   ' } }] });
      }
      return jsonResponse({ choices: [{ message: { content: 'ok' } }] });
    });

    const result = await invokeModel(
      { modelNormalizedName: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] },
      {
        getStations: () => stations,
        fetchImpl: fetchImpl as typeof fetch,
        markStationHealth: () => {},
      }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toBe('ok');
    expect(result.stationId).toBe('s2');
  });

  it('returns combined errors when every station fails', async () => {
    const stations = [pick('s1', 'A'), pick('s2', 'B')];
    const fetchImpl = vi.fn(async () => jsonResponse({}, 503));

    const result = await invokeModel(
      { modelNormalizedName: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] },
      {
        getStations: () => stations,
        fetchImpl: fetchImpl as typeof fetch,
        markStationHealth: () => {},
      }
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/A: HTTP 503/);
    expect(result.error).toMatch(/B: HTTP 503/);
  });

  it('treats abort/timeout as a station failure and continues', async () => {
    const stations = [pick('s1', 'Slow'), pick('s2', 'Fast')];
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes('s1')) {
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      }
      return jsonResponse({ choices: [{ message: { content: 'recovered' } }] });
    });

    const result = await invokeModel(
      { modelNormalizedName: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] },
      {
        getStations: () => stations,
        fetchImpl: fetchImpl as typeof fetch,
        markStationHealth: () => {},
      }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toBe('recovered');
  });
});


describe('extractSseContentDelta', () => {
  it('reads delta.content', () => {
    expect(extractSseContentDelta('{"choices":[{"delta":{"content":"hi"}}]}')).toBe('hi');
  });

  it('returns null for [DONE] and empty', () => {
    expect(extractSseContentDelta('[DONE]')).toBeNull();
    expect(extractSseContentDelta('')).toBeNull();
    expect(extractSseContentDelta('{"choices":[{"delta":{}}]}')).toBeNull();
  });

  it('returns null on invalid JSON', () => {
    expect(extractSseContentDelta('not-json')).toBeNull();
  });
});

describe('streamInvokeModel', () => {
  beforeEach(() => {
    _resetRoundRobin();
  });

  function sseResponse(chunks: string[], status = 200): Response {
    const body = chunks.map((c) => `data: ${c}\n\n`).join('') + 'data: [DONE]\n\n';
    return new Response(body, {
      status,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  it('emits deltas in order and returns full content', async () => {
    const stations = [pick('s1', 'Streamy')];
    const deltas: string[] = [];
    const fetchImpl = vi.fn(async () =>
      sseResponse([
        JSON.stringify({ choices: [{ delta: { content: 'Hel' } }] }),
        JSON.stringify({ choices: [{ delta: { content: 'lo' } }] }),
        JSON.stringify({ choices: [{ delta: { content: '!' } }] }),
      ])
    );

    const result = await streamInvokeModel(
      {
        modelNormalizedName: 'gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
        onDelta: (d) => deltas.push(d),
      },
      {
        getStations: () => stations,
        fetchImpl: fetchImpl as typeof fetch,
        markStationHealth: () => {},
      }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toBe('Hello!');
    expect(deltas.join('')).toBe('Hello!');
    expect(deltas).toEqual(['Hel', 'lo', '!']);
  });

  it('fails over to next station when stream is empty', async () => {
    const stations = [pick('s1', 'Empty'), pick('s2', 'Full')];
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes('s1')) {
        return sseResponse([JSON.stringify({ choices: [{ delta: {} }] })]);
      }
      return sseResponse([JSON.stringify({ choices: [{ delta: { content: 'ok' } }] })]);
    });

    const result = await streamInvokeModel(
      { modelNormalizedName: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] },
      {
        getStations: () => stations,
        fetchImpl: fetchImpl as typeof fetch,
        markStationHealth: () => {},
      }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toBe('ok');
    expect(result.stationId).toBe('s2');
  });
});
