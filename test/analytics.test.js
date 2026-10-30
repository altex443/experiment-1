const { test } = require('node:test');
const assert = require('node:assert/strict');
const now = new Date(2026, 9, 30, 12).getTime();
const stamp = (month, day) => new Date(2026, month - 1, day, 10).toISOString();
const session = (date, volume, entries = []) => ({ date, volume, entries, sets: entries.length || 3, duration: 1800 });

test('calendar ranges compare equal periods and exclude future sessions', async () => {
  const { buildAnalytics } = await import('../src/analytics.mjs');
  const sessions = [session(stamp(10, 3), 1000), session(stamp(10, 30), 2000), session(stamp(10, 2), 1500), session(stamp(11, 1), 99999)];
  const a = buildAnalytics(sessions, [], [], 28, now);
  assert.equal(a.start, '2026-10-03'); assert.equal(a.sessions, 2); assert.equal(a.previousSessions, 1);
  assert.equal(a.volume, 3000); assert.equal(a.volumeChange, 100); assert.equal(a.minutes, 60); assert.equal(a.averageMinutes, 30);
  assert.equal(a.buckets.reduce((n, b) => n + b.volume, 0), 3000);
  assert.equal(a.activeDays, 2); assert.equal(a.sessionsPerWeek, .5);
});
test('weight metrics respect calendar windows, sort input, and never fill missing days', async () => {
  const { buildAnalytics } = await import('../src/analytics.mjs');
  const weights = [{ date: '2026-10-30', kg: 80 }, { date: '2026-10-23', kg: 90 }, { date: '2026-10-24', kg: 84 }, { date: '2026-09-01', kg: 100 }];
  const a = buildAnalytics([], weights, [], 28, now);
  assert.equal(a.weightChange, -10); assert.equal(a.weightChangePercent, -10 / 90 * 100);
  assert.equal(a.averageWeight, 254 / 3); assert.equal(a.rollingWeight, 82);
  assert.equal(a.measurements, 3); assert.equal(a.weightPoints.length, 3);
  assert.equal(a.latestWeight.kg, 80); assert.equal(a.weightAgeDays, 0);
});
test('relative strength uses historical body weight, excludes timed holds, and preserves external volume', async () => {
  const { buildAnalytics, bodyWeightForDate } = await import('../src/analytics.mjs');
  const entries = [{ id: 'bench-0', exercise: 'Bench press', reps: 10, weight: 50, unit: 'reps' }, { id: 'plank-0', exercise: 'Plank', reps: 30, weight: 5, unit: 'seconds' }];
  const weights = [{ date: '2026-10-01', kg: 100 }, { date: '2026-10-06', kg: 40 }];
  const a = buildAnalytics([session(stamp(10, 5), 500, entries)], weights, [{ id: 'bench', group: 'Chest' }, { id: 'plank', group: 'Core' }], 28, now);
  assert.equal(a.lifts.length, 1); assert.equal(a.lifts[0].bestRatio, .5); assert.equal(a.lifts[0].volume, 500);
  assert.equal(a.byGroup.length, 2); assert.equal(a.byGroup[0].share, 50);
  assert.deepEqual(bodyWeightForDate(weights, stamp(10, 5)), { kg: 100, date: '2026-10-01' });
  assert.equal(bodyWeightForDate([{ date: '2026-08-01', kg: 100 }], stamp(10, 5)), null);
  const stale = buildAnalytics([session(stamp(10, 5), 500, entries)], [{ date: '2026-08-01', kg: 100 }], [], 28, now);
  assert.equal(stale.lifts[0].bestRatio, null);
});
test('empty, single-reading, zero-baseline and legacy histories have explicit missing metrics', async () => {
  const { buildAnalytics } = await import('../src/analytics.mjs');
  const empty = buildAnalytics([], [], [], 28, now);
  assert.equal(empty.weightChange, null); assert.equal(empty.volumeChange, null); assert.equal(empty.averageMinutes, null); assert.equal(empty.rollingWeight, null);
  const single = buildAnalytics([session(stamp(10, 5), 100)], [{ date: '2026-10-01', kg: 80 }], [], 28, now);
  assert.equal(single.latestWeight.kg, 80); assert.equal(single.measurements, 0); assert.equal(single.weightChange, null); assert.equal(single.legacySessions, 1);
  assert.equal(single.lifts.length, 0);
});
test('chart geometry uses real date spacing and handles flat or single-point data', async () => {
  const { chartGeometry } = await import('../src/analytics.mjs');
  const points = [{ day: 0, value: 80, label: 'a' }, { day: 1, value: 80, label: 'b' }, { day: 10, value: 80, label: 'c' }];
  const chart = chartGeometry(points);
  assert.ok(chart.min < 80 && chart.max > 80);
  assert.ok(Math.abs((chart.points[1].x - chart.points[0].x) / (chart.points[2].x - chart.points[0].x) - .1) < .00001);
  assert.equal(chartGeometry([points[0]]).points[0].x, 300);
  assert.equal(chartGeometry([]).path, '');
  assert.ok(!chart.path.includes('NaN'));
});
test('all supported ranges have complete, correctly bounded buckets', async () => {
  const { buildAnalytics } = await import('../src/analytics.mjs');
  for (const days of [28, 90, 365]) {
    const a = buildAnalytics([session(stamp(10, 30), 400)], [], [], days, now);
    assert.equal(a.buckets[0].label, a.start); assert.equal(a.buckets.at(-1).end, a.end);
    assert.equal(a.buckets.reduce((n, b) => n + b.sessions, 0), 1);
    assert.equal(a.activity.length, days === 28 ? 28 : 84);
  }
});
