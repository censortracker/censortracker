import Browser from './webextension'

export const create = ({ name, periodInMinutes }) => {
  Browser.alarms.create(name, { periodInMinutes })
}

export const clear = (name) => {
  Browser.alarms.clear(name)
}
