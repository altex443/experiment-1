export function apiConfigurationError(apiUrl, hostname) {
  const message = 'Backend URL is not configured correctly. Set the GitHub Actions repository variable VITE_API_URL to your HTTPS Node backend (not github.io), then rebuild and redeploy GitHub Pages.';
  if (!apiUrl) return hostname === 'github.io' || hostname.endsWith('.github.io') ? message : null;
  try {
    const url = new URL(apiUrl);
    if (url.hostname === 'github.io' || url.hostname.endsWith('.github.io') || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !['http:', 'https:'].includes(url.protocol)) return message;
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) return message;
    return null;
  } catch { return message; }
}
