import Browser from './webextension'

class Task {
  delay (name, { minutes }) {
    console.info(`Task.delay('${name}', { minutes: ${minutes} })`)
    Browser.alarms.create(name, { delayInMinutes: minutes })
  }

  schedule (name, { minutes }) {
    console.info(`Task.schedule('${name}', { minutes: ${minutes} })`)
    Browser.alarms.create(name, { periodInMinutes: minutes })
  }
}

export default new Task()
