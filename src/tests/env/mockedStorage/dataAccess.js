/* eslint-disable guard-for-in */
import fs from 'fs/promises'

import { defaultConfig } from '../../../shared/js/extension/base/config/constants'

const mockedStorageFilePath = 'src/tests/env/mockedStorage/data.json'

const writeData = async (data) => {
  await fs.writeFile(
    mockedStorageFilePath,
    `${JSON.stringify(data, null, 2)}\n`,
    'utf8',
  )
}

export async function initialiseStorage () {
  const mockedData = Object.assign({}, defaultConfig)

  mockedData.domains = [
    '0-00.lordfilm0.biz',
    'bbc.co.uk',
    'bbc.com',
    'ru.iherb.com',
  ]

  mockedData.disseminators = [
    {
      cooperationRefused: false,
      url: 'avito.ru',
    },
  ]
  mockedData.icon = ''
  await writeData(mockedData)
}

export async function get (...args) {
  const data = await fs.readFile(mockedStorageFilePath, 'utf8')
  const jsonData = JSON.parse(data)

  if (args.length === 0) {
    return jsonData
  }
  const fetchedData = {}

  if (args.length === 1 && typeof args[0] !== 'string') {
    const dataToFetch = args[0]

    for (const key in dataToFetch) {
      fetchedData[key] = jsonData[key] ?? dataToFetch[key]
    }
  } else {
    args.map((key) => {
      fetchedData[key] = jsonData[key] ?? defaultConfig[key]
      return true
    })
  }
  return fetchedData
}

export async function set (state) {
  const storageData = await get()

  for (const key in state) {
    storageData[key] = state[key]
  }
  await writeData(storageData)
}

export async function remove (...keys) {
  const storageData = await get()

  for (const key in keys) {
    delete storageData[key]
  }
  await writeData(storageData)
}
