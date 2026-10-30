const { randomBytes, randomUUID, createHash, createHmac, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const derive = promisify(scrypt);
const hash = value => createHash('sha256').update(value).digest('hex');
const passwordKey = (password, salt) => derive(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const normalize = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const validUsername = value => /^[a-z0-9][a-z0-9_.-]{2,31}$/.test(value);
const validPassword = value => typeof value === 'string' && value.length >= 12 && value.length <= 128;

async function createAuth(sessions, { users, secret, secure = false, sameSite = 'Lax', lifetimeMs = 30 * 86400000 } = {}) {
  if (!users || !secret || secret.length < 32) throw new Error('Configure users collection and SESSION_SECRET (at least 32 characters).');
  if (!['Lax', 'Strict', 'None'].includes(sameSite) || (sameSite === 'None' && !secure)) throw new Error('SameSite=None requires secure cookies.');
  await users.createIndex({ username: 1 }, { unique: true, partialFilterExpression: { provider: 'local' } });
  await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  const dummySalt = randomBytes(16).toString('hex');
  const dummyHash = await passwordKey(randomBytes(32).toString('hex'), dummySalt);
  const name = secure ? '__Host-rep_session' : 'rep_session';
  const cookie = (value, age) => `${name}=${value}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${age}${secure ? '; Secure' : ''}`;
  function token(req) {
    const value = (req.headers?.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(name + '='))?.slice(name.length + 1);
    return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
  }
  const version = user => createHmac('sha256', secret).update(user._id + '\0' + user.passwordHash).digest('hex');
  const publicUser = user => ({ userId: user._id, name: user.name, username: user.username });
  const attempts = new Map();
  let hashing = 0;
  async function authenticate(input, address = 'unknown', register = false) {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    const entry = attempts.get(address) || { count: 0, until: now + 15 * 60000 };
    if (entry.count >= 20 || hashing >= 4 || (!attempts.has(address) && attempts.size >= 10000)) return { status: 429, error: 'Too many attempts. Please try again later.' };
    entry.count++; attempts.set(address, entry);
    const username = normalize(input?.username);
    if (!validUsername(username) || !validPassword(input?.password)) return { status: register ? 400 : 401, error: register ? 'Use a username of 3–32 letters, digits, dots, underscores or hyphens, and a password of 12–128 characters.' : 'Incorrect username or password.' };
    hashing++;
    try {
      let user;
      if (register) {
        const salt = randomBytes(16).toString('hex');
        const key = await passwordKey(input.password, salt);
        user = { _id: 'local:' + randomUUID(), provider: 'local', username, name: input.username.trim(), passwordSalt: salt, passwordHash: key.toString('hex'), createdAt: new Date() };
        try { await users.insertOne(user); }
        catch (error) { if (error.code === 11000) return { status: 409, error: 'That username is already registered. Choose another or sign in.' }; throw error; }
      } else {
        user = await users.findOne({ provider: 'local', username });
        const key = await passwordKey(input.password, user?.passwordSalt || dummySalt);
        const expected = user?.passwordHash ? Buffer.from(user.passwordHash, 'hex') : dummyHash;
        if (key.length !== expected.length || !timingSafeEqual(key, expected) || !user) return { status: 401, error: 'Incorrect username or password.' };
      }
      const value = randomBytes(32).toString('hex');
      await sessions.insertOne({ _id: hash(value), userId: user._id, version: version(user), expiresAt: new Date(Date.now() + lifetimeMs) });
      return { status: register ? 201 : 200, cookie: cookie(value, Math.floor(lifetimeMs / 1000)), user: publicUser(user) };
    } finally { hashing--; }
  }
  return {
    login: (input, address) => authenticate(input, address, false),
    register: (input, address) => authenticate(input, address, true),
    async authenticated(req) {
      const value = token(req); if (!value) return null;
      const session = await sessions.findOne({ _id: hash(value), expiresAt: { $gt: new Date() } });
      if (!session?.userId) return null;
      const user = await users.findOne({ _id: session.userId, provider: 'local' });
      return user?.passwordHash && session.version === version(user) ? publicUser(user) : null;
    },
    async logout(req) { const value = token(req); if (value) await sessions.deleteOne({ _id: hash(value) }); return cookie('', 0); }
  };
}
module.exports = { createAuth };
