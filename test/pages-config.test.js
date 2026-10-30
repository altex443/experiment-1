const { test } = require('node:test');
const assert = require('node:assert/strict');
test('connected Pages build requires an HTTPS backend and keeps repository path', async () => {
  const { pagesEnvironment } = await import('../scripts/pages-config.mjs');
  const env = pagesEnvironment({ VITE_API_URL: ' https://api.example.com/ ', BASE_PATH: '/experiment-1/' }, true);
  assert.equal(env.VITE_STORAGE_MODE, 'server'); assert.equal(env.VITE_API_URL, 'https://api.example.com'); assert.equal(env.BASE_PATH, '/experiment-1/');
  for (const value of ['https://altex443.github.io', '', 'http://api.example.com', 'https://user:password@api.example.com', 'https://localhost', 'https://api.example.com/api', 'https://api.example.com/?token=secret']) assert.throws(() => pagesEnvironment({ VITE_API_URL: value }, true), /VITE_API_URL/);
});
test('standalone build remains an explicit choice and clears any old API URL', async () => {
  const { pagesEnvironment } = await import('../scripts/pages-config.mjs');
  const env = pagesEnvironment({ VITE_API_URL: 'https://api.example.com', VITE_STORAGE_MODE: 'server' });
  assert.equal(env.VITE_STORAGE_MODE, 'local'); assert.equal(env.VITE_API_URL, '');
});

test('client detects missing or GitHub Pages API destinations before requesting login', async () => {
  const { apiConfigurationError } = await import('../src/api-config.mjs');
  assert.match(apiConfigurationError('', 'altex443.github.io'), /VITE_API_URL/);
  assert.match(apiConfigurationError('https://altex443.github.io', 'altex443.github.io'), /Node backend/);
  assert.equal(apiConfigurationError('https://api.example.com', 'altex443.github.io'), null);
  assert.equal(apiConfigurationError('', 'localhost'), null);
  assert.match(apiConfigurationError('https://user:secret@api.example.com', 'localhost'), /Backend URL/);
});
