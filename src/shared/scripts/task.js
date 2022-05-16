import Browser from './webextension'

class Task {
  /**
   * Create a task and delay it for X minutes.
   * @param name Task name.
   * @param minutes Delay in minutes.
   */
  async delay (name, { minutes }) {
    Browser.alarms.create(name, { delayInMinutes: minutes })
    console.log(`Task.delay('${name}', { minutes: ${minutes} })`)
  }

  /**
   * Creates a task and schedules it to run every X minutes.
   * @param tasks Array of tasks.
   * @type tasks Array<{ name: string, minutes: number }>.
   */
  async schedule (tasks = []) {
    console.groupCollapsed('Task.schedule(tasks)')
    console.log(`Task.schedule(${JSON.stringify(tasks, null, 2)})`)
    for (const { name, minutes } of tasks) {
      const alarm = await Browser.alarms.get(name)

      if (alarm) {
        console.warn(`Task «${name}» already scheduled!`)
      } else {
        Browser.alarms.create(name, { periodInMinutes: minutes })
        console.info(`Scheduled task «${name}» to run every ${minutes} minutes`)
      }
    }
    console.groupEnd()
  }
}

export default new Task()
