import { pagesEnvironment } from './pages-config.mjs';
import { spawnSync } from 'node:child_process';
// Build-time flags only; never include server secrets in the Pages build.
let env;
try { env = pagesEnvironment(process.env, process.argv.includes('--server')); }
catch (error) { console.error(error.message); process.exit(1); }
if (!process.argv.includes('--dev')) {
  const check = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], { env, stdio: 'inherit' });
  if (check.status !== 0) process.exit(check.status || 1);
}
const args = process.argv.includes('--dev') ? ['--host', '127.0.0.1'] : ['build'];
const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', ...args], { env, stdio: 'inherit' });
process.exit(result.status || (result.error ? 1 : 0));
