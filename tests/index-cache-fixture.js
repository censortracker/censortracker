import browser from '../src/shared/js/background/browser-api'
import registry from '../src/shared/js/background/registry'
import { indexCache, setRegistryState } from '../src/shared/js/background/index-cache'

const check = (value, message) => { if (!value) throw new Error(message) }
const wait = () => new Promise(resolve => setTimeout(resolve, 10))
const report = data => fetch(browser.runtime.getManifest().homepage_url +
  '?data=' + encodeURIComponent(JSON.stringify(data)))

;(async () => {
  try {
    const { stage = 0, coldMs = 0 } = await browser.storage.local.get(['stage', 'coldMs'])
    if (stage === 0) {
      await setRegistryState({ domains: Array.from({ length: 660000 }, (_, i) => 'site' + i + '.example'),
        registrySource: { kind: 'custom', url: 'https://list.example', enabled: true, autoUpdate: false },
        externalRegistry: { source: JSON.stringify(['custom', 'https://list.example']), domains: ['external.example'], updatedAt: 1 } })
      const start = performance.now()
      check((await registry.getRoutingDomains()).count === 660001, 'Cold index count')
      const coldMs = performance.now() - start
      const { domainsRevision, externalRegistryRevision, registrySource } = await browser.storage.local.get(['domainsRevision', 'externalRegistryRevision', 'registrySource'])
      for (const [key, revision] of [['0', domainsRevision], ['1', JSON.stringify([externalRegistryRevision, registrySource])]]) {
        let saved
        for (let i = 0; i < 100 && !saved; i++) { saved = await indexCache(key, revision); if (!saved) await wait() }
        check(saved, 'Snapshot was not saved')
      }
      await browser.storage.local.set({ stage: 1, coldMs })
      browser.runtime.reload()
      return
    }
    const get = browser.storage.local.get.bind(browser.storage.local)
    browser.storage.local.get = async keys => {
      const names = Array.isArray(keys) ? keys : Object.keys(keys)
      check(!names.includes('domains') && !names.includes('externalRegistry'), 'Warm start read raw domains')
      return get(keys)
    }
    const start = performance.now()
    check((await registry.getRoutingDomains()).count === 660001, 'Warm index count')
    const warmMs = performance.now() - start
    check((await registry.getDomainStatus('child.site659999.example')).blocked, 'Warm suffix match')
    check((await registry.getDomainStatus('external.example')).blocked, 'External snapshot')
    check(!(await registry.getDomainStatus('missing.example')).blocked, 'Unknown domain')
    browser.storage.local.get = get
    await setRegistryState({ domains: ['replacement.example'] })
    check(!(await registry.getDomainStatus('site659999.example')).blocked, 'Stale index after update')
    check((await registry.getDomainStatus('replacement.example')).blocked, 'Updated index')
    const open = indexedDB.open.bind(indexedDB)
    indexedDB.open = () => { throw new Error('IndexedDB is unavailable') }
    await setRegistryState({ domains: ['fallback.example'] })
    check((await registry.getDomainStatus('fallback.example')).blocked, 'Fallback index')
    indexedDB.open = open
    await registry.clearRegistry()
    check(!(await registry.getDomainStatus('fallback.example')).blocked, 'Cleared index')
    await report({ coldMs, warmMs })
  } catch (error) {
    await report({ error: error.stack })
  }
})()
