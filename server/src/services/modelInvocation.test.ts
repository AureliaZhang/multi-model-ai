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
import { normalizeModelName } from './normalizeModelName';

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

// v0.7.66: the token receipt
import { extractSseUsage } from './modelInvocation';

describe('token usage capture (v0.7.66)', () => {
  it('extractSseUsage parses a usage block, ignores chunks without one, tolerates garbage', () => {
    expect(extractSseUsage('{"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}'))
      .toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
    expect(extractSseUsage('{"choices":[{"delta":{"content":"hi"}}]}')).toBeNull();
    expect(extractSseUsage('[DONE]')).toBeNull();
    expect(extractSseUsage('not json')).toBeNull();
    expect(extractSseUsage('{"usage":{"prompt_tokens":"NaN?"}}')).toBeNull();
  });
});

// v0.7.89: telling the three empty-pool states apart
import { diagnoseNoStationFromRows, noStationMessage } from './modelInvocation';

describe('diagnoseNoStation (v0.7.89)', () => {
  const rows = (...r: [string, number][]) => r.map(([model_id, station_enabled]) => ({ model_id, station_enabled }));

  it('no row for the model at all → model-unknown', () => {
    expect(diagnoseNoStationFromRows(rows(['gpt-4o', 1]), 'claude-sonnet-4')).toBe('model-unknown');
    expect(diagnoseNoStationFromRows([], 'gpt-4o')).toBe('model-unknown');
  });

  it('every station carrying the model is switched off → station-disabled', () => {
    expect(diagnoseNoStationFromRows(rows(['gpt-4o', 0], ['gpt-4o', 0]), 'gpt-4o')).toBe('station-disabled');
  });

  it('at least one live station has it → the pool flag is what excluded it', () => {
    // The exact state a first pull leaves behind: enabled=0/admin_enabled=0.
    expect(diagnoseNoStationFromRows(rows(['gpt-4o', 1]), 'gpt-4o')).toBe('model-not-enabled');
    // Mixed: one station off, one on — the live one decides.
    expect(diagnoseNoStationFromRows(rows(['gpt-4o', 0], ['gpt-4o', 1]), 'gpt-4o')).toBe('model-not-enabled');
  });

  it('matches on the NORMALIZED name, like the pool query does', () => {
    expect(diagnoseNoStationFromRows(rows(['openai/GPT-4o', 1]), normalizeModelName('openai/GPT-4o'))).toBe('model-not-enabled');
  });

  it('each reason gets a distinct message the client can match on', () => {
    const msgs = (['model-unknown', 'station-disabled', 'model-not-enabled'] as const).map((r) => noStationMessage(r, 'gpt-4o'));
    expect(new Set(msgs).size).toBe(3);
    expect(msgs.every((m) => m.includes('gpt-4o'))).toBe(true);
    // The client regexes key off these fragments — keep them in sync.
    expect(msgs[0]).toMatch(/no station provides model/i);
    expect(msgs[1]).toMatch(/every station providing model .* is disabled/i);
    expect(msgs[2]).toMatch(/is not enabled for use/i);
  });
});

// v0.7.90: naming the upstream cause instead of "All stations failed"
import { classifyUpstreamFailures, upstreamFailureMessage, sanitizeUpstreamDetail, type StationFailure } from './modelInvocation';

describe('classifyUpstreamFailures (v0.7.90)', () => {
  const f = (status: number | null, detail = ''): StationFailure => ({ stationName: 's', status, detail });

  it('picks the cause the user can act on, not the most common one', () => {
    // A wrong key matters more than another station merely timing out.
    expect(classifyUpstreamFailures([f(null), f(401)])).toBe('upstream-auth');
    expect(classifyUpstreamFailures([f(403)])).toBe('upstream-auth');
    expect(classifyUpstreamFailures([f(404), f(500)])).toBe('upstream-not-found');
    expect(classifyUpstreamFailures([f(502)])).toBe('upstream-server-error');
  });

  it('rate limiting ranks last — it must not mask a real misconfiguration', () => {
    expect(classifyUpstreamFailures([f(429), f(401)])).toBe('upstream-auth');
    expect(classifyUpstreamFailures([f(429), f(500)])).toBe('upstream-server-error');
    expect(classifyUpstreamFailures([f(429)])).toBe('upstream-rate-limited');
  });

  it('nothing answered at all → unreachable; nothing recorded → unknown', () => {
    expect(classifyUpstreamFailures([f(null), f(null)])).toBe('upstream-unreachable');
    expect(classifyUpstreamFailures([])).toBe('upstream-unknown');
  });

  it('every kind has its own client-matchable message', () => {
    const kinds = ['upstream-auth', 'upstream-not-found', 'upstream-rate-limited', 'upstream-server-error', 'upstream-unreachable', 'upstream-unknown'] as const;
    const msgs = kinds.map(upstreamFailureMessage);
    expect(new Set(msgs).size).toBe(kinds.length);
  });
});

describe('sanitizeUpstreamDetail (v0.7.90)', () => {
  it('never echoes the station key back to the browser', () => {
    const key = 'sk-abcdef1234567890';
    const out = sanitizeUpstreamDetail(`{"error":"bad key ${key}"}`, key);
    expect(out).not.toContain(key);
    expect(out).toContain('***');
  });

  it('redacts token-shaped strings even when they are not this station key', () => {
    expect(sanitizeUpstreamDetail('leaked sk-9f8e7d6c5b4a3210 here', 'other-key')).not.toContain('sk-9f8e7d6c5b4a3210');
  });

  it('collapses whitespace and truncates the HTML error pages some providers return', () => {
    expect(sanitizeUpstreamDetail('a\n\n  b', 'k')).toBe('a b');
    const long = sanitizeUpstreamDetail('x'.repeat(500), 'k');
    expect(long.length).toBeLessThanOrEqual(301);
    expect(long.endsWith('…')).toBe(true);
  });

  it('tolerates an empty body', () => {
    expect(sanitizeUpstreamDetail('', 'k')).toBe('');
  });
});
