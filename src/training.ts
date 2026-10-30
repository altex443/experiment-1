import { createLocalStore } from './local-store.mjs';
export function browserStore() {
  return createLocalStore(window.localStorage, import.meta.env.BASE_URL);
}
export async function trainingRequest(url: string, options?: Parameters<ReturnType<typeof createLocalStore>['request']>[1]) {
  try { return await browserStore().request(url, options); }
  catch { return { ok: false, json: async () => ({ error: 'Browser storage is unavailable. Allow site storage, then retry.' }) }; }
}
export const draftKey = `forma:${import.meta.env.BASE_URL}:draft:v1`;
