const DAY = 86400000;
function localDay(value) {
  const date = new Date(value);
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY);
}
const key = day => new Date(day * DAY).toISOString().slice(0, 10);
const mean = values => values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : null;
export function bodyWeightForDate(weights, date) {
  const day = localDay(date);
  const match = weights.filter(w => Number.isFinite(w.kg) && w.kg > 0 && Number.isFinite(Date.parse(w.date)) && Date.parse(w.date) / DAY <= day && day - Date.parse(w.date) / DAY <= 30).sort((a, b) => b.date.localeCompare(a.date))[0];
  return match ? { kg: match.kg, date: match.date } : null;
}
export function buildAnalytics(sessions = [], weights = [], exercises = [], days = 28, now = Date.now()) {
  if (![28, 90, 365].includes(days)) days = 28;
  const end = localDay(now), start = end - days + 1;
  const validSessions = sessions.filter(s => Number.isFinite(Date.parse(s.date)) && Date.parse(s.date) <= now).map(s => ({ ...s, day: localDay(s.date) }));
  const orderedWeights = weights.filter(w => Number.isFinite(w.kg) && w.kg > 0 && /^\d{4}-\d{2}-\d{2}$/.test(w.date) && Date.parse(w.date) / DAY <= end).map(w => ({ ...w, day: Date.parse(w.date) / DAY })).sort((a, b) => a.day - b.day);
  const current = validSessions.filter(s => s.day >= start && s.day <= end);
  const previous = validSessions.filter(s => s.day >= start - days && s.day < start);
  const measurements = orderedWeights.filter(w => w.day >= start);
  const weightPoints = measurements.map(w => ({ day: w.day, value: w.kg, label: w.date }));
  const averagePoints = measurements.map(w => ({ day: w.day, value: mean(orderedWeights.filter(p => p.day <= w.day && p.day >= w.day - 6).map(p => p.kg)), label: w.date }));
  const latest = orderedWeights.at(-1) || null;
  const weightChange = measurements.length > 1 ? measurements.at(-1).kg - measurements[0].kg : null;
  const volume = current.reduce((n, s) => n + s.volume, 0);
  const previousVolume = previous.reduce((n, s) => n + s.volume, 0);
  const volumeChange = previousVolume > 0 ? (volume - previousVolume) / previousVolume * 100 : null;
  const buckets = [];
  const bucketDays = days === 28 ? 7 : days === 90 ? 15 : 31;
  for (let day = start; day <= end; day += bucketDays) {
    const last = Math.min(end, day + bucketDays - 1);
    const entries = current.filter(s => s.day >= day && s.day <= last);
    buckets.push({ label: key(day), end: key(last), sessions: entries.length, volume: entries.reduce((n, s) => n + s.volume, 0), sets: entries.reduce((n, s) => n + s.sets, 0) });
  }
  const activity = Array.from({ length: days === 28 ? 28 : 84 }, (_, i) => {
    const day = end - (days === 28 ? 27 : 83) + i;
    return { label: key(day), count: validSessions.filter(s => s.day === day).length };
  });
  const activeDays = new Set(current.map(s => s.day)).size;
  const lifts = new Map(), groups = new Map();
  let detailedSets = 0;
  for (const session of current) for (const entry of session.entries || []) {
    detailedSets++;
    const exerciseId = entry.id.slice(0, entry.id.lastIndexOf('-'));
    const exercise = exercises.find(e => e.id === exerciseId || e.name === entry.exercise);
    const group = exercise?.group || 'Other';
    groups.set(group, (groups.get(group) || 0) + 1);
    if (entry.unit !== 'reps' || !(entry.weight > 0)) continue;
    const historicalWeight = orderedWeights.findLast(w => w.day <= session.day && session.day - w.day <= 30);
    const ratio = historicalWeight ? entry.weight / historicalWeight.kg : null;
    const id = exerciseId || entry.exercise;
    const item = lifts.get(id) || { id, name: entry.exercise, sets: 0, bestKg: 0, bestRatio: null, volume: 0 };
    item.sets++; item.bestKg = Math.max(item.bestKg, entry.weight);
    if (ratio !== null) item.bestRatio = Math.max(item.bestRatio || 0, ratio);
    item.volume += entry.reps * entry.weight; lifts.set(id, item);
  }
  const byGroup = [...groups].map(([name, sets]) => ({ name, sets, share: detailedSets ? sets / detailedSets * 100 : 0 })).sort((a, b) => b.sets - a.sets);
  return {
    days, start: key(start), end: key(end), sessions: current.length, previousSessions: previous.length,
    sets: current.reduce((n, s) => n + s.sets, 0), volume, volumeChange,
    minutes: current.reduce((n, s) => n + s.duration, 0) / 60,
    averageMinutes: current.length ? current.reduce((n, s) => n + s.duration, 0) / current.length / 60 : null,
    activeDays, sessionsPerWeek: current.length / (days / 7),
    latestWeight: latest, weightAgeDays: latest ? end - latest.day : null,
    weightChange, weightChangePercent: weightChange !== null ? weightChange / measurements[0].kg * 100 : null,
    averageWeight: mean(measurements.map(w => w.kg)), rollingWeight: latest ? mean(orderedWeights.filter(w => w.day >= end - 6).map(w => w.kg)) : null,
    measurements: measurements.length, weightPoints, averagePoints, buckets, activity,
    lifts: [...lifts.values()].sort((a, b) => b.volume - a.volume), byGroup, detailedSets,
    legacySessions: current.filter(s => !s.entries?.length).length
  };
}
// Calendar-day spacing, padded bounds, and a centered single point avoid misleading trends.
export function chartGeometry(points, width = 600, height = 190) {
  const clean = points.filter(p => Number.isFinite(p.day) && Number.isFinite(p.value)).sort((a, b) => a.day - b.day);
  if (!clean.length) return { path: '', points: [], min: null, max: null };
  const low = Math.min(...clean.map(p => p.value)), high = Math.max(...clean.map(p => p.value));
  const pad = Math.max((high - low) * .2, .5), min = low - pad, max = high + pad;
  const first = clean[0].day, last = clean.at(-1).day;
  const plotted = clean.map(p => ({ ...p, x: first === last ? width / 2 : 12 + (p.day - first) / (last - first) * (width - 24), y: 12 + (max - p.value) / (max - min) * (height - 24) }));
  return { min, max, points: plotted, path: plotted.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') };
}
