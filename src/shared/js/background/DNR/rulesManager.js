export const updateDNRRules = async () => {
  console.warn('[DNR] Updating rules')
  // КОСТЫЛЬ
  const { usename, password } = { usename: 'test', password: 'test', proxyServerURI: 'auth.ctreserve.de:45678' }

  const updatedRule = {
    id: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [
        {
          header: 'Authorization',
          operation: 'set',
          value: `Basic ${btoa(`${usename}:${password}`)}`,
        },
      ],
    },
    condition: {
      urlFilter: '*://*/*',
      // urlFilter: proxyServerURI,
      resourceTypes: ['main_frame', 'sub_frame'],
    },
  }

  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1],
    addRules: [updatedRule],
  }).then(() => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError)
    } else {
      console.log('Proxy authorization rule updated successfully.')
    }
  })
}
