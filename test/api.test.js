const { test } = require('node:test');
const assert = require('node:assert/strict');

async function setup() {
  const { createLocalStore, exercises } = await import('../src/local-store.mjs');
  const memory = new Map();
  const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  let n = 0;
  const store = createLocalStore(storage, '/forma/', () => `id-${++n}`);
  const request = async (method, url, body) => {
    const response = await store.request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
    return { ok: response.ok, data: await response.json() };
  };
  return { store, request, storage, memory, createLocalStore, exercises };
}

test('browser storage supports full workout and session lifecycle across reloads', async () => {
  const { store, request, storage, createLocalStore, exercises } = await setup();
  assert.equal(store.read().plans.length, 1);
  const created = await request('POST', '/api/plans', { name: 'Leg day', focus: 'Strength', exercises: [exercises[0]] });
  assert.ok(created.ok);
  const plan = created.data;
  const edited = await request('PUT', '/api/plans/' + plan.id, { ...plan, name: 'Updated legs', exercises: [{ ...exercises[0], sets: 2, weight: 70 }] });
  assert.ok(edited.ok);
  const payload = { planId: plan.id, completedSets: ['squat-0'], entries: [{ id: 'squat-0', reps: 6, weight: 75 }], duration: 120, requestId: 'retry-1' };
  const logged = await request('POST', '/api/sessions', payload);
  assert.ok(logged.ok);
  assert.equal(logged.data.volume, 450);
  assert.equal((await request('POST', '/api/sessions', payload)).data.id, logged.data.id);
  assert.equal(store.read().sessions.length, 1);
  assert.ok((await request('PUT', '/api/settings', { weeklyGoal: 3 })).ok);
  assert.ok((await request('DELETE', '/api/plans/' + plan.id)).ok);
  const reloaded = createLocalStore(storage, '/forma/');
  assert.equal(reloaded.read().settings.weeklyGoal, 3);
  assert.equal(reloaded.read().sessions[0].entries[0].weight, 75);
  assert.equal(reloaded.read().plans.length, 1);
  assert.ok((await request('DELETE', '/api/sessions/' + logged.data.id)).ok);
  assert.equal(store.read().sessions.length, 0);
});

test('invalid operations leave saved data unchanged', async () => {
  const { store, request, exercises } = await setup();
  const before = store.export();
  for (const [method, url, body] of [
    ['POST', '/api/plans', { name: '', focus: 'Strength', exercises: [exercises[0]] }],
    ['POST', '/api/plans', { name: 'Bad', focus: 'Strength', exercises: [{ ...exercises[0], sets: 0 }] }],
    ['PUT', '/api/settings', { weeklyGoal: 0 }],
    ['DELETE', '/api/plans/missing'],
    ['POST', '/api/sessions', { planId: 'foundation', completedSets: ['squat-99'], entries: [], duration: 60 }],
    ['POST', '/api/sessions', { planId: 'foundation', completedSets: ['squat-0', 'squat-0'], entries: [], duration: 60 }],
    ['POST', '/api/sessions', { planId: 'foundation', completedSets: ['squat-0'], entries: [null], duration: 60 }]
  ]) assert.equal((await request(method, url, body)).ok, false);
  assert.equal(store.export(), before);
});

test('backup restore is validated, and project storage is isolated', async () => {
  const { store, request, storage, createLocalStore } = await setup();
  await request('PUT', '/api/settings', { weeklyGoal: 7 });
  const backup = store.export();
  const other = createLocalStore(storage, '/other/');
  assert.equal(other.read().settings.weeklyGoal, 4);
  other.import(backup);
  assert.equal(other.read().settings.weeklyGoal, 7);
  assert.throws(() => other.import('{bad'), /valid Forma/);
  assert.throws(() => other.import('{"plans":[],"sessions":[],"settings":{"weeklyGoal":0}}'), /Invalid backup/);
  assert.equal(other.read().settings.weeklyGoal, 7);
});

test('disabled, corrupt, or full storage reports errors without silent data loss', async () => {
  const { createLocalStore, storage, memory } = await setup();
  memory.set('forma:/broken/:training:v1', '{broken');
  const broken = createLocalStore(storage, '/broken/');
  assert.throws(() => broken.read(), /has not been changed/);
  assert.equal(memory.get('forma:/broken/:training:v1'), '{broken');
  const unavailable = createLocalStore({ getItem() { throw new Error(); }, setItem() { throw new Error(); } });
  assert.equal((await unavailable.request('/api/state')).ok, false);
  const full = createLocalStore({ getItem: () => null, setItem() { throw new Error(); } });
  const response = await full.request('/api/settings', { method: 'PUT', body: '{"weeklyGoal":5}' });
  assert.equal(response.ok, false);
  assert.match((await response.json()).error, /storage is full or disabled/);
});
