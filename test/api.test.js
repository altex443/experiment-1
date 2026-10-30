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
  assert.throws(() => other.import('{bad'), /valid training/);
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

test('custom exercises persist, work in plans and sessions, and survive backup restore', async () => {
  const { store, request, storage, createLocalStore } = await setup();
  const definition = { name: 'Wall sit', group: 'Legs', equipment: 'Bodyweight', unit: 'seconds', sets: 2, reps: 45, weight: 5 };
  const created = await request('POST', '/api/exercises', definition);
  assert.ok(created.ok);
  const exercise = created.data;
  const reloaded = createLocalStore(storage, '/forma/');
  assert.equal(reloaded.read().customExercises[0].name, 'Wall sit');
  const state = await (await reloaded.request('/api/state')).json();
  assert.equal(state.exercises.length, 7);
  assert.equal((await request('POST', '/api/exercises', { ...definition, name: ' wall sit ' })).ok, false);
  assert.equal((await request('POST', '/api/exercises', { ...definition, name: 'Invalid', sets: 0 })).ok, false);
  const plan = await request('POST', '/api/plans', { name: 'Timed legs', focus: 'Conditioning', exercises: [exercise] });
  assert.ok(plan.ok);
  const session = await request('POST', '/api/sessions', { planId: plan.data.id, duration: 120, completedSets: [exercise.id + '-0'], entries: [{ id: exercise.id + '-0', reps: 45, weight: 5 }] });
  assert.ok(session.ok);
  assert.equal(session.data.entries[0].unit, 'seconds');
  assert.equal(session.data.volume, 0);
  const other = createLocalStore(storage, '/restored/');
  other.import(store.export());
  assert.equal(other.read().customExercises[0].id, exercise.id);
  assert.equal(other.read().plans[1].exercises[0].unit, 'seconds');
  const invalid = JSON.parse(store.export()); invalid.customExercises[0].unit = 'invalid';
  assert.throws(() => other.import(JSON.stringify(invalid)), /Provide a name/);
});

test('older browser data and backups without custom exercises remain supported', async () => {
  const { store, storage, memory, createLocalStore } = await setup();
  const legacy = store.read(); delete legacy.customExercises;
  memory.set('forma:/forma/:training:v1', JSON.stringify(legacy));
  assert.deepEqual(store.read().customExercises, []);
  const restored = createLocalStore(storage, '/legacy/');
  restored.import(JSON.stringify(legacy));
  assert.equal(restored.read().plans.length, 1);
  assert.deepEqual(restored.read().customExercises, []);
});

test('body weight supports dated updates, deletion, backups and older data', async () => {
  const { store, request, storage, createLocalStore } = await setup();
  const saved = await request('POST', '/api/body-weights', { date: '2025-01-02', kg: 75.5 });
  assert.ok(saved.ok);
  const first = await request('POST', '/api/body-weights', { date: '2025-01-01', kg: 76 });
  assert.ok(first.ok);
  const updated = await request('POST', '/api/body-weights', { date: '2025-01-02', kg: 75.25 });
  assert.ok(updated.ok); assert.equal(updated.data.id, saved.data.id);
  assert.equal(store.read().bodyWeights.length, 2);
  const reloaded = createLocalStore(storage, '/forma/');
  assert.equal(reloaded.read().bodyWeights[0].kg, 75.25);
  assert.equal(reloaded.read().bodyWeights[0].date, '2025-01-02');
  const backup = store.export(); const restored = createLocalStore(storage, '/weights-restore/');
  restored.import(backup); assert.deepEqual(restored.read().bodyWeights, store.read().bodyWeights);
  assert.ok((await request('DELETE', '/api/body-weights/' + saved.data.id)).ok);
  assert.equal(store.read().bodyWeights.length, 1);
  assert.equal((await request('DELETE', '/api/body-weights/missing')).ok, false);
  const old = JSON.parse(backup); delete old.bodyWeights; restored.import(JSON.stringify(old));
  assert.deepEqual(restored.read().bodyWeights, []);
});

test('invalid body weight and malformed weight backups never modify saved data', async () => {
  const { store, request } = await setup(); const before = store.export();
  for (const body of [{ date: '2025-02-30', kg: 75 }, { date: 'not-a-date', kg: 75 }, { date: '9999-01-01', kg: 75 }, { date: '2025-01-01', kg: 0 }, { date: '2025-01-01', kg: -1 }, { date: '2025-01-01', kg: 1001 }, { date: '2025-01-01', kg: '75' }]) assert.equal((await request('POST', '/api/body-weights', body)).ok, false);
  assert.equal(store.export(), before);
  const backup = JSON.parse(before);
  backup.bodyWeights = [{ id: 'a', date: '2025-01-01', kg: 75 }, { id: 'b', date: '2025-01-01', kg: 76 }];
  assert.throws(() => store.import(JSON.stringify(backup)), /Duplicate body-weight/);
  backup.bodyWeights = [{ id: 'a', date: '2025-01-01', kg: -1 }];
  assert.throws(() => store.import(JSON.stringify(backup)), /body weight/);
  assert.equal(store.export(), before);
});

test('exercise videos have defaults, validate URLs and persist edits and migration', async () => {
  const { store, request, storage, createLocalStore, exercises } = await setup();
  const initial = await request('GET', '/api/state');
  assert.equal(initial.data.exercises.filter(e => e.videoUrl?.startsWith('https://www.youtube.com/watch?v=')).length, 6);
  const update = await request('PUT', '/api/exercises/bench/video', { videoUrl: 'https://youtu.be/pSHjTRCQxIw?t=10' });
  assert.ok(update.ok); assert.equal(update.data.videoUrl, 'https://www.youtube.com/watch?v=pSHjTRCQxIw');
  const reload = createLocalStore(storage, '/forma/');
  const state = await (await reload.request('/api/state')).json();
  assert.equal(state.exercises.find(e => e.id === 'bench').videoUrl, update.data.videoUrl);
  assert.equal((await request('PUT', '/api/exercises/bench/video', { videoUrl: 'javascript:alert(1)' })).ok, false);
  assert.equal((await request('PUT', '/api/exercises/missing/video', { videoUrl: '' })).ok, false);
  assert.ok((await request('PUT', '/api/exercises/bench/video', { videoUrl: '' })).ok);
  assert.equal((await request('GET', '/api/state')).data.exercises.find(e => e.id === 'bench').videoUrl, '');
  const created = await request('POST', '/api/exercises', { ...exercises[0], name: 'Custom squat', unit: 'reps', videoUrl: 'https://www.youtube.com/shorts/SW_C1A-rejs' });
  assert.ok(created.ok); assert.equal(created.data.videoUrl, 'https://www.youtube.com/watch?v=SW_C1A-rejs');
  const target = createLocalStore(storage, '/video-migration/'); target.import(store.export());
  assert.equal(target.read().customExercises[0].videoUrl, created.data.videoUrl);
  assert.equal(target.read().exerciseVideos.bench, '');
});
