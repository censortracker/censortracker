import browser from '../../browser-api'
import { extractHostnameFromUrl, getDomainFontSize } from '../../utilities'

export const showSiteStatusInfo = async (reason, status) => {
  const siteStatus = document.getElementById('siteStatus')
  const currentDomainHeader = document.getElementById('currentDomainHeader')
  const statusTitle = document.getElementById('statusTitle')
  const statusIcon = document.getElementById('statusIcon')
  const statusDetailsArea = document.getElementById('statusDetails')
  const statusDesc = document.getElementById('statusDesc')
  const statusLink = document.getElementById('statusLink')

  browser.tabs.query({ active: true, lastFocusedWindow: true })
    .then(async (tabData) => {
      const currentUrl = tabData[0]?.url
      const currentHostname = extractHostnameFromUrl(currentUrl)

      currentDomainHeader.textContent = currentHostname
      currentDomainHeader.style.fontSize = getDomainFontSize(currentHostname)
    })

  let titleMessage
  let descMessage
  let link

  if (reason === 'restrictions') {
    titleMessage = status === 'normal' ? 'notBlockedTitle' : 'blockedTitle'
    descMessage = status === 'normal' ? 'notBlockedDesc' : 'blockedDesc'
    link = 'https://reestr.rublacklist.net/'
  } else {
    titleMessage = status === 'normal' ? 'notDisseminatorTitle' : 'disseminatorTitle'
    descMessage = status === 'normal' ? 'notDisseminatorDesc' : 'disseminatorDesc'
    link = 'https://reestr.rublacklist.net/distributors/'
  }

  if (status !== 'normal') {
    statusIcon.setAttribute('src', 'images/popup/status/danger.svg')
    currentDomainHeader.classList.add(`title-${reason === 'ori' ? 'ori' : 'blocked'}`)
    statusDetailsArea.classList.add('text-warning')
  } else {
    currentDomainHeader.classList.add('title-normal')
    statusDetailsArea.classList.add('text-normal')
  }

  statusTitle.textContent = browser.i18n.getMessage(titleMessage)
  statusDesc.textContent = browser.i18n.getMessage(descMessage)
  statusLink.href = link
  siteStatus.hidden = false
}
