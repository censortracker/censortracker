import Browser from './browser-api'

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
    for (const { name, minutes } of tasks) {
      const alarm = await Browser.alarms.get(name)

      if (!alarm) {
        Browser.alarms.create(name, { periodInMinutes: minutes })
        console.log(`Scheduled «${name}» to run every ${minutes} minutes`)
      }
    }
  }
}

export default new Task()
