const { createApp } = require('./server/app');
const { readConfig } = require('./server/config');

try {
  const config = readConfig();
  if (config.help) {
    console.log(`Usage: npm start -- [options]

  --host <address>    Bind address (HOST; default: 127.0.0.1)
  --port <number>     HTTP port (PORT; default: 3001)
  --data-file <path>  Training JSON file (DATA_FILE; default: data/training.json)
  -h, --help         Show this help

Command-line options override environment variables.
Relative data paths resolve from the current working directory.`);
  } else {
    const server = createApp(config.dataFile).listen(config.port, config.host, () => {
      const host = config.host.includes(':') ? `[${config.host}]` : config.host;
      console.log(`Forma server listening at http://${host}:${config.port}`);
      console.log(`Training data: ${config.dataFile}`);
    });
    server.on('error', error => {
      console.error(`Unable to start Forma: ${error.message}`);
      process.exitCode = 1;
    });
  }
} catch (error) {
  console.error(`Unable to start Forma: ${error.message}`);
  process.exitCode = 1;
}
