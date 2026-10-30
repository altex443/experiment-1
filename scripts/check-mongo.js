const fs = require('node:fs');
const path = require('node:path');
const { mongoOptions, connectionDiagnosis } = require('../server/mongo-connection');
const { errorDetails } = require('../server/logger');
async function main() {
  const file = path.join(__dirname, '../.env');
  if (fs.existsSync(file)) process.loadEnvFile(file);
  if (!/^mongodb(?:\+srv)?:\/\//.test(process.env.MONGODB_URI || '')) throw new Error('Set MONGODB_URI in the ignored .env file.');
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(process.env.MONGODB_URI, mongoOptions());
  try {
    console.log('Checking MongoDB connection (credentials hidden; timeout 10 seconds)...');
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || 'rep');
    await db.command({ ping: 1 });
    console.log('MongoDB connection and ping succeeded.');
  } catch (error) {
    console.error(JSON.stringify({ event: 'mongo.check.failed', ...errorDetails(error), ...connectionDiagnosis(error) }));
    process.exitCode = 1;
  } finally { await client.close(); }
}
main().catch(error => {
  console.error(JSON.stringify({ event: 'mongo.check.configuration_failed', ...errorDetails(error), hint: 'Check MONGODB_URI and MONGODB_IP_FAMILY, then run npm install. Credentials and raw error messages are hidden.' }));
  process.exitCode = 1;
});
