import { TaskType } from '../config/constants'
import proxyManager from '../proxy'
import * as server from '../server'
import { schedule } from './task'

export const handleStartup = async () => {
  console.groupCollapsed('onStartup')
  await schedule([
    { name: TaskType.PING, minutes: 10 },
    { name: TaskType.SET_PROXY, minutes: 15 },
    { name: TaskType.REMOVE_BAD_PROXIES, minutes: 20 },
  ])
  console.groupEnd()
}

export const handleOnAlarm = async ({ name }) => {
  console.log(`Task received: ${name}`)

  if (name === TaskType.PING) {
    await proxyManager.ping()
  } else if (name === TaskType.REMOVE_BAD_PROXIES) {
    await proxyManager.removeBadProxies()
  } else if (name === TaskType.SET_PROXY) {
    const proxyingEnabled = await proxyManager.isEnabled()

    if (proxyingEnabled) {
      await server.synchronize()
      await proxyManager.setProxy()
    }
  } else {
    console.warn(`Unknown task: ${name}`)
  }
}
