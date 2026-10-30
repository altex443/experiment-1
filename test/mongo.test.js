const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { createMongoStore } = require('../server/mongo-store');
const { createApp } = require('../server/app');
function fakeCollection() {
  const docs = new Map();
  return {
    docs,
    async findOne(filter) { return structuredClone(docs.get(filter._id)); },
    async updateOne(filter, update) {
      if (update.$setOnInsert) { if (!docs.has(filter._id)) docs.set(filter._id, { _id: filter._id, ...structuredClone(update.$setOnInsert) }); return { matchedCount: 1 }; }
      const doc = docs.get(filter._id);
      if (filter.revision !== doc.revision) return { matchedCount: 0 };
      Object.assign(doc, structuredClone(update.$set)); doc.revision++;
      return { matchedCount: 1 };
    }
  };
}
test('Mongo repository persists custom exercises, plans, sessions, settings, drafts and backups', async () => {
  const collection = fakeCollection();
  let store = await createMongoStore(collection);
  const send = async (url, method, body) => { const r = await store.request(url, { method, body: JSON.stringify(body) }, 'alice'); assert.ok(r.ok); return r.json(); };
  const exercise = await send('/api/exercises', 'POST', { name: 'Curl', equipment: 'Dumbbells', group: 'Arms', unit: 'reps', sets: 2, reps: 10, weight: 8 });
  const plan = await send('/api/plans', 'POST', { name: 'Arms', focus: 'Strength', exercises: [exercise] });
  const draft = { active: plan, entries: [], checked: [], started: Date.now() };
  await send('/api/draft', 'PUT', draft);
  store = await createMongoStore(collection);
  assert.deepEqual(await send('/api/draft', 'GET'), draft);
  const body = { planId: plan.id, completedSets: [exercise.id + '-0'], entries: [{ id: exercise.id + '-0', reps: 10, weight: 8 }], duration: 60, requestId: 'retry' };
  const session = await send('/api/sessions', 'POST', body);
  assert.equal(session.volume, 80);
  assert.equal((await send('/api/sessions', 'POST', body)).id, session.id);
  assert.equal(await send('/api/draft', 'GET'), null);
  await Promise.all([send('/api/settings', 'PUT', { weeklyGoal: 6 }), send('/api/exercises', 'POST', { ...exercise, name: 'Another curl' })]);
  const state = await send('/api/state', 'GET');
  assert.equal(state.settings.weeklyGoal, 6);
  assert.equal(state.customExercises.length, 2);
  const backup = await send('/api/backup', 'GET');
  await send('/api/migrate', 'POST', backup);
  assert.equal((await send('/api/state', 'GET')).sessions.length, 1);
});
test('API requires authentication, restricts CORS, and keeps database errors private', async () => {
  const app = createApp({ request: async () => { throw new Error('mongodb://secret@example'); } }, { auth: { authenticated: async req => req.headers?.authorization === 'Bearer secret' ? { userId: 'test-user' } : null }, allowedOrigins: ['https://example.github.io'] });
  async function call(headers = {}, method = 'GET') {
    const req = Readable.from([]); req.url = '/api/state'; req.method = method; req.headers = headers;
    let body; const responseHeaders = {}; const res = { statusCode: 200, setHeader: (key, value) => { responseHeaders[key] = value; }, end: value => { body = value; } };
    await app.handle(req, res); return { status: res.statusCode, body, headers: responseHeaders };
  }
  assert.equal((await call()).status, 401);
  assert.equal((await call({ authorization: 'Bearer wrong' })).status, 401);
  assert.equal((await call({ origin: 'https://bad.example', authorization: 'Bearer secret' })).status, 403);
  const preflight = await call({ origin: 'https://example.github.io' }, 'OPTIONS');
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers['Access-Control-Allow-Origin'], 'https://example.github.io');
  const failed = await call({ authorization: 'Bearer secret' });
  assert.equal(failed.status, 503);
  assert.ok(!failed.body.includes('mongodb://'));
});

