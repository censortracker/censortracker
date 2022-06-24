const fs = require('fs')

const getLocalePath = (locale) => `./src/shared/_locales/${locale}/messages.json`

const loadData = ({ locale }) => {
  try {
    const rawData = fs.readFileSync(getLocalePath(locale), 'utf8')

    return JSON.parse(rawData)
  } catch (error) {
    console.error(error)
    return []
  }
}

const storeData = ({ locale, data }) => {
  const sortedData = Object.fromEntries(Object.entries(data).sort())

  try {
    fs.writeFileSync(
      getLocalePath(locale),
      JSON.stringify(sortedData, null, 2),
    )
  } catch (error) {
    console.error(error)
  }
}

for (const locale of ['ru', 'en']) {
  const data = loadData({ locale })

  if (Object.keys(data).length > 0) {
    storeData({ locale, data })
  } else {
    console.error(`Messages for ${locale} not found`)
  }
}
