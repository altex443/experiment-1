import { createLocalStore } from './local-store.mjs';
export function createDeviceStore(storage, base = '/') {
  const store = createLocalStore(storage, base);
  const draftKey = `forma:${base}:draft:v1`;
  const reply = data => ({ ok: true, json: async () => data });
  return {
    async request(url, options = {}) {
      try {
        const method = options.method || 'GET';
        if (url === '/api/auth/session' && method === 'GET') return reply({ mode: 'device', user: { name: 'On this device', username: '' } });
        if (url.startsWith('/api/auth/')) throw new Error('Accounts are unavailable in on-device mode.');
        if (url === '/api/backup' && method === 'GET') return reply(store.read());
        if (url === '/api/draft' && method === 'GET') {
          const draft = JSON.parse(storage.getItem(draftKey) || 'null');
          if (draft?.requestId && store.read().sessions.some(s => s.requestId === draft.requestId)) return reply(null);
          return reply(draft);
        }
        if (url === '/api/draft' && method === 'PUT') {
          const draft = JSON.parse(options.body);
          if (draft !== null && (!draft.active || !Array.isArray(draft.entries) || !Array.isArray(draft.checked) || !Number.isFinite(draft.started))) throw new Error('Invalid workout draft.');
          if (draft === null) storage.removeItem(draftKey); else storage.setItem(draftKey, JSON.stringify(draft));
          return reply({ ok: true });
        }
        const response = await store.request(url, options);
        if (response.ok && url === '/api/sessions' && method === 'POST') {
          // A successful session is durable even if clearing browser draft storage fails.
          try { storage.removeItem(draftKey); } catch { /* The session is already saved. */ }
        }
        return response;
      } catch { return { ok: false, json: async () => ({ error: 'Cannot access saved data. Browser storage may be disabled, full, or corrupted.' }) }; }
    }
  };
}