test('all training endpoints reject missing credentials before reading or writing data', async () => {
  let accessed = false;
  const app = createApp({ request: async () => { accessed = true; } }, { auth: { authenticated: async () => false }, logger: { warn() {}, info() {}, debug() {}, error() {} } });
  for (const [url, method] of [['/api/state', 'GET'], ['/api/draft', 'GET'], ['/api/draft', 'PUT'], ['/api/settings', 'PUT'], ['/api/backup', 'GET'], ['/api/backup', 'PUT'], ['/api/plans', 'POST'], ['/api/exercises', 'POST'], ['/api/sessions', 'POST'], ['/api/plans/id', 'DELETE']]) {
    const req = Readable.from([]); req.url = url; req.method = method; req.headers = {};
    const res = { statusCode: 200, setHeader() {}, end() {} };
    await app.handle(req, res);
    assert.equal(res.statusCode, 401, method + ' ' + url);
  }
  assert.equal(accessed, false);
});

test('Mongo workspaces isolate users, including browser migration and drafts', async () => {
  const collection = fakeCollection(); const store = await createMongoStore(collection);
  const send = async (owner, url, method, body) => { const r = await store.request(url, { method, body: JSON.stringify(body) }, owner); assert.ok(r.ok); return r.json(); };
  await send('alice', '/api/settings', 'PUT', { weeklyGoal: 9 });
  assert.equal((await send('bob', '/api/state', 'GET')).settings.weeklyGoal, 4);
  const backup = await send('bob', '/api/backup', 'GET');
  backup.settings.weeklyGoal = 2;
  await send('bob', '/api/migrate', 'POST', backup);
  assert.equal((await send('alice', '/api/state', 'GET')).settings.weeklyGoal, 9);
  assert.equal((await send('bob', '/api/state', 'GET')).settings.weeklyGoal, 2);
  await assert.rejects(() => store.request('/api/state'), /Authenticated user/);
});

test('MongoDB body-weight history is persistent and private to its owner', async () => {
  const collection = fakeCollection(); let store = await createMongoStore(collection);
  const response = await store.request('/api/body-weights', { method: 'POST', body: JSON.stringify({ date: '2025-01-01', kg: 75 }) }, 'alice');
  assert.ok(response.ok); const weight = await response.json();
  store = await createMongoStore(collection);
  const state = await (await store.request('/api/state', {}, 'alice')).json();
  assert.equal(state.bodyWeights[0].kg, 75);
  const other = await (await store.request('/api/state', {}, 'bob')).json();
  assert.deepEqual(other.bodyWeights, []);
  assert.equal((await store.request('/api/body-weights/' + weight.id, { method: 'DELETE' }, 'bob')).ok, false);
  const backup = await (await store.request('/api/backup', {}, 'alice')).json();
  assert.equal(backup.bodyWeights.length, 1);
});

test('backup export remains available but restoring via PUT is rejected without changing data', async () => {
  const store = await createMongoStore(fakeCollection());
  const exported = await (await store.request('/api/backup', {}, 'alice')).json();
  const replacement = structuredClone(exported); replacement.settings.weeklyGoal = 12;
  const result = await store.request('/api/backup', { method: 'PUT', body: JSON.stringify(replacement) }, 'alice');
  assert.equal(result.ok, false);
  assert.equal((await (await store.request('/api/state', {}, 'alice')).json()).settings.weeklyGoal, exported.settings.weeklyGoal);
});

test('exercise video changes are isolated per account', async () => {
  const store = await createMongoStore(fakeCollection());
  assert.ok((await store.request('/api/exercises/bench/video', { method: 'PUT', body: JSON.stringify({ videoUrl: 'https://youtu.be/pSHjTRCQxIw' }) }, 'alice')).ok);
  const alice = await (await store.request('/api/state', {}, 'alice')).json();
  const bob = await (await store.request('/api/state', {}, 'bob')).json();
  assert.equal(alice.exercises.find(e => e.id === 'bench').videoUrl, 'https://www.youtube.com/watch?v=pSHjTRCQxIw');
  assert.equal(bob.exercises.find(e => e.id === 'bench').videoUrl, 'https://www.youtube.com/watch?v=rT7DgCr-3pg');
});
