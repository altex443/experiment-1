export const demonstrations: Record<string, {id: string; title: string; creator: string}>;
export function youtubeId(value: unknown): string | null;
export function normalizeVideo(value: unknown): string;
export function demonstrationFor(exercise: {id: string; name: string; videoUrl?: string}): {id: string; url: string; title: string; creator: string} | null;
