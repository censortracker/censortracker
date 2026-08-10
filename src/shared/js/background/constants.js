export const TaskType = {
  PING: 'ping',
  REMOVE_BAD_PROXIES: 'removeBadProxies',
  SET_PROXY: 'setProxy',
  FETCH_PROXY_SOURCES: 'fetchProxySources',
  CHECK_FOR_UPDATE: 'checkForUpdate',
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
 * Special test target: instead of a fixed endpoint, probe a site drawn from
 * the blocklist.
 *
 * Some proxies only relay to the sites they exist for — the ones published by
 * circumvention services route their own blocklist and nothing else. Probing
 * such a proxy with an unblocked endpoint asks it to do the one thing it
 * refuses to do, so it reports as dead however well it works. This target
 * sends the probe where the proxy is actually meant to go.
 */
export const BLOCKED_SITE_TEST_TARGET = 'blocked'

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
 * Pool of *distinct* keyless HTTPS endpoints that echo the caller's public IP
 * (2ip.ru-style "what is my IP" services). Fetched THROUGH the proxy being
 * tested, the echoed address is the proxy's exit IP, which gives the real
 * exit country even when the proxy's entry host is hosted elsewhere. Each
 * lives on its own host (mirroring PROXY_TEST_POOL) so parallel batches can
 * route one echo endpoint through each candidate in a single PAC. The first
 * one (Cloudflare trace on 1.1.1.1) reports the country directly (`loc=XX`);
 * the plain ones return only the IP, which is then geo-resolved via the
 * cached geo-IP lookup.
 *
 * IMPORTANT: these hosts must stay DISJOINT from the PROXY_TEST_POOL hosts —
 * a shared host would make one candidate's exit check ride another
 * candidate's PAC route in the same parallel batch.
 */
export const EXIT_INFO_POOL = [
  'https://1.1.1.1/cdn-cgi/trace',
  'https://api.ipify.org',
  'https://icanhazip.com',
  'https://ifconfig.me/ip',
  'https://ident.me',
  'https://api64.ipify.org',
  'https://ipinfo.io/ip',
  'https://ipecho.net/plain',
  'https://myexternalip.com/raw',
  'https://api.seeip.org',
]

/**
 * Curated, free, public proxy subscriptions that refresh themselves on a
 * schedule (verified live and auto-updating). Offered as one-click presets the
 * user can add to their proxy sources:
 *   - monosans/proxy-list      — re-checked & validated, hourly.
 *   - proxifly/free-proxy-list — every ~5 minutes.
 *   - TheSpeedX/PROXY-List     — large raw dump, daily.
 */
/**
 * Ceiling on how many proxies one fetch may add.
 *
 * Public lists run to hundreds of thousands of entries. Past a few thousand
 * nothing good happens: the checker only ever probes a few dozen of them, the
 * settings page renders every row, and the whole list is serialized into
 * storage on each change. Taking a bounded slice keeps the feature usable
 * instead of quietly wedging the extension.
 */
export const MAX_PROXIES_PER_FETCH = 5000

/**
 * Ceiling on the download size of a single source, so a mistyped URL pointing
 * at something enormous cannot exhaust memory.
 */
export const MAX_SOURCE_BYTES = 32 * 1024 * 1024

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
