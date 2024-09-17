import { i18nGetMessage } from '../../utilities'
import { sendConfigFetchMsg, sendExtensionCallMsg } from '../messaging'

export const showProxyInfo = async () => {
  const proxyInfo = document.getElementById('proxyInfo')
  const serverIdTitleLabel = document.getElementById('serverIdTitleLabel')
  const serverIdLabel = document.getElementById('serverIdLabel')
  const regionLabel = document.getElementById('regionLabel')
  const totalBlockedLabel = document.getElementById('totalBlockedLabel')

  const {
    currentRegionName,
    proxyServerURI,
    customProxyServerURI,
  } = await sendConfigFetchMsg(
    'currentRegionName',
    'proxyServerURI',
    'customProxyServerURI',
  )
  const domains = await sendExtensionCallMsg('popup', 'getDomains')
  const proxyServerId = proxyServerURI.split('.', 1)[0]
  const regionName = currentRegionName || i18nGetMessage('popupAutoMessage')

  if (customProxyServerURI) {
    serverIdTitleLabel.textContent = i18nGetMessage('popupAutoMessage')
    serverIdLabel.textContent = proxyServerURI
  } else {
    serverIdLabel.textContent = proxyServerId
  }

  regionLabel.textContent = regionName
  totalBlockedLabel.textContent = domains.length
  proxyInfo.hidden = false
}
