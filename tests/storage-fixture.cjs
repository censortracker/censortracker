// An in-memory extension storage area that reports changes like a browser.
function storageFixture(initial = {}) {
  const data = { ...initial }, listeners = new Set()
  const browser = { isFirefox: false, runtime: { getURL: path => 'chrome-extension://test/' + path, getManifest: () => ({ version: '21.0.0' }) },
    storage: { local: {
      get: async keys => typeof keys === 'string' ? { [keys]: data[keys] }
        : Array.isArray(keys) ? Object.fromEntries(keys.map(key => [key, data[key]])) : { ...keys, ...data },
      set: async values => { const changes = Object.fromEntries(Object.entries(values).map(([key, value]) =>
        [key, { oldValue: data[key], newValue: value }]))
        Object.assign(data, values); for (const listener of listeners) listener(changes, 'local') },
    }, onChanged: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) } },
  }
  return { browser, data, listeners }
}

module.exports = { storageFixture }
