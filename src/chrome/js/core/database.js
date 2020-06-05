import localforage from 'localforage'

const DEFAULT_DB_NAME = 'censortracker-db'

class Database {
  constructor (name = DEFAULT_DB_NAME, config = { driver: localforage.INDEXEDDB }) {
    localforage.config(config)
    this.name = name
    this.db = localforage.createInstance({ name })
  }

  async get (key, defaultValue) {
    const result = await this.db.getItem(key)

    return result === null ? defaultValue : result
  }

  async set (key, value) {
    await this.db.setItem(key, value)

    return this
  }

  async delete () {
    await localforage.dropInstance({ name: this.name })
  }
}

export default Database
