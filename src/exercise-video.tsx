import { component$, useSignal } from '@builder.io/qwik';
import { demonstrationFor } from './exercise-videos.mjs';
export const ExerciseVideo = component$<{ exercise: { id: string; name: string; videoUrl?: string } }>((props) => {
  const playing = useSignal(false);
  const demo = demonstrationFor(props.exercise);
  if (!demo) return <p class="video-empty">No form video added yet.</p>;
  return <div class="exercise-video">
    {playing.value ? <div class="video-frame"><iframe key={demo.id} src={`https://www.youtube-nocookie.com/embed/${demo.id}?rel=0&playsinline=1`} title={demo.title} allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullscreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin"/></div> : <button type="button" class="video-launch" aria-label={`Watch form video for ${props.exercise.name}`} onClick$={() => playing.value = true}><span class="video-play" aria-hidden="true">▶</span><span><strong>Watch proper form</strong><small>{demo.creator}</small></span><span aria-hidden="true">↗</span></button>}
    {playing.value && <div class="video-caption"><span>{demo.creator}</span><button class="text-button" type="button" onClick$={() => playing.value = false}>Close video</button></div>}
    <a class="video-source" href={demo.url} target="_blank" rel="noopener noreferrer">{demo.title} · Open on YouTube ↗</a>
  </div>;
});
