const test = require('node:test');
const assert = require('node:assert/strict');

process.env.INTERNAL_SERVICE_TOKEN = 'dqplus-test-service-token';
const nativeFetch = global.fetch;
global.fetch = (url, options = {}) => nativeFetch(url, {
  ...options,
  headers: { ...(options.headers || {}), 'x-internal-service-token': process.env.INTERNAL_SERVICE_TOKEN },
});

const app = require('../src/app');
const extractionService = require('../src/services/extraction.service');
const embeddingService = require('../src/services/embedding.service');
const storeService = require('../src/services/store.service');
const profileSourceService = require('../src/services/profileSource.service');
const { startTestServer } = require('../testSupport/testServer');

const USER_ID = '00000000-0000-0000-0000-000000000001';
const FAKE_EMBEDDING = new Array(1536).fill(0.01);

async function withServer(fn) {
  const { baseUrl, close } = await startTestServer(app);
  try {
    await fn(baseUrl);
  } finally {
    await close();
  }
}

test('POST /extract/text', async (t) => {
  await t.test('extracts, embeds and stores a founder profile', async (t) => {
    const attributes = { company_name: 'Acme AI', industry: ['fintech'] };
    const stored = { id: 'rec-1', user_id: USER_ID, role: 'founder', source: 'text', attributes };

    const extractMock = t.mock.method(extractionService, 'extractAttributes', async () => attributes);
    const embedMock = t.mock.method(embeddingService, 'embed', async () => FAKE_EMBEDDING);
    const upsertMock = t.mock.method(storeService, 'upsertExtractedProfile', async () => stored);

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/extract/text`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: USER_ID, role: 'founder', text: 'We are Acme AI, a fintech startup.' }),
      });

      assert.equal(res.status, 201);
      assert.deepEqual(await res.json(), stored);
    });

    assert.equal(extractMock.mock.calls.length, 1);
    assert.deepEqual(extractMock.mock.calls[0].arguments, ['founder', 'We are Acme AI, a fintech startup.']);
    assert.equal(embedMock.mock.calls.length, 1);
    assert.equal(upsertMock.mock.calls.length, 1);
    assert.equal(upsertMock.mock.calls[0].arguments[0].source, 'text');
    assert.equal(upsertMock.mock.calls[0].arguments[0].attributes, attributes);
  });

  await t.test('400s when userId, role or text is missing', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/extract/text`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role: 'founder', text: 'hello' }),
      });
      assert.equal(res.status, 400);
      assert.deepEqual(await res.json(), { error: 'userId, role and text are required' });
    });
  });

  await t.test('400s on an invalid role', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/extract/text`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: USER_ID, role: 'admin', text: 'hello' }),
      });
      assert.equal(res.status, 400);
      assert.deepEqual(await res.json(), { error: 'role must be one of: founder, investor' });
    });
  });

  await t.test('propagates extraction failures as 500s', async (t) => {
    t.mock.method(console, 'error', () => {});
    t.mock.method(extractionService, 'extractAttributes', async () => {
      throw new Error('openai unavailable');
    });

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/extract/text`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: USER_ID, role: 'founder', text: 'hello' }),
      });
      assert.equal(res.status, 500);
      assert.deepEqual(await res.json(), { error: 'openai unavailable' });
    });
  });
});

