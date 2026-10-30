export function buildAnalytics(sessions: any[], weights: any[], exercises: any[], days?: number, now?: number): {
  days: number; start: string; end: string; sessions: number; previousSessions: number; sets: number; volume: number; volumeChange: number | null;
  minutes: number; averageMinutes: number | null; activeDays: number; sessionsPerWeek: number;
  latestWeight: { kg: number; date: string } | null; weightAgeDays: number | null; weightChange: number | null; weightChangePercent: number | null;
  averageWeight: number | null; rollingWeight: number | null; measurements: number;
  weightPoints: { day: number; value: number; label: string }[]; averagePoints: { day: number; value: number; label: string }[];
  buckets: { label: string; end: string; sessions: number; volume: number; sets: number }[];
  activity: { label: string; count: number }[];
  lifts: { id: string; name: string; sets: number; bestKg: number; bestRatio: number | null; volume: number }[];
  byGroup: { name: string; sets: number; share: number }[]; detailedSets: number; legacySessions: number;
};
export function chartGeometry(points: { day: number; value: number; label: string }[], width?: number, height?: number): { path: string; points: { x: number; y: number; value: number; label: string }[]; min: number | null; max: number | null };

export function bodyWeightForDate(weights: {date: string; kg: number}[], date: string): {kg: number; date: string} | null;
