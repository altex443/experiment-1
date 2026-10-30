const fs = require('node:fs');
const { readConfig } = require('./server/config');
const { createAuth } = require('./server/auth');
const { createApp } = require('./server/app');
const { createMongoStore } = require('./server/mongo-store');
const { createLogger, errorDetails } = require('./server/logger');
let logger = createLogger();

async function main() {
  if (fs.existsSync('.env')) process.loadEnvFile('.env');
  logger = createLogger();
  const config = readConfig();
  if (config.help) { console.log('npm start -- [--host address] [--port number]\nServer-only environment: MONGODB_URI, MONGODB_DB (default rep), SESSION_SECRET, COOKIE_SECURE, COOKIE_SAME_SITE, ALLOWED_ORIGINS, LOG_LEVEL.\nSecrets can be set in an ignored .env file.'); return; }
  logger.info('server.starting', { host: config.host, port: config.port });
  if (!process.env.MONGODB_URI || !/^mongodb(?:\+srv)?:\/\//.test(process.env.MONGODB_URI)) { logger.error('config.mongodb_uri.invalid'); process.exitCode = 1; return; }
  const sessionSecret = process.env.SESSION_SECRET || process.env.API_TOKEN;
  if (!sessionSecret || sessionSecret.length < 32) { logger.error('config.session_secret.missing_or_short'); process.exitCode = 1; return; }
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  let server;
  const started = performance.now();
  let phase = 'connect';
  try {
    logger.info('mongo.connecting');
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || 'rep');
    phase = 'ping';
    await db.command({ ping: 1 });
    logger.info('mongo.connected', { durationMs: Math.round(performance.now() - started) });
    phase = 'initialize';
    const store = await createMongoStore(db.collection('training'), logger);
    const auth = await createAuth(db.collection('sessions'), { users: db.collection('users'), secret: sessionSecret, secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production', sameSite: process.env.COOKIE_SAME_SITE || 'Lax' });
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001,http://127.0.0.1:3001').split(',').map(value => value.trim()).filter(Boolean);
    server = createApp(store, { auth, allowedOrigins, logger }).listen(config.port, config.host, () => logger.info('server.listening', { host: config.host, port: config.port }));
    server.on('error', async error => { logger.error('server.listen.failed', errorDetails(error)); await client.close(); process.exitCode = 1; });
  } catch (error) {
    logger.error('mongo.initialize.failed', { phase, durationMs: Math.round(performance.now() - started), ...errorDetails(error) });
    await client.close(); process.exitCode = 1; return;
  }
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
    if (stopping) return;
    stopping = true;
    logger.info('server.stopping', { signal });
    const timeout = setTimeout(() => { logger.error('server.shutdown.timeout'); process.exit(1); }, 10000);
    timeout.unref();
    server.close(async () => {
      try { await client.close(); logger.info('mongo.disconnected'); logger.info('server.stopped'); process.exitCode = 0; }
      catch (error) { logger.error('server.shutdown.failed', errorDetails(error)); process.exitCode = 1; }
      finally { clearTimeout(timeout); }
    });
  });
}
main().catch(error => { logger.error('server.start.failed', errorDetails(error)); process.exitCode = 1; });
