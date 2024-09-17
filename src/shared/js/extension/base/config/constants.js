export const extensionName = 'Censor Tracker'

export const configAPIEndpoints = [
  {
    endpointName: 'GitHub',
    endpointUrl: 'https://raw.githubusercontent.com/censortracker/ctconf/main/config.json',
  },
  {
    endpointName: 'CloudFlareWorker',
    endpointUrl: 'TBD',
  },
  {
    endpointName: 'CloudFlareStorage',
    endpointUrl: 'TBD',
  },
  {
    endpointName: 'Google',
    endpointUrl: 'TBD',
  },
]

export const fallbackCountryCode = 'RU'

export const TaskType = {
  PING: 'ping',
  REMOVE_BAD_PROXIES: 'removeBadProxies',
  SET_PROXY: 'setProxy',
  CHECK_PREMIUM: 'monitorPremiumExpiration',
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
  fallbackProxyError: '',
  fallbackProxyInUse: false,
  fallbackReason: '',
  proxyIsAlive: true,
  proxyLastFetchTs: Date.now(),
  proxyPingURI: '',
  proxyServerURI: '',
  useOwnProxy: false,
  useProxy: false,

  // custom server
  customProxyProtocol: '',
  customProxyServerURI: '',
  customProxyUsername: '',
  customProxyPassword: '',

  // premium proxy
  usePremiumProxy: false,
  haveActivePremiumConfig: false,
  premiumProxyServerURI: '',
  premiumUsername: '',
  premiumPassword: '',
  premiumBackendURL: '',
  premiumIdentificationCode: '',
  premiumExpirationDate: Date.now(),

  // registry
  customDPIDomains: [],
  customProxiedDomains: [],
  disseminators: [],
  domains: [],
  ignoredHosts: [],
  notifiedHosts: [],
  useRegistry: true,
}

export const MILLISECONDS_IN_DAY = 86400000
