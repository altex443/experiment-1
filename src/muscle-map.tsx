import { component$ } from '@builder.io/qwik';

const regions: Record<string, string[]> = {
  Chest: ['chest'], Back: ['upper-back', 'lats', 'lower-back'], Shoulders: ['shoulders'],
  Core: ['abs', 'obliques'], Legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  Arms: ['biceps', 'triceps', 'forearms'],
  'Full body': ['chest', 'upper-back', 'lats', 'lower-back', 'shoulders', 'abs', 'obliques', 'quads', 'hamstrings', 'glutes', 'calves', 'biceps', 'triceps', 'forearms']
};
const names: Record<string, string> = {
  Chest: 'Chest', Back: 'Upper back, lats and lower back', Shoulders: 'Shoulders',
  Core: 'Abdominals and obliques', Legs: 'Quads, hamstrings, glutes and calves', Arms: 'Biceps, triceps and forearms', 'Full body': 'Major muscle groups'
};
const front = [
  { group: 'shoulders', d: 'M32 39Q24 40 23 56L30 57 35 48Z', mirror: true },
  { group: 'chest', d: 'M36 40L48 43 48 62Q39 65 33 57L33 49Z', mirror: true },
  { group: 'biceps', d: 'M23 58L29 59 27 78 21 80Q18 70 23 58Z', mirror: true },
  { group: 'forearms', d: 'M20 83L26 81 21 108 16 112Q14 103 20 83Z', mirror: true },
  { group: 'abs', d: 'M42 66L48 67 48 76 42 75Z M42 78L48 79 48 88 42 87Z M42 90L48 91 48 101 43 97Z', mirror: true },
  { group: 'obliques', d: 'M33 63L39 68 39 91 35 98 32 85Z', mirror: true },
  { group: 'quads', d: 'M34 113Q41 108 47 115L45 148 42 155 35 151 31 128Z', mirror: true },
];
const back = [
  { group: 'upper-back', d: 'M43 33L48 36 48 61 35 50 34 40Z', mirror: true },
  { group: 'shoulders', d: 'M32 39Q24 40 23 56L30 57 35 48Z', mirror: true },
  { group: 'lats', d: 'M34 54L47 66 43 85 36 91 32 75Z', mirror: true },
  { group: 'lower-back', d: 'M45 83L48 75 48 103 37 101Z', mirror: true },
  { group: 'triceps', d: 'M23 58L29 59 27 79 21 80Q19 69 23 58Z', mirror: true },
  { group: 'forearms', d: 'M20 83L26 81 21 108 16 112Q14 103 20 83Z', mirror: true },
  { group: 'glutes', d: 'M35 105Q41 101 48 105L48 121Q41 128 33 120Z', mirror: true },
  { group: 'hamstrings', d: 'M33 125L47 127 44 153 36 155 31 135Z', mirror: true },
  { group: 'calves', d: 'M35 162L44 163 44 177 39 189 35 180Z', mirror: true }
];
const outline = 'M43 29L43 34 33 37Q24 38 21 49L17 76 12 107 10 121Q10 128 15 127L21 115 26 88 30 72 33 94 30 110Q26 123 29 140L33 158 32 177 34 196 31 202Q30 207 41 205L44 198 47 164 50 139 53 164 56 198 59 205Q70 207 69 202L66 196 68 177 67 158 71 140Q74 123 70 110L67 94 70 72 74 88 79 115 85 127Q90 128 90 121L88 107 83 76 79 49Q76 38 67 37L57 34 57 29';
export const MuscleMap = component$<{ group: string; exercise?: string; compact?: boolean }>((props) => {
  const active = regions[props.group] || [];
  const label = names[props.group] || props.group || 'No muscle group selected';
  return <figure class={{ 'muscle-map': true, 'muscle-map-compact': !!props.compact }} aria-label={`${props.exercise ? props.exercise + ': ' : ''}${label}. Illustration based on the selected muscle group.`}>
    <div class="muscle-views">{[front, back].map((view, index) => <div class="muscle-view" key={index}><svg viewBox="0 0 100 212" role="img" aria-label={`${index ? 'Back' : 'Front'} view: ${label}`}><ellipse cx="50" cy="16" rx="11" ry="13" class="body-outline"/><path d={outline} class="body-outline"/><path d="M50 37V104 M34 158L44 158 M56 158H66" class="body-detail"/>{view.map((region, i) => <g key={i} class={{ 'muscle-region': true, 'muscle-active': active.includes(region.group) }}><path d={region.d}/>{region.mirror && <path d={region.d} transform="translate(100 0) scale(-1 1)"/>}</g>)}</svg><span>{index ? 'Back' : 'Front'}</span></div>)}</div>
    <figcaption><span class="muscle-legend"><i/>{label}</span><small>Selected muscle group</small></figcaption>
  </figure>;
});
