import { demonstrations, normalizeVideo } from './exercise-videos.mjs';
export const exercises = [
  { id: 'squat', name: 'Barbell squat', group: 'Legs', equipment: 'Barbell', sets: 4, reps: 8, weight: 60 },
  { id: 'bench', name: 'Bench press', group: 'Chest', equipment: 'Barbell', sets: 3, reps: 10, weight: 40 },
  { id: 'row', name: 'Dumbbell row', group: 'Back', equipment: 'Dumbbells', sets: 3, reps: 12, weight: 20 },
  { id: 'press', name: 'Shoulder press', group: 'Shoulders', equipment: 'Dumbbells', sets: 3, reps: 10, weight: 12 },
  { id: 'deadlift', name: 'Romanian deadlift', group: 'Legs', equipment: 'Barbell', sets: 3, reps: 10, weight: 50 },
  { id: 'plank', name: 'Plank', group: 'Core', equipment: 'Bodyweight', sets: 3, reps: 30, weight: 0 },
];

// Separate each Pages project on the same username.github.io origin.
export function storageKey(base = '/') {
  return `forma:${base}:training:v1`;
}
export function createLocalStore(storage, base = '/', uuid = () => crypto.randomUUID()) {
  const key = storageKey(base);
  function read() {
    let raw;
    try { raw = storage.getItem(key); }
    catch { throw new Error('Browser storage is unavailable. Allow site storage to use Rep.'); }
    if (!raw) return { plans: [{ id: 'foundation', name: 'Full body foundation', focus: 'Strength', exercises: structuredClone(exercises.slice(0, 4)) }], sessions: [], bodyWeights: [], exerciseVideos: {}, customExercises: [], settings: { weeklyGoal: 4 } };
    try {
      const data = JSON.parse(raw);
      if (!Array.isArray(data.plans) || !Array.isArray(data.sessions) || !Number.isInteger(data.settings?.weeklyGoal)) throw new Error();
      return { ...data, customExercises: data.customExercises || [], bodyWeights: data.bodyWeights || [], exerciseVideos: data.exerciseVideos || {} };
    } catch { throw new Error('Saved training data could not be read; your stored data has not been changed.'); }
  }
  function write(data) {
    try { storage.setItem(key, JSON.stringify(data)); }
    catch { throw new Error('Could not save. Browser storage is full or disabled. Export a backup or free some space, then retry.'); }
  }
  const catalogFor = data => [...exercises, ...data.customExercises].map(e => ({ ...e, videoUrl: data.exerciseVideos[e.id] ?? e.videoUrl ?? (demonstrations[e.id] ? `https://www.youtube.com/watch?v=${demonstrations[e.id].id}` : '') }));
  function validateBodyWeight(body) {
    const date = body?.date;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date < '1900-01-01' || date > new Date(Date.now() + 86400000).toISOString().slice(0, 10) || !Number.isFinite(body.kg) || body.kg < 1 || body.kg > 1000) throw new Error('Enter a valid date and body weight between 1 and 1000 kg.');
    return { date, kg: Math.round(body.kg * 100) / 100 };
  }
  function validateExercise(body) {
    if (typeof body?.name !== 'string' || !body.name.trim() || body.name.length > 80 || typeof body.equipment !== 'string' || !body.equipment.trim() || body.equipment.length > 80 || !['Legs', 'Chest', 'Back', 'Shoulders', 'Core', 'Arms', 'Full body'].includes(body.group) || !['reps', 'seconds'].includes(body.unit) || !Number.isInteger(body.sets) || body.sets < 1 || body.sets > 20 || !Number.isInteger(body.reps) || body.reps < 1 || body.reps > 600 || !Number.isFinite(body.weight) || body.weight < 0 || body.weight > 1000) throw new Error('Provide a name, equipment, muscle group, and valid sets, reps/seconds, and weight.');
    return { name: body.name.trim(), equipment: body.equipment.trim(), group: body.group, unit: body.unit, sets: body.sets, reps: body.reps, weight: body.weight, videoUrl: normalizeVideo(body.videoUrl) };
  }
  function buildPlan(body, catalog = exercises) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 80 || !['Strength', 'Hypertrophy', 'Conditioning'].includes(body.focus) || !Array.isArray(body.exercises) || !body.exercises.length || body.exercises.length > 20) throw new Error('Provide a name, focus, and 1–20 exercises.');
    const selected = body.exercises.map(target => {
      const original = catalog.find(e => e.id === target?.id);
      if (!original || !Number.isInteger(target.sets) || target.sets < 1 || target.sets > 20 || !Number.isInteger(target.reps) || target.reps < 1 || target.reps > 600 || !Number.isFinite(target.weight) || target.weight < 0 || target.weight > 1000) throw new Error('Use valid exercises, 1–20 sets, 1–600 reps/seconds, and 0–1000 kg.');
      return { ...original, sets: target.sets, reps: target.reps, weight: target.weight };
    });
    if (new Set(selected.map(e => e.id)).size !== selected.length) throw new Error('Choose each exercise once.');
    return { name: body.name.trim(), focus: body.focus, exercises: selected };
  }
  return {
    read,
    export: () => JSON.stringify(read(), null, 2),
    import: raw => {
      let data; try { data = JSON.parse(raw); } catch { throw new Error('Choose a valid training JSON backup.'); }
      if (!Array.isArray(data?.plans) || !Array.isArray(data.sessions) || !Number.isInteger(data.settings?.weeklyGoal) || data.settings.weeklyGoal < 1 || data.settings.weeklyGoal > 14) throw new Error('Invalid backup structure.');
      if (data.customExercises !== undefined && !Array.isArray(data.customExercises)) throw new Error('Invalid custom exercises in backup.');
      const customExercises = (data.customExercises || []).map(e => {
        if (typeof e?.id !== 'string' || !/^custom-[a-zA-Z0-9-]+$/.test(e.id)) throw new Error('Invalid custom exercise ID.');
        return { ...validateExercise(e), id: e.id };
      });
      if (new Set(customExercises.map(e => e.id)).size !== customExercises.length) throw new Error('Duplicate exercise IDs.');
      const catalog = [...exercises, ...customExercises];
      if (data.exerciseVideos !== undefined && (!data.exerciseVideos || typeof data.exerciseVideos !== 'object' || Array.isArray(data.exerciseVideos))) throw new Error('Invalid exercise videos.');
      const exerciseVideos = Object.fromEntries(Object.entries(data.exerciseVideos || {}).map(([id, value]) => {
        if (!catalog.some(e => e.id === id)) throw new Error('Invalid video exercise.');
        return [id, normalizeVideo(value)];
      }));
      const plans = data.plans.map(p => { if (typeof p.id !== 'string') throw new Error('Invalid workout ID.'); return { ...buildPlan(p, catalog), id: p.id }; });
      if (new Set(plans.map(p => p.id)).size !== plans.length) throw new Error('Duplicate workout IDs.');
      for (const s of data.sessions) {
        if (typeof s.id !== 'string' || typeof s.name !== 'string' || !Number.isFinite(Date.parse(s.date)) || !Number.isInteger(s.sets) || s.sets < 1 || !Number.isFinite(s.volume) || s.volume < 0 || !Number.isFinite(s.duration) || s.duration < 0 || (s.entries !== undefined && (!Array.isArray(s.entries) || s.entries.some(e => !e || typeof e.id !== 'string' || typeof e.exercise !== 'string' || !Number.isInteger(e.reps) || e.reps < 1 || !Number.isFinite(e.weight) || e.weight < 0 || !['seconds', 'reps'].includes(e.unit))))) throw new Error('Invalid session in backup.');
      }
      if (new Set(data.sessions.map(s => s.id)).size !== data.sessions.length) throw new Error('Duplicate session IDs.');
      if (data.bodyWeights !== undefined && !Array.isArray(data.bodyWeights)) throw new Error('Invalid body-weight history.');
      const bodyWeights = (data.bodyWeights || []).map(entry => {
        if (typeof entry?.id !== 'string' || !entry.id) throw new Error('Invalid body-weight entry ID.');
        return { ...validateBodyWeight(entry), id: entry.id };
      });
      if (new Set(bodyWeights.map(e => e.date)).size !== bodyWeights.length || new Set(bodyWeights.map(e => e.id)).size !== bodyWeights.length) throw new Error('Duplicate body-weight entries in backup.');
      bodyWeights.sort((a, b) => b.date.localeCompare(a.date));
      write({ plans, customExercises, bodyWeights, exerciseVideos, sessions: data.sessions, settings: { weeklyGoal: data.settings.weeklyGoal } });
    },
    request: async (url, options = {}) => {
      try {
        const data = read();
        const method = options.method || 'GET';
        const body = options.body ? JSON.parse(options.body) : {};
        let result;
        if (url === '/api/state' && method === 'GET') return { ok: true, json: async () => ({ ...data, exercises: structuredClone(catalogFor(data)) }) };
        if (/^\/api\/exercises\/[^/]+\/video$/.test(url) && method === 'PUT') {
          const id = url.split('/')[3];
          if (!catalogFor(data).some(e => e.id === id)) throw new Error('Exercise not found.');
          const videoUrl = normalizeVideo(body.videoUrl);
          data.exerciseVideos[id] = videoUrl; result = { id, videoUrl };
        } else if (url === '/api/body-weights'  && method === 'POST') {
          const entry = validateBodyWeight(body);
          const existing = data.bodyWeights.find(e => e.date === entry.date);
          if (existing) { Object.assign(existing, entry); result = existing; }
          else { result = { ...entry, id: uuid() }; data.bodyWeights.push(result); }
          data.bodyWeights.sort((a, b) => b.date.localeCompare(a.date));
        } else if (url.startsWith('/api/body-weights/') && method === 'DELETE') {
          const index = data.bodyWeights.findIndex(e => e.id === url.slice('/api/body-weights/'.length));
          if (index < 0) throw new Error('Body-weight entry not found.');
          data.bodyWeights.splice(index, 1); result = { ok: true };
        } else if (url === '/api/exercises' && method === 'POST') {
          const exercise = validateExercise(body);
          if ([...exercises, ...data.customExercises].some(e => e.name.toLowerCase() === exercise.name.toLowerCase())) throw new Error('An exercise with this name already exists.');
          result = { ...exercise, id: 'custom-' + uuid() }; data.customExercises.push(result);
        } else if (url === '/api/settings' && method === 'PUT') {
          if (!Number.isInteger(body.weeklyGoal) || body.weeklyGoal < 1 || body.weeklyGoal > 14) throw new Error('Weekly goal must be between 1 and 14.');
          result = data.settings = { weeklyGoal: body.weeklyGoal };
        } else if (url === '/api/plans' && method === 'POST') {
          result = { ...buildPlan(body, catalogFor(data)), id: uuid() }; data.plans.push(result);
        } else if (url.startsWith('/api/plans/') && ['PUT', 'DELETE'].includes(method)) {
          const id = url.slice('/api/plans/'.length);
          const index = data.plans.findIndex(p => p.id === id);
          if (index < 0) throw new Error('Workout no longer exists. Reload to update this tab.');
          if (method === 'PUT') result = data.plans[index] = { ...buildPlan(body, catalogFor(data)), id };
          else { data.plans.splice(index, 1); result = { ok: true }; }
        } else if (url.startsWith('/api/sessions/') && method === 'DELETE') {
          const index = data.sessions.findIndex(s => s.id === url.slice('/api/sessions/'.length));
          if (index < 0) throw new Error('Session no longer exists. Reload to update this tab.');
          data.sessions.splice(index, 1); result = { ok: true };
        } else if (url === '/api/sessions' && method === 'POST') {
          const previous = body.requestId && data.sessions.find(s => s.requestId === body.requestId);
          if (previous) return { ok: true, json: async () => previous };
          const plan = data.plans.find(p => p.id === body.planId);
          if (!plan || !Array.isArray(body.completedSets) || !body.completedSets.length || new Set(body.completedSets).size !== body.completedSets.length || !Number.isFinite(body.duration) || body.duration < 0 || body.duration > 86400 || !Array.isArray(body.entries)) throw new Error('Choose a valid workout and complete at least one set.');
          const valid = plan.exercises.flatMap(e => Array.from({ length: e.sets }, (_, i) => `${e.id}-${i}`));
          const entries = body.completedSets.map(id => {
            const entry = body.entries.find(e => e?.id === id);
            const exercise = plan.exercises.find(e => typeof id === 'string' && id.startsWith(e.id + '-'));
            if (!valid.includes(id) || !entry || !exercise || !Number.isInteger(entry.reps) || entry.reps < 1 || entry.reps > 600 || !Number.isFinite(entry.weight) || entry.weight < 0 || entry.weight > 1000) throw new Error('Invalid set: use 1–600 reps/seconds and 0–1000 kg.');
            return { id, exercise: exercise.name, reps: entry.reps, weight: entry.weight, unit: exercise.unit || (exercise.id === 'plank' ? 'seconds' : 'reps') };
          });
          result = { id: uuid(), name: plan.name, date: new Date().toISOString(), duration: body.duration, sets: entries.length, entries, volume: entries.reduce((n, e) => n + (e.unit === 'reps' ? e.reps * e.weight : 0), 0), requestId: body.requestId };
          data.sessions.unshift(result);
        } else throw new Error('Unknown training operation.');
        write(data);
        return { ok: true, json: async () => result };
      } catch (error) { return { ok: false, json: async () => ({ error: error.message }) }; }
    }
  };
}
