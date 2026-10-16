import browser from './browser-api'

class Task {
  /**
   * Creates a task and schedules it to run every X minutes.
   * @param tasks Array of tasks.
   * @type tasks Array<{ name: string, minutes: number }>.
   */
  async schedule (tasks: { name: string; minutes: number }[] = []) {
    console.groupCollapsed('Task.schedule([tasks])')
    for (const { name, minutes } of tasks) {
      const alarm = await browser.alarms.get(name)

      if (alarm?.periodInMinutes === minutes) {
        console.debug(`Task «${name}» already scheduled!`)
      } else {
        await browser.alarms.create(name, { periodInMinutes: minutes })
        console.log(`Scheduled «${name}» to run every ${minutes} minutes`)
      }
    }
    console.groupEnd()
  }
}

export default new Task()
