const levels = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

// Intentionally exclude driver messages/stacks: they can contain connection strings.
function errorDetails(error) {
  const names = ['MongoServerError', 'MongoNetworkError', 'MongoServerSelectionError', 'MongoParseError', 'TypeError', 'SyntaxError'];
  const details = { errorType: names.includes(error?.name) ? error.name : 'Error' };
  if (Number.isInteger(error?.code)) details.errorCode = error.code;
  else if (['EADDRINUSE', 'EACCES', 'EPERM', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'].includes(error?.code)) details.errorCode = error.code;
  return details;
}
function createLogger({ level = process.env.LOG_LEVEL || 'info', write = line => process.stdout.write(line + '\n') } = {}) {
  if (!(level in levels)) throw new Error('LOG_LEVEL must be debug, info, warn, error, or silent.');
  const logger = {};
  for (const severity of ['debug', 'info', 'warn', 'error']) {
    logger[severity] = (event, fields = {}) => {
      if (levels[severity] < levels[level]) return;
      // Only operational metadata may be emitted, never bodies, headers, URIs, or tokens.
      const safe = {};
      for (const key of ['requestId', 'method', 'route', 'status', 'durationMs', 'attempt', 'host', 'port', 'signal', 'errorType', 'errorCode', 'phase', 'created']) {
        if (['string', 'number', 'boolean'].includes(typeof fields[key])) safe[key] = fields[key];
      }
      write(JSON.stringify({ time: new Date().toISOString(), level: severity, event, ...safe }));
    };
  }
  return logger;
}
module.exports = { createLogger, errorDetails };
