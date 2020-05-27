'use strict';

(() => {
  const manifest = chrome.runtime.getManifest()
  const rksUrl = 'https://reestr.rublacklist.net'

  window.settings = {
    getName: () => {
      return manifest.name
    },

    getDescription: () => {
      return manifest.description
    },

    getVersion: () => {
      return manifest.version
    },

    getTitle: () => {
      return `${manifest.name} v${manifest.version}`
    },

    getDomainsApiUrl: () => {
      return `${rksUrl}/api/v3/domains/json`
    },

    getRefusedApiUrl: () => {
      return `${rksUrl}/api/v3/ori/refused/json`
    }
  }
})()
