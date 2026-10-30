const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { createAuth } = require('../server/auth');
const { createApp } = require('../server/app');
function collection() {
  const records = new Map();
  const matches = (doc, query) => doc && Object.entries(query).every(([k, v]) => v?.$gt ? doc[k] > v.$gt : doc[k] === v);
  return {
    records, async createIndex() {},
    async insertOne(doc) {
      if (records.has(doc._id) || (doc.provider === 'local' && [...records.values()].some(x => x.provider === 'local' && x.username === doc.username))) throw Object.assign(new Error('duplicate'), { code: 11000 });
      records.set(doc._id, structuredClone(doc));
    },
    async findOne(query) { return structuredClone([...records.values()].find(doc => matches(doc, query)) || null); },
    async deleteOne(query) { const doc = [...records.values()].find(doc => matches(doc, query)); if (doc) records.delete(doc._id); }
  };
}
const secret = 'a'.repeat(64);
const credentials = { username: 'Alice', password: 'a long unique password' };
async function setup() {
  const users = collection(), sessions = collection();
  const config = { users, secret };
  return { users, sessions, config, auth: await createAuth(sessions, config) };
}
test('registration hashes passwords, normalizes usernames, prevents duplicates and logs in', async () => {
  const { auth, users, sessions } = await setup();
  const result = await auth.register(credentials);
  assert.equal(result.status, 201); assert.equal(result.user.username, 'alice');
  const raw = JSON.stringify([...users.records.values()]);
  assert.ok(!raw.includes(credentials.password)); assert.ok(!JSON.stringify(result).includes('passwordHash'));
  const cookie = result.cookie.split(';')[0];
  assert.match(result.cookie, /HttpOnly; SameSite=Lax; Max-Age=2592000/);
  assert.ok(!JSON.stringify([...sessions.records.values()]).includes(cookie.split('=')[1]));
  assert.equal((await auth.authenticated({ headers: { cookie } })).userId, result.user.userId);
  assert.equal((await auth.register({ ...credentials, username: ' ALICE ' })).status, 409);
  assert.equal((await auth.login({ ...credentials, username: 'aLiCe' })).status, 200);
  assert.equal((await auth.login({ ...credentials, password: 'wrong password here' })).status, 401);
  assert.equal((await auth.login({ ...credentials, username: 'unknown' })).status, 401);
  await auth.register({ ...credentials, username: 'Bob' });
  const hashes = [...users.records.values()].map(x => x.passwordHash);
  assert.notEqual(hashes[0], hashes[1]); // unique salt even for identical passwords
});
test('validation rejects bad usernames/passwords and registration races create one account', async () => {
  const { auth, users } = await setup();
  for (const input of [null, {}, { username: { $ne: '' }, password: credentials.password }, { username: 'ab', password: credentials.password }, { username: 'a b c', password: credentials.password }, { username: 'alice', password: 'short' }, { username: 'alice', password: 'a'.repeat(129) }]) assert.equal((await auth.register(input)).status, 400);
  const results = await Promise.all([auth.register(credentials), auth.register(credentials)]);
  assert.deepEqual(results.map(x => x.status).sort(), [201, 409]); assert.equal(users.records.size, 1);
});
test('sessions survive restarts, expire, revoke on logout and invalidate on secret/password changes', async () => {
  const { auth, users, sessions, config } = await setup();
  const result = await auth.register(credentials); const cookie = result.cookie.split(';')[0]; const req = { headers: { cookie } };
  const restarted = await createAuth(sessions, config); assert.ok(await restarted.authenticated(req));
  const rotated = await createAuth(sessions, { ...config, secret: 'b'.repeat(64) }); assert.equal(await rotated.authenticated(req), null);
  const user = users.records.values().next().value; const original = user.passwordHash; user.passwordHash = '0'.repeat(128);
  assert.equal(await auth.authenticated(req), null); user.passwordHash = original;
  sessions.records.values().next().value.expiresAt = new Date(0); assert.equal(await auth.authenticated(req), null);
  const login = await auth.login(credentials); const current = { headers: { cookie: login.cookie.split(';')[0] } };
  assert.match(await auth.logout(current), /Max-Age=0/); assert.equal(await auth.authenticated(current), null);
});
test('rate limits and secure cookie configuration are enforced', async () => {
  const { auth, sessions, config } = await setup();
  for (let i = 0; i < 20; i++) assert.equal((await auth.login({ username: 'invalid', password: 'short' }, 'one-ip')).status, 401);
  assert.equal((await auth.register(credentials, 'one-ip')).status, 429);
  await assert.rejects(() => createAuth(sessions, { ...config, sameSite: 'None' }), /requires secure/);
  const secure = await createAuth(sessions, { ...config, secure: true, sameSite: 'None' });
  assert.match((await secure.register(credentials)).cookie, /^__Host-rep_session=.*HttpOnly; SameSite=None; Max-Age=2592000; Secure$/);
});
test('HTTP registration/login/session/logout enforce authorization and derive data ownership from session', async () => {
  const { auth } = await setup(); let owner;
  const app = createApp({ request: async (url, options, userId) => { owner = userId; return { ok: true, json: async () => ({}) }; } }, { auth, allowedOrigins: ['https://app.example'], logger: { info() {}, warn() {}, debug() {}, error() {} } });
  async function call(url, method = 'GET', body, cookie, origin = 'https://app.example') {
    const req = Readable.from(body ? [JSON.stringify(body)] : []); req.url = url; req.method = method; req.headers = { cookie, origin, 'content-type': 'application/json' };
    const headers = {}; let result; const res = { statusCode: 200, setHeader: (k, v) => { headers[k] = v; }, end: data => { result = data; } };
    await app.handle(req, res); return { status: res.statusCode, headers, data: result ? JSON.parse(result) : null };
  }
  assert.equal((await call('/api/state')).status, 401);
  const registration = await call('/api/auth/register', 'POST', credentials); assert.equal(registration.status, 201);
  const cookie = registration.headers['Set-Cookie'].split(';')[0];
  assert.equal((await call('/api/auth/session', 'GET', undefined, cookie)).data.user.username, 'alice');
  assert.equal((await call('/api/state?userId=another', 'GET', undefined, cookie)).status, 200); assert.equal(owner, registration.data.user.userId);
  assert.equal((await call('/api/auth/register', 'POST', { ...credentials, username: 'evil' }, undefined, 'https://evil.example')).status, 403);
  assert.equal((await call('/api/auth/logout', 'POST', {}, cookie)).status, 200);
  assert.equal((await call('/api/state', 'GET', undefined, cookie)).status, 401);
  const login = await call('/api/auth/login', 'POST', credentials); assert.equal(login.status, 200);
  assert.equal(login.headers['Access-Control-Allow-Credentials'], 'true');
});
