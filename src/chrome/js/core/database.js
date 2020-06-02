'use strict';

(() => {
  window.localforage.config({
    driver: window.localforage.INDEXEDDB
  })

  const create = (name) => {
    const defaultName = 'censortracker-db'

    if (!name) {
      console.warn(`Creating database with default name: ${defaultName}`)
    }

    return window.localforage.createInstance({
      name: name || defaultName
    })
  }

  const drop = (name) => {
    if (!name) {
      console.error('You must define name of database to drop.')
      return
    }
    return window.localforage.dropInstance({
      name: name
    })
  }

  window.censortracker.database = {
    create: create,
    drop: drop
  }
})()
