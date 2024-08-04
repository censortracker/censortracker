import * as mockedStorage from './mockedStorage/dataAccess'

global.chrome = {
  storage: {
    local: {
      get: mockedStorage.get,
      set: mockedStorage.set,
    },
  },
  proxy: {
    settings: {
      set: async (args) => {},
      clear: async (args) => {},
    },
  },
  action: {
    setIcon: async ({ tabId, path }) => {
      await mockedStorage.set({ icon: path })
    },
    setTitle: async ({ title, tabId }) => {},
  },
  tabs: {
    TabStatus: {
      LOADING: 'loading',
    },
  },
  runtime: {
    getURL: (arg) => arg,
  },
  alarms: {
    create: () => undefined,
    get: () => undefined,
  },
}

// console.log = () => {}

console.warn = (...args) => {
  console.log('Warning:', ...args)
}

beforeEach(async () => {
  await mockedStorage.initialiseStorage()
})
