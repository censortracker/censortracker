import Browser from './webextension'

class Task {
  delay (name, { minutes }) {
    Browser.alarms.create(name, { delayInMinutes: minutes })
    console.warn(`Task.delay('${name}', { minutes: ${minutes} })`)
  }

  schedule (name, { minutes }) {
    Browser.alarms.get(name).then((alarm = {}) => {
      if (!('name' in alarm)) {
        Browser.alarms.create(name, { periodInMinutes: minutes })
        console.warn(`Task.schedule('${name}', { minutes: ${minutes} })`)
      } else {
        console.warn(`Task('${name}') already scheduled!`)
      }
    })
  }
}

export default new Task()
