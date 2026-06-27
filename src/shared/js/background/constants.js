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
