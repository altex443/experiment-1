const { test } = require('node:test');
const assert = require('node:assert/strict');
test('video parser permits only safe YouTube IDs and supports standard link formats', async () => {
  const { youtubeId, normalizeVideo, demonstrationFor, demonstrations } = await import('../src/exercise-videos.mjs');
  for (const url of ['https://www.youtube.com/watch?v=pSHjTRCQxIw', 'https://youtu.be/pSHjTRCQxIw', 'https://www.youtube.com/shorts/pSHjTRCQxIw', 'https://www.youtube-nocookie.com/embed/pSHjTRCQxIw']) assert.equal(youtubeId(url), 'pSHjTRCQxIw');
  for (const url of ['http://youtu.be/pSHjTRCQxIw', 'javascript:alert(1)', 'https://youtube.com.evil.example/watch?v=pSHjTRCQxIw', 'https://user:pass@youtube.com/watch?v=pSHjTRCQxIw', 'https://youtu.be/bad', 'https://youtu.be/pSHjTRCQxIw/other', 'https://evil.example/embed/pSHjTRCQxIw']) assert.equal(youtubeId(url), null);
  assert.throws(() => normalizeVideo('https://evil.example'), /valid HTTPS YouTube/);
  assert.equal(demonstrationFor({ id: 'bench', name: 'Bench' }).id, demonstrations.bench.id);
  assert.equal(demonstrationFor({ id: 'bench', name: 'Bench', videoUrl: '' }), null);
  assert.equal(demonstrationFor({ id: 'custom', name: 'Curl' }), null);
});
