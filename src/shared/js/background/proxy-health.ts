import browser from './browser-api'
import type { ProxyFailure } from './proxy-check-data'
import { currentProxyCheck, proxyFingerprint } from './proxy-check-data'
import type { ProxyRecord } from './proxy-record'
import { hasProxyAuth } from './proxy-record'

export const RETRY_DELAY = 5 * 60 * 1000

export const recoverableProxies = async (proxies: ProxyRecord[],
  failures: Record<string,
    ProxyFailure>) => {
  const due = []

  for (const proxy of proxies) {
    const failure = await currentProxyCheck(proxy, failures)

    if (failure && failure.retryAt <= Date.now() &&
      !proxy.restricted && !hasProxyAuth(proxy)) {
      due.push({ ...proxy, retryAt: failure.retryAt })
    }
  }
  return due.sort((first, second) => first.retryAt - second.retryAt)
}

// The caller holds the route lock. Failures never change user selections.
export const recordProxyHealth = async (proxy: ProxyRecord,
  failed: boolean) => {
  const { proxyFailures } = await browser.storage.local.get({
    proxyFailures: {},
  })

  if (!failed && !proxyFailures[proxy.id]?.fingerprint) {
    return false
  }
  delete proxyFailures[proxy.id]
  if (failed) {
    proxyFailures[proxy.id] = {
      fingerprint: await proxyFingerprint(proxy),
      retryAt: Date.now() + RETRY_DELAY,
    }
  }
  await browser.storage.local.set({
    proxyFailures: Object.fromEntries(
      Object.entries(proxyFailures).slice(-5001),
    ),
  })
  return true
}
