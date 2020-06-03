import localforage from 'localforage'

const DEFAULT_DB_NAME = 'censortracker-db'

class Database {
  constructor (config = { driver: localforage.INDEXEDDB }) {
    localforage.config(config)
  }

  create (name = DEFAULT_DB_NAME) {
    if (name === DEFAULT_DB_NAME) {
      console.warn(`Creating database with default name: ${DEFAULT_DB_NAME}`)
    }

    return localforage.createInstance({ name })
  }

  drop (name) {
    if (!name) {
      throw new Error('You must define name of database to drop.')
    }

    return localforage.dropInstance({ name })
  }
}

export default Database
