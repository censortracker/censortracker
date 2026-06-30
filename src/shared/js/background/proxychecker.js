import ProxyManager from './proxy'

/**
 * Highly-available connectivity endpoints used to probe a proxy. Each one lives
 * on a *distinct host*, which lets us route several probes through several
 * different candidate proxies at the same time: the PAC maps each endpoint host
 * to a different proxy, so the number of distinct hosts is our thread count.
 *
 * They all answer a tiny request (most return HTTP 204), are globally reachable
 * and are reached over `no-cors`, so we only care whether the request reaches
 * them at all — which is exactly "did traffic make it through the proxy".
 */
const ENDPOINTS = [
  { host: 'www.google.com', url: 'https://www.google.com/generate_204' },
  { host: 'www.gstatic.com', url: 'https://www.gstatic.com/generate_204' },
  { host: 'clients3.google.com', url: 'https://clients3.google.com/generate_204' },
  {
    host: 'connectivitycheck.gstatic.com',
    url: 'https://connectivitycheck.gstatic.com/generate_204',
  },
  { host: 'cp.cloudflare.com', url: 'https://cp.cloudflare.com/generate_204' },
  { host: 'www.cloudflare.com', url: 'https://www.cloudflare.com/cdn-cgi/trace' },
  { host: 'captive.apple.com', url: 'https://captive.apple.com/hotspot-detect.html' },
  {
    host: 'detectportal.firefox.com',
    url: 'https://detectportal.firefox.com/success.txt',
  },
  {
    host: 'edge.microsoft.com',
    url: 'https://edge.microsoft.com/captiveportal/generate_204',
  },
  { host: 'www.bing.com', url: 'https://www.bing.com/favicon.ico' },
]

const bustCache = (url) => {
  const separator = url.includes('?') ? '&' : '?'

  return `${url}${separator}_ct=${Date.now()}${Math.random().toString(36).slice(2)}`
}

/**
 * Sends one probe and resolves with whether it reached the endpoint and how
 * long it took. Never throws. Aborts on the shared signal or after `timeout`.
 */
const probe = async (url, { timeout, signal }) => {
  const controller = new AbortController()
  const onAbort = () => controller.abort()

  if (signal) {
    if (signal.aborted) {
      controller.abort()
    } else {
      signal.addEventListener('abort', onAbort, { once: true })
    }
  }

  const timer = setTimeout(() => controller.abort(), timeout)
  const startedAt = Date.now()

  try {
    await fetch(bustCache(url), {
      mode: 'no-cors',
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
    })
    return { ok: true, latency: Date.now() - startedAt }
  } catch (error) {
    return { ok: false, latency: Date.now() - startedAt, error }
  } finally {
    clearTimeout(timer)
    if (signal) {
      signal.removeEventListener('abort', onAbort)
    }
  }
}

class ProxyChecker {
  constructor () {
    this.endpoints = ENDPOINTS
  }

  /** Maximum number of proxies probed in parallel. */
  get maxConcurrency () {
    return this.endpoints.length
  }

  /**
   * Checks a list of proxies concurrently. Each proxy is reported back through
   * `onResult` the moment its result is known, so the UI can update live (and
   * drop dead proxies immediately instead of waiting for the whole run).
   *
   * Routing is handled by {@link ProxyManager.applyCheckerPac}: only the
   * connectivity-endpoint hosts are diverted to the proxies under test — all of
   * the user's real browsing keeps flowing through their active proxy for the
   * entire run. When finished (or aborted) normal routing is restored.
   *
   * @param {Array<{id: string, protocol: string, uri: string}>} proxies
   * @param {object} options
   * @param {(id: string, result: {status: string, latency: number|null}) => void}
   *   [options.onResult]
   * @param {AbortSignal} [options.signal] - Abort to stop the run.
   * @param {number} [options.timeout=5000] - Per-proxy timeout in ms.
   * @param {number} [options.concurrency] - Thread count (<= maxConcurrency).
   * @returns {Promise<{checked: number, alive: number, dead: number,
   *   aborted: boolean}>}
   */
  async check (proxies, {
    onResult,
    signal,
    timeout = 5000,
    concurrency,
  } = {}) {
    const summary = { checked: 0, alive: 0, dead: 0, aborted: false }

    if (!Array.isArray(proxies) || proxies.length === 0) {
      return summary
    }

    const slots = Math.max(
      1,
      Math.min(concurrency || this.maxConcurrency, this.endpoints.length),
    )

    try {
      for (let offset = 0; offset < proxies.length; offset += slots) {
        if (signal && signal.aborted) {
          summary.aborted = true
          break
        }

        const batch = proxies.slice(offset, offset + slots)
        const testRoutes = {}
        const assignments = batch.map((proxy, index) => {
          const endpoint = this.endpoints[index]

          testRoutes[endpoint.host] = ProxyManager.toPacToken(proxy)
          return { proxy, endpoint }
        })

        await ProxyManager.applyCheckerPac(testRoutes)
        // Let the browser pick up the temporary PAC before probing.
        await new Promise((resolve) => setTimeout(resolve, 200))

        if (signal && signal.aborted) {
          summary.aborted = true
          break
        }

        await Promise.all(assignments.map(async ({ proxy, endpoint }) => {
          const result = await probe(endpoint.url, { timeout, signal })

          // A failure caused by the user aborting is not a dead proxy: leave it
          // untouched so an interrupted run doesn't mislabel good proxies.
          if (!result.ok && signal && signal.aborted) {
            return
          }

          const status = result.ok ? 'alive' : 'dead'
          const latency = result.ok ? result.latency : null

          summary.checked += 1
          if (result.ok) {
            summary.alive += 1
          } else {
            summary.dead += 1
          }

          if (onResult) {
            try {
              await onResult(proxy.id, { status, latency })
            } catch (error) {
              console.error('onResult handler failed:', error)
            }
          }
        }))
      }
    } finally {
      await ProxyManager.restoreNormalProxy()
    }

    return summary
  }
}

export default new ProxyChecker()
