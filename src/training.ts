import { createLocalStore } from './local-store.mjs';
const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export async function trainingRequest(url: string, options?: { method?: string; headers?: Record<string, string>; body?: string }) {
  try {
    const response = await fetch(apiUrl + url, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...options?.headers }, signal: AbortSignal.timeout(15000) });
    if (response.status === 401 && !url.startsWith('/api/auth/')) window.dispatchEvent(new Event('rep:auth-required'));
    return response;
  } catch { return { ok: false, json: async () => ({ error: 'Cannot reach the training server. Check its API URL and connection.' }) }; }
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

