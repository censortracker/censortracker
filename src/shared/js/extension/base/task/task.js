import browser from '../../../browser-api'
import * as handlers from './handlers'

/**
 * Create a task and delay it for X minutes.
 * @param name Task name.
 * @param minutes Delay in minutes.
 */
export const delay = async (name, { minutes }) => {
  browser.alarms.create(name, { delayInMinutes: minutes })
  console.log(`Task.delay('${name}', { minutes: ${minutes} })`)
}

/**
 * Creates a task and schedules it to run every X minutes.
 * @param tasks Array of tasks.
 * @type tasks Array<{ name: string, minutes: number }>.
 */
export const schedule = async (tasks = []) => {
  console.groupCollapsed('Task.schedule([tasks])')
  for (const { name, minutes } of tasks) {
    const alarm = await browser.alarms.get(name)

    if (alarm) {
      console.warn(`Task «${name}» already scheduled!`)
    } else {
      browser.alarms.create(name, { periodInMinutes: minutes })
      console.log(`Scheduled «${name}» to run every ${minutes} minutes`)
    }
  }
  console.groupEnd()
}

export { handlers }
