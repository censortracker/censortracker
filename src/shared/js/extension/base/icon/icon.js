import browser from '../../../browser-api'
import configManager from '../config'
import { extensionName } from '../config/constants'

export const set = async (tabId, filename) => {
  const { usePremiumProxy } = await configManager.get('usePremiumProxy')
  
  const title = extensionName
  const path = browser.runtime.getURL(
    `images/icons/128x128/${usePremiumProxy ? `${filename}-premium` : filename}.png`,
  )

  if (browser.isFirefox) {
    browser.browserAction.setIcon({ tabId, path })
    browser.browserAction.setTitle({ title, tabId })
  } else {
    browser.action.setIcon({ tabId, path })
    browser.action.setTitle({ title, tabId })
  }
}

export const updateIcons = async (newFilename) => {
  browser.tabs.query({}).then((tabs) => {
    for (const { id } of tabs) {
      set(id, newFilename)
    }
  })
}

export const getDangerIcon = () => {
  return browser.runtime.getURL('images/icons/128x128/danger.png')
}
