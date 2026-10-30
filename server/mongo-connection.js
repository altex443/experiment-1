function mongoOptions(env = process.env) {
  const options = { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000, maxPoolSize: 10 };
  if (env.MONGODB_IP_FAMILY) {
    if (!['4', '6'].includes(env.MONGODB_IP_FAMILY)) throw new Error('MONGODB_IP_FAMILY must be 4 or 6.');
    options.family = Number(env.MONGODB_IP_FAMILY);
  }
  return options;
}
function connectionDiagnosis(error) {
  const nodes = [], seen = new Set();
  function walk(value) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value); nodes.push(value); walk(value.cause); walk(value.reason); walk(value.error);
    if (value.servers?.values) for (const server of value.servers.values()) walk(server);
  }
  walk(error);
  // Raw messages can contain credentials. Inspect structured fields only, never emit them wholesale.
  if (nodes.some(e => ['querySrv', 'queryTxt'].includes(e.syscall))) return { cause: 'dns_srv', hint: 'DNS could not resolve MongoDB Atlas records. Check VPN/firewall/DNS settings, or use the standard mongodb:// connection string supplied by Atlas Connect. IPv4 options do not fix SRV DNS failures.' };
  if (nodes.some(e => e.code === 18 || e.codeName === 'AuthenticationFailed')) return { cause: 'authentication', hint: 'Check the Atlas database username/password and authSource. URL-encode special characters in credentials. Do not use the Atlas website login password.' };
  if (nodes.some(e => ['ENOTFOUND', 'EAI_AGAIN', 'ENODATA', 'ESERVFAIL', 'EREFUSED'].includes(e.code))) return { cause: 'dns', hint: 'The database hostname could not be resolved. Check the copied Atlas URI and your DNS/VPN settings. Confirm the cluster is running.' };
  if (nodes.some(e => ['CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'ERR_TLS_CERT_ALTNAME_INVALID'].includes(e.code))) return { cause: 'tls', hint: 'TLS certificate verification failed. Check your system clock and trusted CA configuration or VPN/TLS inspection. Do not disable certificate validation.' };
  if (nodes.some(e => e.code === 'ECONNREFUSED')) return { cause: 'connection_refused', hint: 'The database connection was refused. Check host/port and firewall. If the error involves IPv6, retry with MONGODB_IP_FAMILY=4.' };
  if (nodes.some(e => ['EPERM', 'EACCES'].includes(e.code))) return { cause: 'network_permission', hint: 'This process is blocked by OS/sandbox/network permissions. Run the diagnostic in your normal terminal with network access.' };
  return { cause: 'server_selection', hint: 'No reachable MongoDB server was selected. In Atlas Network Access add this computer’s current public IP, ensure the cluster is running, and check that your network permits MongoDB traffic (normally port 27017).' };
}
module.exports = { mongoOptions, connectionDiagnosis };
