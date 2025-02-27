const fs = require('fs')

const getLocalePath = (locale) => `./src/shared/_locales/${locale}/messages.json`

// eslint-disable-next-line id-length
const zip = (a, b) => a.map((k, i) => [k, b[i]])

const getMessageKeys = (locale) => {
  try {
    const rawData = fs.readFileSync(getLocalePath(locale), 'utf8')

    const keys = Object.keys(JSON.parse(rawData))

    keys.sort()

    return keys
  } catch (error) {
    console.error(error)
    return []
  }
}

const ruData = getMessageKeys('ru')
const enData = getMessageKeys('en')
const ukData = getMessageKeys('uk')

for (const [a, b] of zip(ruData, enData, ukData)) {
  if (a !== b) {
    throw new Error(`Keys mismatch found: ${a} !== ${b}`)
  }
}
