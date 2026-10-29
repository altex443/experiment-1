const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const exercises = [
  { id: 'squat', name: 'Barbell squat', group: 'Legs', equipment: 'Barbell', sets: 4, reps: 8, weight: 60 },
  { id: 'bench', name: 'Bench press', group: 'Chest', equipment: 'Barbell', sets: 3, reps: 10, weight: 40 },
  { id: 'row', name: 'Dumbbell row', group: 'Back', equipment: 'Dumbbells', sets: 3, reps: 12, weight: 20 },
  { id: 'press', name: 'Shoulder press', group: 'Shoulders', equipment: 'Dumbbells', sets: 3, reps: 10, weight: 12 },
  { id: 'deadlift', name: 'Romanian deadlift', group: 'Legs', equipment: 'Barbell', sets: 3, reps: 10, weight: 50 },
  { id: 'plank', name: 'Plank', group: 'Core', equipment: 'Bodyweight', sets: 3, reps: 30, weight: 0 },
];
function createApp(dataFile = path.join(__dirname, '../data/training.json')) {
  const routes = new Map();
  const app = {
    get: (url, handler) => routes.set('GET ' + url, handler),
    post: (url, handler) => routes.set('POST ' + url, handler),
    put: (url, handler) => routes.set('PUT ' + url, handler),
    delete: (url, handler) => routes.set('DELETE ' + url, handler),
    listen: (...args) => http.createServer(async (req, res) => {
      res.status = code => { res.statusCode = code; return res; };
      res.json = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
      const fail = error => { if (!error.status) console.error(error); res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to save training data.' }); };
      try {
        const url = new URL(req.url, 'http://localhost');
        let handler = routes.get(req.method + ' ' + url.pathname);
        if (!handler) for (const [route, candidate] of routes) {
          const [method, pattern] = route.split(' ');
          const match = url.pathname.match(new RegExp('^' + pattern.replace(':id', '([^/]+)') + '$'));
          if (method === req.method && match) { handler = candidate; req.params = { id: match[1] }; break; }
        }
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (url.pathname.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
        if (handler) {
          if (['POST', 'PUT'].includes(req.method)) {
            let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 102400) { res.status(413).json({ error: 'Request too large.' }); return; } }
            try { req.body = JSON.parse(raw); if (!req.body || typeof req.body !== 'object') throw new Error(); } catch { res.status(400).json({ error: 'Invalid JSON body.' }); return; }
          }
          return await handler(req, res, fail);
        }
        if (req.method !== 'GET' || url.pathname.startsWith('/api/')) return res.status(404).json({ error: 'Not found.' });
        const root = path.resolve(__dirname, '../dist');
        const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
        if (!file.startsWith(root + path.sep)) return res.status(403).json({ error: 'Forbidden.' });
        try {
          const body = await fs.readFile(file);
          const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
          res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.end(body);
        } catch (error) { if (error.code === 'ENOENT' || error.code === 'EISDIR') return res.status(404).json({ error: 'File not found. Run npm run build first.' }); throw error; }
      } catch (error) { fail(error); }
    }).listen(...args)
  };
  let queue = Promise.resolve();
  async function read() {
    try { const data = JSON.parse(await fs.readFile(dataFile, 'utf8')); return { ...data, settings: data.settings || { weeklyGoal: 4 } }; }
    catch (error) { if (error.code !== 'ENOENT') throw error; return { plans: [{ id: 'foundation', name: 'Full body foundation', focus: 'Strength', exercises: exercises.slice(0, 4) }], sessions: [], settings: { weeklyGoal: 4 } }; }
  }
  function mutate(fn) {
    const task = queue.then(async () => {
      const data = await read(); const result = fn(data);
      await fs.mkdir(path.dirname(dataFile), { recursive: true });
      await fs.writeFile(dataFile + '.tmp', JSON.stringify(data, null, 2));
      await fs.rename(dataFile + '.tmp', dataFile);
      return result;
    });
    queue = task.catch(() => {}); return task;
  }
  app.get('/api/state', async (req, res, next) => { try { res.json({ ...await read(), exercises }); } catch (e) { next(e); } });
  function problem(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
  function buildPlan(body) {
    const { name, focus } = body;
    const targets = body.exercises || body.exerciseIds?.map(id => ({ id }));
    if (typeof name !== 'string' || !name.trim() || name.length > 80 || !['Strength', 'Hypertrophy', 'Conditioning'].includes(focus) || !Array.isArray(targets) || !targets.length || targets.length > 20) problem('Provide a name, focus, and 1–20 exercises.');
    const selected = targets.map(target => {
      const base = exercises.find(e => e.id === target?.id);
      if (!base) problem('Choose a valid exercise.');
      const item = { ...base, sets: target.sets ?? base.sets, reps: target.reps ?? base.reps, weight: target.weight ?? base.weight };
      if (!Number.isInteger(item.sets) || item.sets < 1 || item.sets > 20 || !Number.isInteger(item.reps) || item.reps < 1 || item.reps > 600 || !Number.isFinite(item.weight) || item.weight < 0 || item.weight > 1000) problem('Use 1–20 sets, 1–600 reps/seconds, and 0–1000 kg.');
      return item;
    });
    if (new Set(selected.map(e => e.id)).size !== selected.length) problem('Each exercise may appear only once.');
    return { name: name.trim(), focus, exercises: selected };
  }
  app.post('/api/plans', async (req, res, next) => {
    try { const plan = { ...buildPlan(req.body), id: randomUUID() }; await mutate(data => data.plans.push(plan)); res.status(201).json(plan); } catch (e) { next(e); }
  });
  app.put('/api/plans/:id', async (req, res, next) => {
    try { const plan = { ...buildPlan(req.body), id: req.params.id }; await mutate(data => { const index = data.plans.findIndex(p => p.id === plan.id); if (index < 0) problem('Workout not found.', 404); data.plans[index] = plan; }); res.json(plan); } catch (e) { next(e); }
  });
  app.delete('/api/plans/:id', async (req, res, next) => {
    try { await mutate(data => { if (!data.plans.some(p => p.id === req.params.id)) problem('Workout not found.', 404); data.plans = data.plans.filter(p => p.id !== req.params.id); }); res.json({ ok: true }); } catch (e) { next(e); }
  });
  app.delete('/api/sessions/:id', async (req, res, next) => {
    try { await mutate(data => { if (!data.sessions.some(p => p.id === req.params.id)) problem('Session not found.', 404); data.sessions = data.sessions.filter(p => p.id !== req.params.id); }); res.json({ ok: true }); } catch (e) { next(e); }
  });
  app.put('/api/settings', async (req, res, next) => {
    try { const { weeklyGoal } = req.body; if (!Number.isInteger(weeklyGoal) || weeklyGoal < 1 || weeklyGoal > 14) problem('Weekly goal must be between 1 and 14.'); await mutate(data => { data.settings = { weeklyGoal }; }); res.json({ weeklyGoal }); } catch (e) { next(e); }
  });
  app.post('/api/sessions', async (req, res, next) => {
    const { planId, completedSets, duration, entries, requestId } = req.body;
    if (!Array.isArray(completedSets) || !completedSets.length || !Number.isFinite(duration) || duration < 0 || duration > 86400 || new Set(completedSets).size !== completedSets.length) return res.status(400).json({ error: 'Complete at least one set and provide a valid duration.' });
    try {
      if (entries !== undefined && (!Array.isArray(entries) || entries.length > 400)) problem('Invalid set entries.');
      const session = await mutate(data => {
        if (requestId && (typeof requestId !== 'string' || requestId.length > 80)) problem('Invalid request ID.');
        if (requestId && data.sessions.some(item => item.requestId === requestId)) return data.sessions.find(item => item.requestId === requestId);
        const plan = data.plans.find(p => p.id === planId);
        const valid = plan?.exercises.flatMap(e => Array.from({ length: e.sets }, (_, i) => `${e.id}-${i}`)) || [];
        if (!plan || completedSets.some(id => !valid.includes(id))) { const e = new Error('Invalid workout or set.'); e.status = 400; throw e; }
        const logged = completedSets.map(id => {
          const exercise = plan.exercises.find(e => id.startsWith(e.id + '-'));
          const entry = entries?.find(e => e.id === id) || { reps: exercise.reps, weight: exercise.weight };
          if (!Number.isInteger(entry.reps) || entry.reps < 1 || entry.reps > 600 || !Number.isFinite(entry.weight) || entry.weight < 0 || entry.weight > 1000) problem('Invalid reps or weight.');
          return { id, exercise: exercise.name, reps: entry.reps, weight: entry.weight, unit: exercise.id === 'plank' ? 'seconds' : 'reps' };
        });
        const volume = logged.reduce((sum, e) => sum + (e.unit === 'reps' ? e.reps * e.weight : 0), 0);
        const item = { id: randomUUID(), name: plan.name, date: new Date().toISOString(), sets: completedSets.length, volume, duration, entries: logged, requestId };
        data.sessions.unshift(item); return item;
      }); res.status(201).json(session);
    } catch (e) { next(e); }
  });
  return app;
}
module.exports = { createApp };