test('POST /extract/crawl', async (t) => {
  await t.test('stores crawler input with source_url and metadata overriding extracted fields', async (t) => {
    const extracted = { company_name: 'Acme AI', country: 'Unknown' };
    const stored = { id: 'rec-2', user_id: USER_ID, role: 'founder', source: 'crawler' };

    t.mock.method(extractionService, 'extractAttributes', async () => extracted);
    t.mock.method(embeddingService, 'embed', async () => FAKE_EMBEDDING);
    const upsertMock = t.mock.method(storeService, 'upsertExtractedProfile', async () => stored);

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/extract/crawl`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: USER_ID,
          role: 'founder',
          url: 'https://example.com/acme-ai',
          content: 'Acme AI helps banks detect fraud.',
          metadata: { country: 'Singapore' },
        }),
      });
      assert.equal(res.status, 201);
      assert.deepEqual(await res.json(), stored);
    });

    const call = upsertMock.mock.calls[0].arguments[0];
    assert.equal(call.source, 'crawler');
    assert.equal(call.sourceUrl, 'https://example.com/acme-ai');
    assert.deepEqual(call.attributes, { company_name: 'Acme AI', country: 'Singapore' });
  });

  await t.test('400s when userId, role, url or content is missing', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/extract/crawl`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: USER_ID, role: 'founder' }),
      });
      assert.equal(res.status, 400);
      assert.deepEqual(await res.json(), { error: 'userId, role, url and content are required' });
    });
  });
});

test('POST /extract/profile', async (t) => {
  await t.test('maps the DB row and stores using the role from the profile, not the request', async (t) => {
    const row = { user_id: USER_ID, role: 'founder', company_name: 'Acme AI' };
    const attributes = { company_name: 'Acme AI' };
    const stored = { id: 'rec-3', user_id: USER_ID, role: 'founder', source: 'profile' };

    t.mock.method(profileSourceService, 'loadUserProfile', async () => row);
    const mapMock = t.mock.method(profileSourceService, 'mapProfileToAttributes', () => attributes);
    t.mock.method(embeddingService, 'embed', async () => FAKE_EMBEDDING);
    const upsertMock = t.mock.method(storeService, 'upsertExtractedProfile', async () => stored);

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/extract/profile`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: USER_ID }),
      });
      assert.equal(res.status, 201);
      assert.deepEqual(await res.json(), stored);
    });

    assert.deepEqual(mapMock.mock.calls[0].arguments, [row]);
    assert.equal(upsertMock.mock.calls[0].arguments[0].role, 'founder');
    assert.equal(upsertMock.mock.calls[0].arguments[0].source, 'profile');
  });

  await t.test('404s when the user has no linked profile', async (t) => {
    t.mock.method(profileSourceService, 'loadUserProfile', async () => null);

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/extract/profile`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: USER_ID }),
      });
      assert.equal(res.status, 404);
      assert.deepEqual(await res.json(), { error: 'User has no profile' });
    });
  });

  await t.test('400s when userId is missing', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/extract/profile`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.equal(res.status, 400);
      assert.deepEqual(await res.json(), { error: 'userId is required' });
    });
  });
});

test('GET /extracted/:userId', async (t) => {
  await t.test('returns the stored record', async (t) => {
    const record = { id: 'rec-4', user_id: USER_ID, role: 'founder', attributes: {} };
    t.mock.method(storeService, 'getExtractedProfile', async () => record);

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/extracted/${USER_ID}`);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), record);
    });
  });

  await t.test('404s when nothing is stored for the user', async (t) => {
    t.mock.method(storeService, 'getExtractedProfile', async () => null);

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/extracted/${USER_ID}`);
      assert.equal(res.status, 404);
      assert.deepEqual(await res.json(), { error: 'No extracted profile for user' });
    });
  });
});

test('internal endpoints reject missing service credentials', async () => {
  const { baseUrl, close } = await startTestServer(app);
  try {
    const res = await nativeFetch(`${baseUrl}/extracted/${USER_ID}`);
    assert.equal(res.status, 401);
  } finally { await close(); }
});

test('profile mapping keeps personal LinkedIn out of public match evidence', () => {
  const attributes = profileSourceService.mapProfileToAttributes({
    role: 'founder',
    company_name: 'Acme',
    website: ['https://acme.example'],
    linkedin_url: 'https://linkedin.com/in/private-contact',
  });
  assert.deepEqual(attributes.evidence, [{ label: 'acme.example', url: 'https://acme.example' }]);
});
