import browser from './browser-api'
import type { StorageState } from './storage'

export const extensionNotices = [{
  id: 'release-21',
  title: 'release21Title',
  text: 'release21Text',
  link: { label: 'noticeSupport', path: 'options.html#contacts' },
  events: ['install', 'update'],
}]

const activeKey = (id: string): `noticeActive:${string}` =>
  `noticeActive:${id}`
const readKey = (id: string): `noticeRead:${string}` => `noticeRead:${id}`

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
  const values: Partial<StorageState> = {}

  for (const { id } of notices) {
    if (state[activeKey(id)] !== true && state[readKey(id)] !== true) {
      values[activeKey(id)] = true
    }
  }
  const changed = Object.keys(values).length > 0

  if (changed) {
    await browser.storage.local.set(values)
  }
  return changed
}

export const dismissNotice = (id: string) =>
  browser.storage.local.set({ [readKey(id)]: true })

// Focuses an open extension page, or opens it in a new tab.
export const openPage = async (path: string) => {
  const url = browser.runtime.getURL(path)
  const tabs = await browser.tabs.query({})
  const existing = tabs.find((tab) => tab.url === url)

  if (existing?.id !== undefined && existing.windowId !== undefined) {
    await browser.tabs.update(existing.id, { active: true })
    await browser.windows.update(existing.windowId, { focused: true })
  } else {
    await browser.tabs.create({ url, active: true })
  }
}

export const openNotices = () => openPage('notifications.html')
