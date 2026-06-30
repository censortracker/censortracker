export const TaskType = {
  PING: 'ping',
  REMOVE_BAD_PROXIES: 'removeBadProxies',
  SET_PROXY: 'setProxy',
  FETCH_PROXY_SOURCES: 'fetchProxySources',
}

/**
 * Cloud endpoints used to probe whether a proxy is alive and how fast it is.
 * Each returns a tiny response very quickly from a major cloud provider, so a
 * successful fetch through the proxy is a good liveness + latency signal.
 */
export const PROXY_TEST_TARGETS = {
  google: 'https://www.google.com/generate_204',
  cloudflare: 'https://cloudflare.com/cdn-cgi/trace',
  amazon: 'https://checkip.amazonaws.com',
  azure: 'https://azure.microsoft.com/robots.txt',
}

export const DEFAULT_PROXY_TEST_TARGET = 'google'

/**
 * Pool of *distinct* connectivity endpoints used for parallel checking. Each
 * lives on its own host, so the checker can route one host through one proxy
 * and another host through another proxy in the same PAC — the number of
 * distinct hosts is effectively the number of probe "threads".
 */
export const PROXY_TEST_POOL = [
  'https://www.google.com/generate_204',
  'https://www.gstatic.com/generate_204',
  'https://clients3.google.com/generate_204',
  'https://connectivitycheck.gstatic.com/generate_204',
  'https://cp.cloudflare.com/generate_204',
  'https://www.cloudflare.com/cdn-cgi/trace',
  'https://captive.apple.com/hotspot-detect.html',
  'https://detectportal.firefox.com/success.txt',
  'https://edge.microsoft.com/captiveportal/generate_204',
  'https://checkip.amazonaws.com',
]

/**
 * Curated, free, public proxy subscriptions that refresh themselves on a
 * schedule (verified live and auto-updating). Offered as one-click presets the
 * user can add to their proxy sources:
 *   - monosans/proxy-list      — re-checked & validated, hourly.
 *   - proxifly/free-proxy-list — every ~5 minutes.
 *   - TheSpeedX/PROXY-List     — large raw dump, daily.
 */
export const RECOMMENDED_PROXY_SOURCES = [
  {
    name: 'monosans · SOCKS5 (validated, hourly)',
    url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt',
  },
  {
    name: 'monosans · HTTP (validated, hourly)',
    url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
  },
  {
    name: 'Proxifly · SOCKS5 (every ~5 min)',
    url: 'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/socks5/data.txt',
  },
  {
    name: 'Proxifly · HTTP (every ~5 min)',
    url: 'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/http/data.txt',
  },
  {
    name: 'TheSpeedX · SOCKS5 (daily)',
    url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt',
  },
  {
    name: 'TheSpeedX · HTTP (daily)',
    url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
  },
]
