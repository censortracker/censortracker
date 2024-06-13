export const extensionName = 'Censor Tracker'

export const githubConfigUrl = 'https://raw.githubusercontent.com/censortracker/ctconf/main/config.json'

export const fallbackCountryCode = 'RU'

export const TaskType = {
  PING: 'ping',
  REMOVE_BAD_PROXIES: 'removeBadProxies',
  SET_PROXY: 'setProxy',
}

export const defaultConfig = {
  // general
  backendIsIntermittent: false,
  botDetection: false,
  currentRegionCode: '',
  currentRegionName: '',
  enableExtension: true,
  localConfig: {},
  privateBrowserPermissionRequired: false,
  showNotifications: true,
  unsuppoprtedCountry: false,
  updateAvailable: false,

  // proxy
  badProxies: [],
  currentProxyServer: '',
  customProxyProtocol: '',
  customProxyServerURI: '',
  fallbackProxyError: '',
  fallbackProxyInUse: false,
  fallbackReason: '',
  proxyIsAlive: true,
  proxyLastFetchTs: Date.now(),
  proxyPingURI: '',
  proxyServerURI: '',
  useOwnProxy: false,
  useProxy: false,

  // registry
  customProxiedDomains: [],
  disseminators: [],
  domains: [],
  ignoredHosts: [],
  notifiedHosts: [],
  useRegistry: true,
}
