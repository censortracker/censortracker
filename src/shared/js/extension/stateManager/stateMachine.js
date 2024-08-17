import { createActor, createMachine, fromPromise } from 'xstate'

import { Extension, server } from '../base'

// Machine visualization: https://stately.ai/registry/editor/embed/6651ce8e-8e22-4467-aaff-e23b76eea51b?mode=design&machineId=315554cf-d377-4c71-b06b-ed507c94685b
const configMachine = createMachine({
  id: 'config',
  initial: 'undefined',
  always: {
    actions: (state) => {
      // console.log('transition in machine:', state.event.type, state)
    },
  },
  on: {
    installed: {
      target: '.enabled',
      actions: [
        async ({ event }) => {
          await Extension.handlers.handleInstalled(event)
          await Extension.proxy.takeControl()
        },
      ],
    },
    enableExtension: {
      target: '.enabled',
      actions: [
        Extension.enable,
        Extension.proxy.takeControl,
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
          on: {
            enableProxy: {
              target: '.enabled',
            },
            disableProxy: {
              target: '.disabled',
              actions: [Extension.proxy.disable, Extension.proxy.removeProxy],
            },
          },
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
        enableNotifications: {
          actions: [Extension.notifications.enable],
        },
        disableNotifications: {
          actions: [
            Extension.notifications.disable,
          ],
        },
      },
    },
  },
})

const configService = createActor(configMachine)

export default configService
