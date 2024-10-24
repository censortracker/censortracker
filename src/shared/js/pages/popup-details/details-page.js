// eslint-disable-next-line no-unused-vars
import * as controlled from '../controlled'
import { showControllingExtensions } from './control'
import { showPermissionsPopup } from './permissions'
import { showProxyInfo } from './proxy'
import { showSiteStatusInfo } from './status'

(async () => {
  const backToPopup = document.querySelector('#backToPopup')

  const params = new URLSearchParams(window.location.search)
  const [reason, status] = params.get('reason').split('-')

  console.log(reason, status)

  if (reason === 'control') {
    await showControllingExtensions()
  } else if (reason === 'proxy') {
    await showProxyInfo()
  } else if (reason === 'permissions') {
    await showPermissionsPopup()
  } else {
    await showSiteStatusInfo(reason, status)
  }

  const show = () => {
    document.documentElement.style.visibility = 'initial'
  }

  backToPopup.addEventListener('click', () => {
    window.location.href = 'popup.html'
  })

  setTimeout(show, 100)
})()
