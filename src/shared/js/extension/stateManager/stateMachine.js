import { createActor, createMachine, fromPromise } from 'xstate'

import { Extension, server } from '../base'

const configMachine = createMachine({
  id: 'config',
  initial: 'enabled',
  always: {
    // actions: (state) => {
    //   console.log('transition in machine:', state)
    // },
  },
  on: {
    installed: {
      target: '.enabled',
      actions: async ({ event }) => {
        await Extension.handlers.handleInstalled(event)
      },
    },
    enableExtension: {
      target: '.enabled',
      actions: [
        Extension.enable,
        Extension.proxy.enable,
        async () => {
          await Extension.icon.updateIcons('default')
        },
      ],
    },
    disableExtension: {
      target: '.disabled',
      actions: [
        Extension.disable,
        async () => {
          await Extension.icon.updateIcons('disabled')
        },
      ],
    },
    resetExtension: {
      target: '.enabled',
      actions: [Extension.reset],
    },
    importSettings: {
      target: '.undefined',
      actions: [
        async ({ event }) => {
          await Extension.config.importSettings(event.settings)
          await server.synchronize({ syncRegistry: true })
          await Extension.proxy.setProxy()
          await Extension.proxy.ping()
        },
      ],
    },
  },
  states: {
    undefined: {
      entry: [Extension.taskManager.handlers.handleStartup],
      invoke: {
        src: fromPromise(Extension.isEnabled),
        onDone: [
          {
            target: 'enabled',
            guard: ({ event }) => event.output,
          },
          {
            target: 'disabled',
          },
        ],
        onError: 'disabled',
      },
    },
    enabled: {
      type: 'parallel',
      on: {
        handleTabCreate: {
          actions: ({ event }) => {
            Extension.icon.set(event.tabId, 'default')
          },
        },
        handleTabState: {
          actions: async ({ event }) => {
            Extension.handlers.handleTabState(event)
          },
        },
      },
      states: {
        proxy: {
          initial: 'undefined',
          states: {
            undefined: {
              exit: () => {
                // console.log('left initial state')
              },
              invoke: {
                src: fromPromise(Extension.proxy.isEnabled),
                onDone: [
                  {
                    target: 'enabled',
                    guard: ({ event }) => event.output,
                  },
                  {
                    target: 'disabled',
                  },
                ],
                onError: 'disabled',
              },
            },
            enabled: {
              entry: [Extension.proxy.setProxy],
              exit: [Extension.proxy.disable, Extension.proxy.removeProxy],
              on: {
                disableProxy: {
                  target: 'disabled',
                },
                handleObservedHostsChange: {
                  actions: [Extension.proxy.setProxy],
                },
                updateRegistry: {
                  actions: [
                    server.synchronize,
                    Extension.proxy.removeBadProxies,
                    Extension.proxy.setProxy,
                    Extension.proxy.ping,
                  ],
                },
              },
            },
            disabled: {
              on: {
                enableProxy: {
                  target: 'enabled',
                },
                updateRegistry: {
                  actions: [
                    server.synchronize,
                    () => {
                      console.warn('Registry updated, but proxying is disabled.')
                    },
                  ],
                },
              },
            },
          },
        },
        notifications: {
          initial: 'undefined',
          states: {
            undefined: {
              invoke: {
                src: fromPromise(Extension.notifications.areEnabled),
                onDone: [
                  {
                    target: 'enabled',
                    guard: ({ event }) => event.output,
                  },
                  {
                    target: 'disabled',
                  },
                ],
                onError: 'disabled',
              },
            },
            enabled: {
            },
            disabled: {
            },
          },
          on: {
            enableNotifications: {
              target: '.enabled',
              actions: [Extension.notifications.enable],
            },
            disableNotifications: {
              target: '.disabled',
              actions: [
                Extension.notifications.disable,
              ],
            },
          },
        },
      },
    },
    disabled: {
      on: {
        handleTabCreate: {
          actions: ({ event }) => {
            Extension.icon.set(event.tabId, 'disabled')
          },
        },
        handleTabState: {
          actions: ({ event }) => {
            Extension.icon.set(event.tabId, 'disabled')
          },
        },
      },
    },
  },
})

const configService = createActor(configMachine)

configService.start()

export default configService
