const path = require('node:path');
const { parseArgs } = require('node:util');

function readConfig(args = process.argv.slice(2), env = process.env) {
  const { values } = parseArgs({
    args,
    options: {
      host: { type: 'string' },
      port: { type: 'string' },
      'data-file': { type: 'string' },
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
  const dataFile = values['data-file'] ?? env.DATA_FILE ?? path.join(__dirname, '../data/training.json');
  if (!dataFile.trim()) throw new Error('Data file cannot be empty.');
  return { host, port, dataFile: path.resolve(dataFile) };
}

module.exports = { readConfig };
