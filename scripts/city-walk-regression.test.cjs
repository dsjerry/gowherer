/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { createOpenAICompatible } = require('@ai-sdk/openai-compatible');

// Load the app's TypeScript modules with isolated native dependencies and no network access.
function loadTypeScript(relativePath, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  instance.require = (id) =>
    Object.hasOwn(mocks, id) ? mocks[id] : Module.prototype.require.call(instance, id);
  instance._compile(compiled, filename);
  return instance.exports;
}

const errors = loadTypeScript('lib/city-walk-error.ts');
const typeMocks = { CITY_WALK_ORIGIN_POI_ID: '__origin__' };
const origin = { latitude: 31, longitude: 121, coordinateSystem: 'gcj02' };
const target = { latitude: 31.01, longitude: 121.01, coordinateSystem: 'gcj02' };
const success = {
  status: '1',
  route: { paths: [{ distance: '100', duration: '80', steps: [] }] },
};
const limited = { status: '0', info: 'CUQPS_HAS_EXCEEDED_THE_LIMIT', infocode: '10021' };

function loadService() {
  return loadTypeScript('lib/city-walk-service.ts', {
    'expo-constants': { __esModule: true, default: { expoConfig: { extra: {} } } },
    '@/lib/city-walk-error': errors,
    '@/lib/local-log': { logLocalError: async () => {} },
    '@/lib/reverse-geocode': { getAmapWebKey: () => 'test-key' },
    '@/types/city-walk': typeMocks,
  });
}

function mockFetch(t, respond) {
  const original = global.fetch;
  global.fetch = respond;
  t.after(() => {
    global.fetch = original;
  });
}

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' } });
}

test('walking requests are spaced even when started concurrently', async (t) => {
  const service = loadService();
  const starts = [];
  mockFetch(t, async () => {
    starts.push(Date.now());
    return jsonResponse(success);
  });

  const results = await Promise.all([
    service.queryWalkingLeg(origin, target),
    service.queryWalkingLeg(origin, target),
  ]);
  assert.equal(results[0].distanceMeters, 100);
  assert.equal(results[1].durationSeconds, 80);
  assert.ok(starts[1] - starts[0] >= 1050, `request interval: ${starts[1] - starts[0]}ms`);
});

test('a QPS response retries the same walking leg', async (t) => {
  const service = loadService();
  let calls = 0;
  mockFetch(t, async () => jsonResponse(++calls === 1 ? limited : success));

  const result = await service.queryWalkingLeg(origin, target);
  assert.equal(calls, 2);
  assert.equal(result.distanceMeters, 100);
});

test('persistent QPS failures produce a specific error after bounded retries', async (t) => {
  const service = loadService();
  let calls = 0;
  mockFetch(t, async () => {
    calls += 1;
    return jsonResponse(limited);
  });

  await assert.rejects(service.queryWalkingLeg(origin, target), (error) => {
    assert.equal(error.code, 'amap-rate-limited');
    assert.match(error.detail, /10021/);
    return true;
  });
  assert.equal(calls, 3);
});

test('other AMap errors are not retried as QPS errors', async (t) => {
  const service = loadService();
  let calls = 0;
  mockFetch(t, async () => {
    calls += 1;
    return jsonResponse({ status: '0', info: 'OTHER_ERROR', infocode: '10003' });
  });

  await assert.rejects(service.queryWalkingLeg(origin, target), (error) => {
    assert.equal(error.code, 'amap-error');
    assert.match(error.detail, /10003/);
    return true;
  });
  assert.equal(calls, 1);
});

test('candidate search also retries a QPS response', async (t) => {
  const service = loadService();
  let calls = 0;
  mockFetch(t, async () =>
    jsonResponse(
      ++calls === 1
        ? limited
        : {
            status: '1',
            pois: [{ id: 'poi-1', name: 'Park', location: '121.01,31.01', distance: '50' }],
          },
    ),
  );
  const result = await service.queryCityWalkCandidates(origin, {
    interests: ['park'],
    radiusMeters: 2500,
  });
  assert.equal(calls, 2);
  assert.equal(result.candidates[0].poiId, 'poi-1');
});

test('cancelling a queued request returns promptly and does not send it later', async (t) => {
  const service = loadService();
  let calls = 0;
  mockFetch(t, async () => {
    calls += 1;
    return jsonResponse(success);
  });
  await service.queryWalkingLeg(origin, target);
  const controller = new AbortController();
  const queued = service.queryWalkingLeg(origin, target, { signal: controller.signal });
  controller.abort();
  await assert.rejects(queued, (error) => error.code === 'cancelled');
  const next = await service.queryWalkingLeg(origin, target);
  assert.equal(next.distanceMeters, 100);
  assert.equal(calls, 2);
});

test('cancelling during rate-limit backoff stops retries', async (t) => {
  const service = loadService();
  const controller = new AbortController();
  let calls = 0;
  mockFetch(t, async () => {
    calls += 1;
    setTimeout(() => controller.abort(), 20);
    return jsonResponse(limited);
  });
  await assert.rejects(
    service.queryWalkingLeg(origin, target, { signal: controller.signal }),
    (error) => error.code === 'cancelled',
  );
  assert.equal(calls, 1);
});

test('AI JSON mode avoids schema warnings and still validates candidate IDs', async () => {
  const requests = [];
  const logged = [];
  let stopId = 'poi-1';
  const provider = createOpenAICompatible({
    name: 'test',
    baseURL: 'https://example.invalid/v1',
    fetch: async (_url, init) => {
      requests.push(JSON.parse(init.body));
      return jsonResponse({
        id: 'test',
        object: 'chat.completion',
        created: 1,
        model: 'test-model',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: JSON.stringify({
                title: 'Walk',
                stops: [{ poiId: stopId, suggestedStayMinutes: 10, reason: 'A nice place' }],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
    },
  });
  const planner = loadTypeScript('lib/city-walk-planner.ts', {
    '@/lib/ai-client': { createAiModel: () => provider('test-model') },
    '@/lib/ai-settings': { isAiConfigured: () => true },
    '@/lib/city-walk-error': errors,
    '@/lib/city-walk-service': { shouldReturnToOrigin: () => false },
    '@/lib/local-log': {
      collapseLogText: (text) => text,
      logLocalError: async (...args) => logged.push(args),
    },
    '@/types/city-walk': typeMocks,
  });
  const candidate = { poiId: 'poi-1', name: 'Park', ...target };
  const params = {
    settings: { baseUrl: 'https://example.invalid/v1', model: 'test-model' },
    locale: 'en',
    origin,
    preferences: {
      interests: ['park'],
      durationMinutes: 60,
      pace: 'normal',
      routeShape: 'one-way',
      maxStops: 5,
    },
    candidateSet: { origin, candidates: [candidate], byId: { 'poi-1': candidate } },
  };
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    const draft = await planner.requestCityWalkPlanDraft(params);
    assert.equal(draft.stops[0].poiId, 'poi-1');
    assert.equal(requests[0].response_format.type, 'json_object');
    assert.equal(warnings.length, 0);
    assert.equal(requests.length, 1);

    stopId = 'unknown';
    await assert.rejects(
      planner.requestCityWalkPlanDraft(params),
      (error) => error.code === 'ai-invalid-output',
    );
    assert.equal(requests.length, 2, JSON.stringify(logged));
  } finally {
    console.warn = originalWarn;
  }
});
