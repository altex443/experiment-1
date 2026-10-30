import { apiConfigurationError } from './api-config.mjs';
import { createDeviceStore } from './device-store.mjs';
import { createLocalStore } from './local-store.mjs';
const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const isLocalMode = import.meta.env.VITE_STORAGE_MODE === 'local';
export async function trainingRequest(url: string, options?: { method?: string; headers?: Record<string, string>; body?: string }) {
  try {
    if (isLocalMode) return await createDeviceStore(localStorage, import.meta.env.BASE_URL).request(url, options);
    const configurationError = apiConfigurationError(apiUrl, window.location.hostname);
    if (configurationError) return { ok: false, json: async () => ({ error: configurationError }) };
    const response = await fetch(apiUrl + url, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...options?.headers }, signal: AbortSignal.timeout(15000) });
    if (response.status === 401 && !url.startsWith('/api/auth/')) window.dispatchEvent(new Event('rep:auth-required'));
    if (!response.headers.get('content-type')?.includes('application/json')) return { ok: false, json: async () => ({ error: 'The API returned a web page instead of JSON. Check that VITE_API_URL points to your running Node backend, then redeploy.' }) };
    return response;
  } catch { return { ok: false, json: async () => ({ error: isLocalMode ? 'Browser storage is unavailable. Allow site storage to save your data.' : 'Cannot reach the training server. Check its API URL and connection.' }) }; }
}
export function browserStore() {
  return {
    async export() {
      const response = await trainingRequest('/api/backup'); const data = await response.json();
      if (!response.ok) throw new Error(data.error); return JSON.stringify(data, null, 2);
    },
    async migrate(raw: string) {
      const response = await trainingRequest('/api/migrate', { method: 'POST', body: raw }); const data = await response.json();
      if (!response.ok) throw new Error(data.error);
    }
  };
}
// Allows explicit migration of existing browser data without silently replacing MongoDB data.
export function exportLegacyData() { return createLocalStore(localStorage, import.meta.env.BASE_URL).export(); }

