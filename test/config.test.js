const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readConfig } = require('../server/config');

test('startup defaults and environment configuration', () => {
  const defaults = readConfig([], {});
  assert.equal(defaults.host, '127.0.0.1');
  assert.equal(defaults.port, 3001);
  assert.deepEqual(readConfig([], { HOST: '0.0.0.0', PORT: '8080' }), {
    host: '0.0.0.0', port: 8080
  });
});

test('startup arguments override environment', () => {
  assert.deepEqual(readConfig(['--host', '::', '--port=9090'], { HOST: 'localhost', PORT: '8080' }), {
    host: '::', port: 9090
  });
  assert.deepEqual(readConfig(['--help'], { PORT: 'invalid' }), { help: true });
});

test('invalid startup configuration fails clearly', () => {
  for (const port of ['', '0', '-1', '65536', '3.5', 'abc', '1e3']) {
    assert.throws(() => readConfig(['--port=' + port], {}), /Port must/);
  }
  assert.throws(() => readConfig(['--host', ''], {}), /Host cannot/);
  assert.throws(() => readConfig(['--unknown'], {}), /Unknown option/);
});
