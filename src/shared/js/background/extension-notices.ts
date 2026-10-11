import browser from './browser-api'

export const extensionNotices = [{
  id: 'release-21',
  title: 'release21Title',
  text: 'release21Text',
  link: { label: 'noticeSupport', path: 'options.html#contacts' },
  events: ['install', 'update'],
}]

const activeKey = (id: string) => `noticeActive:${id}`
const readKey = (id: string) => `noticeRead:${id}`

export const pendingNotices = async () => {
  const state = await browser.storage.local.get(extensionNotices.flatMap(
    ({ id }) => [activeKey(id), readKey(id)],
  ))

  return extensionNotices.filter(({ id }) =>
    state[activeKey(id)] === true && state[readKey(id)] !== true)
}

export const activateNotices = async (reason: string) => {
  const notices = extensionNotices.filter(
    ({ events }) => events.includes(reason),
  )
  const state = await browser.storage.local.get(notices.flatMap(
    ({ id }) => [activeKey(id), readKey(id)],
  ))
  const entries = notices.filter(({ id }) =>
    state[activeKey(id)] !== true && state[readKey(id)] !== true)
    .map(({ id }) => [activeKey(id), true])

  if (entries.length > 0) {
    await browser.storage.local.set(Object.fromEntries(entries))
  }
  return entries.length > 0
}

export const dismissNotice = (id: string) =>
  browser.storage.local.set({ [readKey(id)]: true })

export const openNotices = async () => {
  const url = browser.runtime.getURL('notifications.html')
  const tabs = await browser.tabs.query({})
  const existing = tabs.find((tab) => tab.url === url)

  if (existing) {
    await browser.tabs.update(existing.id!, { active: true })
    await browser.windows.update(existing.windowId!, { focused: true })
  } else {
    await browser.tabs.create({ url, active: true })
  }
}
