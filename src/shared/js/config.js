import { assign, createActor, createMachine } from 'xstate'

import browser from './background/browser-api'

const defaultConfig = {
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

const configKeys = Object.keys(defaultConfig)

const generateConfigActions = () => {
  const configActions = {}

  configKeys.map((key) => {
    const assignmentObject = {}

    assignmentObject[key] = ({ event }) => event.newValue
    configActions[key] = { actions: assign(assignmentObject) }
    return true
  })
  return configActions
}

export const configMachine = createMachine(
  {
    id: 'config',
    on: {
      ...generateConfigActions(),
      '*': {
        actions: ({ event }) => {
          throw new Error(`${event.type} is not in the list of keys to be edited in local storage`)
        },
      },
    },
  },
)

const configService = createActor(configMachine,
  {
    inspect: async ({ type, event }) => {
      if (type !== '@xstate.snapshot' || !configKeys.includes(event.type)) {
        return
      }
      const storageObject = {}
      const objectValue = event.newValue

      storageObject[event.type] = objectValue

      await browser.storage.local.set(storageObject)
    },
  },
)

configService.start()

export const getConfig = async (...keys) => {
  if (keys.length === 0) {
    return browser.storage.local.get(null)
  }
  const keyObject = {}

  for (const key of keys) {
    if (!configKeys.includes(key)) {
      throw new Error(`${key} is not in the list of keys to be edited in local storage`)
    }
    keyObject[key] = defaultConfig[key]
  }
  return browser.storage.local.get(keyObject)
}

export const setConfig = (state) => {
  Object.keys(state).map((key) => {
    configService.send({ type: key, newValue: state[key] })
    return true
  })
}
