const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { readConfig } = require('../server/config');

test('startup defaults and environment configuration', () => {
  const defaults = readConfig([], {});
  assert.equal(defaults.host, '127.0.0.1');
  assert.equal(defaults.port, 3001);
  assert.equal(defaults.dataFile, path.resolve(__dirname, '../data/training.json'));
  assert.deepEqual(readConfig([], { HOST: '0.0.0.0', PORT: '8080', DATA_FILE: '/var/data/training.json' }), {
    host: '0.0.0.0', port: 8080, dataFile: '/var/data/training.json'
  });
});

test('startup arguments override environment and resolve relative paths', () => {
  assert.deepEqual(readConfig(['--host', '::', '--port=9090', '--data-file', 'storage/training.json'], { HOST: 'localhost', PORT: '8080', DATA_FILE: '/tmp/old.json' }), {
    host: '::', port: 9090, dataFile: path.resolve('storage/training.json')
  });
  assert.deepEqual(readConfig(['--help'], { PORT: 'invalid' }), { help: true });
});

test('invalid startup configuration fails clearly', () => {
  for (const port of ['', '0', '-1', '65536', '3.5', 'abc', '1e3']) {
    assert.throws(() => readConfig(['--port=' + port], {}), /Port must/);
  }
  assert.throws(() => readConfig(['--host', ''], {}), /Host cannot/);
  assert.throws(() => readConfig(['--data-file', ''], {}), /Data file cannot/);
  assert.throws(() => readConfig(['--unknown'], {}), /Unknown option/);
});
