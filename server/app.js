const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createLogger, errorDetails } = require('./logger');
const { randomUUID } = require('node:crypto');

function createApp(store, { auth, allowedOrigins = [], logger = createLogger() } = {}) {
  const handle = async (req, res) => {
    const started = performance.now();
    const requestId = randomUUID();
    let route = 'static';
    const method = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'].includes(req.method) ? req.method : 'OTHER';
    res.setHeader('X-Request-Id', requestId);
    const json = (status, value) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        route = /^\/api\/(state|health|backup|migrate|draft|settings|plans|exercises|sessions|body-weights)$/.test(url.pathname) ? url.pathname : /^\/api\/(plans|sessions|body-weights)\/[^/]+$/.test(url.pathname) ? url.pathname.replace(/\/[^/]+$/, '/:id') : '/api/unknown';
        if (/^\/api\/exercises\/[^/]+\/video$/.test(url.pathname)) route = '/api/exercises/:id/video';
        if (['/api/auth/login', '/api/auth/register', '/api/auth/session', '/api/auth/logout'].includes(url.pathname)) route = url.pathname;
        res.setHeader('Cache-Control', 'no-store');
        const origin = req.headers?.origin;
        if (origin && !allowedOrigins.includes(origin)) return json(403, { error: 'This frontend origin is not allowed.' });
        if (origin) { res.setHeader('Access-Control-Allow-Credentials', 'true'); res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.statusCode = 204; return res.end();
        }
        if (url.pathname === '/api/health' && req.method === 'GET') return json(200, { ok: true });
        const publicAuth = req.method === 'POST' && ['/api/auth/login', '/api/auth/register'].includes(url.pathname);
        const principal = publicAuth ? null : await auth?.authenticated(req);
        if (!publicAuth && !principal?.userId) return json(401, { error: 'Please sign in to continue.' });
        if (['POST', 'PUT', 'DELETE'].includes(req.method) && !req.headers?.['content-type']?.toLowerCase().startsWith('application/json')) return json(415, { error: 'Use application/json.' });
        let body = '';
        if (['POST', 'PUT'].includes(req.method)) {
          for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > (publicAuth ? 4096 : 10 * 1024 * 1024)) return json(413, { error: 'Request is too large.' }); }
          try { JSON.parse(body); } catch { return json(400, { error: 'Invalid JSON.' }); }
        }
        if (publicAuth) {
          const result = await (url.pathname.endsWith('/register') ? auth.register : auth.login)(JSON.parse(body), req.socket?.remoteAddress);
          if (result.cookie) res.setHeader('Set-Cookie', result.cookie);
          logger[result.error ? 'warn' : 'info'](result.error ? 'auth.rejected' : url.pathname.endsWith('/register') ? 'auth.registered' : 'auth.signed_in', { requestId, status: result.status });
          return json(result.status, result.error ? { error: result.error } : { user: result.user });
        }
        if (url.pathname === '/api/auth/session' && req.method === 'GET') return json(200, { authenticated: true, user: principal });
        if (url.pathname === '/api/auth/logout' && req.method === 'POST') { res.setHeader('Set-Cookie', await auth.logout(req)); return json(200, { ok: true }); }
        const response = await store.request(url.pathname, { method: req.method, body: body || undefined }, principal.userId);
        return json(response.ok ? 200 : 400, await response.json());
      }
      if (req.method !== 'GET') return json(404, { error: 'Not found.' });
      const root = path.resolve(__dirname, '../dist');
      const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (!file.startsWith(root + path.sep)) return json(403, { error: 'Forbidden.' });
      try {
        const data = await fs.readFile(file);
        const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
        res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.end(data);
      } catch (error) { if (['ENOENT', 'EISDIR'].includes(error.code)) return json(404, { error: 'Not found. Run npm run build first.' }); throw error; }
    } catch (error) {
      logger.error('request.failed', { requestId, method, route, ...errorDetails(error) });
      json(503, { error: 'Database operation failed. Please retry shortly.' });
    } finally {
      const status = res.statusCode || 200;
      const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : route === 'static' || route === '/api/health' || method === 'OPTIONS' ? 'debug' : 'info';
      logger[level]('request.completed', { requestId, method, route, status, durationMs: Math.round(performance.now() - started) });
    }
  };
  return { handle, listen: (...args) => http.createServer(handle).listen(...args) };
}
module.exports = { createApp };
