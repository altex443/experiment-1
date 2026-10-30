const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mongoOptions, connectionDiagnosis } = require('../server/mongo-connection');
test('MongoDB diagnostics classify nested failures without emitting credentials', () => {
  const error = { name: 'MongoServerSelectionError', message: 'mongodb://user:secret@host', reason: { servers: new Map([['host', { error: { cause: { code: 'ECONNREFUSED', syscall: 'querySrv', message: 'secret' } } }]]) } };
  const result = connectionDiagnosis(error);
  assert.equal(result.cause, 'dns_srv'); assert.ok(!JSON.stringify(result).includes('secret'));
  assert.equal(connectionDiagnosis({ cause: { code: 18 } }).cause, 'authentication');
  assert.equal(connectionDiagnosis({ cause: { code: 'CERT_HAS_EXPIRED' } }).cause, 'tls');
  assert.equal(connectionDiagnosis({ cause: { code: 'EPERM' } }).cause, 'network_permission');
  assert.equal(connectionDiagnosis({ cause: { code: 'ENOTFOUND' } }).cause, 'dns');
  assert.equal(connectionDiagnosis({ cause: { code: 'ECONNREFUSED' } }).cause, 'connection_refused');
  assert.equal(connectionDiagnosis(new Error('credentials secret')).cause, 'server_selection');
  const cyclic = {}; cyclic.cause = cyclic; assert.equal(connectionDiagnosis(cyclic).cause, 'server_selection');
});
test('MongoDB connection uses bounded options and permits explicit IP-family configuration', () => {
  assert.equal(mongoOptions({}).maxPoolSize, 10);
  assert.equal(mongoOptions({}).family, undefined);
  assert.equal(mongoOptions({ MONGODB_IP_FAMILY: '4' }).family, 4);
  assert.throws(() => mongoOptions({ MONGODB_IP_FAMILY: 'invalid' }), /must be 4 or 6/);
});
