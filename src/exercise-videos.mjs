export const demonstrations = {
  squat: { id: 'SW_C1A-rejs', title: 'How To: Deep Barbell Back Squat', creator: 'ScottHermanFitness' },
  bench: { id: 'rT7DgCr-3pg', title: 'How To: Barbell Bench Press', creator: 'ScottHermanFitness' },
  row: { id: 'pYcpY20QaE8', title: 'How To: Dumbbell Bent-Over Row (Single-Arm)', creator: 'ScottHermanFitness' },
  press: { id: 'qEwKCR5JCog', title: 'How To: Dumbbell Shoulder Press', creator: 'ScottHermanFitness' },
  deadlift: { id: '3VXmecChYYM', title: 'How to do the Romanian Deadlift! | 2 Minute Tutorial', creator: 'Max Euceda' },
  plank: { id: 'pSHjTRCQxIw', title: 'How To: Plank', creator: 'ScottHermanFitness' }
};
export function youtubeId(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const host = url.hostname;
    let id;
    if (host === 'youtu.be') id = url.pathname.slice(1);
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      else id = url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)\/?$/)?.[1];
    } else if (host === 'www.youtube-nocookie.com') id = url.pathname.match(/^\/embed\/([^/]+)\/?$/)?.[1];
    return /^[a-zA-Z0-9_-]{11}$/.test(id || '') ? id : null;
  } catch { return null; }
}
export function normalizeVideo(value) {
  if (value === undefined || value === null || value === '') return '';
  const id = youtubeId(value);
  if (!id) throw new Error('Use a valid HTTPS YouTube video, Shorts, or youtu.be link.');
  return `https://www.youtube.com/watch?v=${id}`;
}
export function demonstrationFor(exercise) {
  const builtin = demonstrations[exercise.id];
  const id = exercise.videoUrl !== undefined ? youtubeId(exercise.videoUrl) : builtin?.id;
  if (!id) return null;
  return { id, url: `https://www.youtube.com/watch?v=${id}`, title: builtin?.id === id ? builtin.title : `${exercise.name} · Form demonstration`, creator: builtin?.id === id ? builtin.creator : 'Custom video · YouTube' };
}
