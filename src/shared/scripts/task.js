import Browser from './webextension'

class Task {
  /**
   * Create a task and delay it for X minutes.
   * @param name Task name.
   * @param minutes Delay in minutes.
   */
  delay (name, { minutes }) {
    Browser.alarms.create(name, { delayInMinutes: minutes })
    console.warn(`Task.delay('${name}', { minutes: ${minutes} })`)
  }

  /**
   * Creates a task and schedules it to run every X minutes.
   * @param name Task name.
   * @param minutes Periodicity in minutes
   */
  schedule (name, { minutes }) {
    Browser.alarms.get(name).then((alarm = { name }) => {
      if (!name) {
        Browser.alarms.create(name, { periodInMinutes: minutes })
        console.warn(`Task.schedule('${name}', { minutes: ${minutes} })`)
      } else {
        console.warn(`Task('${name}') already scheduled!`)
      }
    })
  }
}

export default new Task()
