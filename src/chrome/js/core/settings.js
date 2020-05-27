'use strict';

(() => {
  const manifest = chrome.runtime.getManifest()

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
    }
  }
})()
