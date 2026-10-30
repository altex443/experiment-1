export function pagesEnvironment(source, serverMode = false) {
  if (!serverMode) return { ...source, VITE_STORAGE_MODE: 'local', VITE_API_URL: '' };
  const message = 'Set the GitHub Actions repository variable VITE_API_URL to your public HTTPS Node backend origin (for example https://your-api.onrender.com). MongoDB credentials belong on that backend only.';
  let url;
  try { url = new URL((source.VITE_API_URL || '').trim()); } catch { throw new Error(message); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname === '127.0.0.1' || url.hostname === '[::1]') throw new Error(message);
  return { ...source, VITE_STORAGE_MODE: 'server', VITE_API_URL: url.origin };
}
