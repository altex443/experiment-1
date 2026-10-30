const { createLogger } = require('./logger');
const { randomUUID } = require('node:crypto');

async function createMongoStore(collection, logger = createLogger()) {
  const { createLocalStore } = await import('../src/local-store.mjs');
  const initial = createLocalStore({ getItem: () => null, setItem() {} }).read();
  return {
    async request(url, options = {}, userId) {
      if (typeof userId !== 'string' || !userId) throw new Error('Authenticated user required.');
      const workspaceId = 'user:' + userId;
      await collection.updateOne({ _id: workspaceId }, { $setOnInsert: { revision: 0, state: initial, draft: null } }, { upsert: true });
      for (let attempt = 0; attempt < 8; attempt++) {
        const doc = await collection.findOne({ _id: workspaceId });
        let raw = JSON.stringify(doc.state);
        const store = createLocalStore({ getItem: () => raw, setItem: (_, value) => { raw = value; } }, '/', randomUUID);
        let result; let draft = doc.draft;
        if (url === '/api/backup' && (!options.method || options.method === 'GET')) return { ok: true, json: async () => store.read() };
        if (url === '/api/draft' && (!options.method || options.method === 'GET')) return { ok: true, json: async () => draft };
        if (url === '/api/migrate' && options.method === 'POST') {
          try { store.import(options.body); result = { ok: true, json: async () => ({ ok: true }) }; draft = null; }
          catch (error) { return { ok: false, json: async () => ({ error: error.message }) }; }
        } else if (url === '/api/draft' && options.method === 'PUT') {
          try {
            draft = JSON.parse(options.body);
            if (draft !== null && (!draft.active || typeof draft.active.id !== 'string' || !Array.isArray(draft.entries) || !Array.isArray(draft.checked) || !Number.isFinite(draft.started))) throw new Error();
            if (draft?.requestId && doc.state.sessions.some(session => session.requestId === draft.requestId)) draft = null;
            result = { ok: true, json: async () => ({ ok: true }) };
          } catch { return { ok: false, json: async () => ({ error: 'Invalid workout draft.' }) }; }
        } else {
          result = await store.request(url, options);
          if (!result.ok || !options.method || options.method === 'GET') return result;
          if (url === '/api/sessions' && options.method === 'POST') draft = null;
        }
        const saved = await collection.updateOne({ _id: workspaceId, revision: doc.revision }, { $set: { state: JSON.parse(raw), draft }, $inc: { revision: 1 } });
        if (saved.matchedCount) { logger.debug('mongo.write.completed', { attempt: attempt + 1 }); return result; }
        logger.warn('mongo.write.conflict', { attempt: attempt + 1 });
      }
      logger.error('mongo.write.retries_exhausted', { attempt: 8 });
      return { ok: false, json: async () => ({ error: 'Data changed in another request. Please retry.' }) };
    }
  };
}
module.exports = { createMongoStore };
