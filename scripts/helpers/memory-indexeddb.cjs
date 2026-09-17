// Minimal asynchronous IndexedDB boundary for contract tests (not application mocks).
exports.createMemoryIndexedDB = () => {
  const databases = new Map();
  const events = () => ({ addEventListener(type, listener) { const previous = this['on' + type]; this['on' + type] = event => { previous?.(event); listener(event || { target: this }); }; } });
  return { open(name, version) {
    const request = events();
    setTimeout(() => {
      const existing = databases.get(name); const stores = existing?.stores || new Map();
      const db = { objectStoreNames: { contains: key => stores.has(key) }, close() {},
        createObjectStore(key, options) { stores.set(key, { keyPath: options.keyPath, data: new Map(), indexes: new Map() }); return objectStore(key, null); },
        transaction(names, mode) {
          let timer, aborted = false;
          const saved = new Map([...stores].map(([key, value]) => [key, new Map(value.data)]));
          const tx = { ...events(), objectStore: key => objectStore(key, tx), abort() { aborted = true; clearTimeout(timer); for (const [key, data] of saved) stores.get(key).data = data; tx.onabort?.(); },
            schedule(fn) { const result = events(); clearTimeout(timer); setTimeout(() => { if(aborted) return; try { result.result = structuredClone(fn()); result.onsuccess?.(); } catch(error) { result.error = error; result.onerror?.(); tx.abort(); } clearTimeout(timer); timer = setTimeout(() => { if(!aborted) tx.oncomplete?.(); }, 5); }, 0); return result; } };
          timer = setTimeout(() => tx.oncomplete?.(), 5); return tx;
        },
      };
      function objectStore(key, tx) {
        const store = stores.get(key); if(!store) throw Error('Missing store: ' + key);
        const schedule = fn => { if (tx) return tx.schedule(fn); const result = events(); setTimeout(() => { result.result = structuredClone(fn()); result.onsuccess?.(); }, 0); return result; };
        return { indexNames: { contains: key => store.indexes.has(key) }, createIndex(name, field) { store.indexes.set(name, field); },
          get: key => schedule(() => store.data.get(key)), getAll: () => schedule(() => [...store.data.values()]),
          put: value => schedule(() => { store.data.set(value[store.keyPath], structuredClone(value)); return value[store.keyPath]; }),
          delete: key => schedule(() => { store.data.delete(key); }), clear: () => schedule(() => store.data.clear()),
          index: key => ({ getAll: value => schedule(() => [...store.data.values()].filter(row => row[store.indexes.get(key)] === value)) }),
        };
      }
      request.result = db; request.transaction = { objectStore: key => objectStore(key, null) };
      databases.set(name, { stores, version });
      if (!existing || existing.version < version) request.onupgradeneeded?.({ oldVersion: existing?.version || 0 });
      request.onsuccess?.();
    },0); return request;
  } };
};
