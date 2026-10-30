const { parseArgs } = require('node:util');

function readConfig(args = process.argv.slice(2), env = process.env) {
  const { values } = parseArgs({
    args,
    options: {
      host: { type: 'string' },
      port: { type: 'string' },
      help: { type: 'boolean', short: 'h' }
    }
  });
  if (values.help) return { help: true };
  const portValue = values.port ?? env.PORT ?? '3001';
  const port = Number(portValue);
  if (!/^\d+$/.test(portValue) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Port must be an integer between 1 and 65535.');
  }
  const host = values.host ?? env.HOST ?? '127.0.0.1';
  if (!host.trim()) throw new Error('Host cannot be empty.');
  return { host, port };
}

module.exports = { readConfig };
