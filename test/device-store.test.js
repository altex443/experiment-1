const { test } = require('node:test');
const assert = require('node:assert/strict');
async function setup(base = '/experiment-1/') {
  const { createDeviceStore } = await import('../src/device-store.mjs');
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const store = createDeviceStore(storage, base);
  const send = async (url, method, body) => { const result = await store.request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) }); return { ok: result.ok, data: await result.json() }; };
  return { store, send, storage, createDeviceStore };
}
test('Pages device mode works without accounts or any backend and persists after reopening', async () => {
  const { send, storage, createDeviceStore } = await setup();
  const session = await send('/api/auth/session');
  assert.equal(session.data.mode, 'device'); assert.equal(session.data.authenticated, undefined);
  assert.equal((await send('/api/auth/register', 'POST', { username: 'a' })).ok, false);
  const initial = await send('/api/state'); assert.ok(initial.ok);
  const plan = initial.data.plans[0];
  const draft = { active: plan, entries: [{ id: 'squat-0', reps: 8, weight: 60 }], checked: ['squat-0'], started: Date.now() };
  assert.ok((await send('/api/draft', 'PUT', draft)).ok);
  assert.deepEqual((await send('/api/draft')).data, draft);
  const logged = await send('/api/sessions', 'POST', { planId: plan.id, completedSets: ['squat-0'], entries: draft.entries, duration: 60, requestId: 'device-1' });
  assert.ok(logged.ok); assert.equal((await send('/api/draft')).data, null);
  assert.ok((await send('/api/body-weights', 'POST', { date: '2025-01-01', kg: 75 })).ok);
  assert.ok((await send('/api/settings', 'PUT', { weeklyGoal: 5 })).ok);
  const reopened = createDeviceStore(storage, '/experiment-1/');
  const saved = await (await reopened.request('/api/state')).json();
  assert.equal(saved.sessions.length, 1); assert.equal(saved.bodyWeights[0].kg, 75); assert.equal(saved.settings.weeklyGoal, 5);
  const backup = await send('/api/backup'); assert.equal(backup.data.sessions.length, 1);
  assert.equal((await send('/api/backup', 'PUT', backup.data)).ok, false);
  const other = await (await createDeviceStore(storage, '/other/').request('/api/state')).json(); assert.equal(other.sessions.length, 0);
});
test('Pages device mode reports blocked storage without pretending a save succeeded', async () => {
  const { createDeviceStore } = await import('../src/device-store.mjs');
  const store = createDeviceStore({ getItem() { throw new Error(); }, setItem() { throw new Error(); }, removeItem() { throw new Error(); } });
  assert.equal((await store.request('/api/state')).ok, false);
  assert.equal((await store.request('/api/draft', { method: 'PUT', body: 'null' })).ok, false);
});
