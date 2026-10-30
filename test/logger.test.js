const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { createLogger, errorDetails } = require('../server/logger');
const { createApp } = require('../server/app');

test('structured logs respect levels and omit secrets and raw errors', () => {
  const lines = [];
  const logger = createLogger({ level: 'info', write: line => lines.push(line) });
  logger.debug('hidden');
  logger.info('test', { requestId: '123', token: 'secret', body: 'secret', uri: 'mongodb://secret', headers: { authorization: 'secret' } });
  logger.error('failed', errorDetails({ name: 'MongoNetworkError', code: 'ECONNREFUSED', message: 'mongodb://secret', stack: 'secret' }));
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]).requestId, '123');
  assert.ok(!lines.join('').includes('secret'));
  assert.equal(JSON.parse(lines[1]).errorCode, 'ECONNREFUSED');
  assert.equal(JSON.parse(lines[1]).errorType, 'MongoNetworkError');
  assert.ok(!Number.isNaN(Date.parse(JSON.parse(lines[0]).time)));
  createLogger({ level: 'silent', write: () => assert.fail('should be silent') }).error('hidden');
  assert.throws(() => createLogger({ level: 'invalid' }), /LOG_LEVEL/);
});

test('API logs include correlation, status and duration, without URL queries or raw database errors', async () => {
  const lines = [];
  const logger = createLogger({ write: line => lines.push(JSON.parse(line)) });
  const app = createApp({ request: async () => { throw Object.assign(new Error('mongodb://secret'), { name: 'MongoNetworkError' }); } }, { auth: { authenticated: async () => ({ userId: 'test-user' }) }, logger });
  const req = Readable.from([]);
  req.url = '/api/state?password=secret'; req.method = 'GET'; req.headers = { authorization: 'Bearer secret' };
  const headers = {}; let body;
  const res = { statusCode: 200, setHeader: (key, value) => { headers[key] = value; }, end: value => { body = value; } };
  await app.handle(req, res);
  assert.equal(res.statusCode, 503);
  const completion = lines.find(line => line.event === 'request.completed');
  const failure = lines.find(line => line.event === 'request.failed');
  assert.equal(completion.requestId, headers['X-Request-Id']);
  assert.equal(failure.requestId, completion.requestId);
  assert.equal(completion.route, '/api/state');
  assert.equal(completion.status, 503);
  assert.ok(completion.durationMs >= 0);
  assert.ok(!JSON.stringify(lines).includes('secret'));
  assert.ok(!body.includes('secret'));
});
