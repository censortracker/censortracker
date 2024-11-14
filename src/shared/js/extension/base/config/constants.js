export const extensionName = 'Censor Tracker'

export const configAPIEndpoints = [
  {
    endpointName: 'GitHub',
    endpointUrl: 'https://raw.githubusercontent.com/censortracker/ctconf/main/config.json',
  },
  {
    endpointName: 'SelectelCDN',
    endpointUrl: 'https://f0a99309-6970-406b-9acf-a38f82c9742d.selcdn.net/config.json',
  },
  {
    endpointName: 'SelectelStorage',
    endpointUrl: 'https://23ababf0-5f79-4d88-a05b-17ace57cb29a.selstorage.ru/config.json',
  },
  {
    endpointName: 'FastlyCDN',
    endpointUrl: 'https://censortracker-config.global.ssl.fastly.net/censortracker/ctconf/main/config.json',
  },
  {
    endpointName: 'FastlyCompute',
    endpointUrl: 'https://censortracker-config.edgecompute.app/',
  },
  {
    endpointName: 'jsDelivr',
    endpointUrl: 'https://cdn.jsdelivr.net/gh/censortracker/ctconf/config.json',
  },
  {
    endpointName: 'Google',
    endpointUrl: 'https://storage.googleapis.com/censortracker/config.json',
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
  premiumBackendUnreachable: false,
  premiumIdentificationCode: '',
  premiumExpirationDate: Date.now(),

  // p2p
  bridgeModeEnabled: false,

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
