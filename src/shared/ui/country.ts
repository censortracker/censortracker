import { getUILanguage } from 'Background/i18n'

const displayNames = new Map<string, Intl.DisplayNames>()

export const regionName = (code: string) => {
  const language = getUILanguage()
  let names = displayNames.get(language)

  if (!names) {
    names = new Intl.DisplayNames([language], { type: 'region' })
    displayNames.set(language, names)
  }
  return names.of(code) ?? code
}

export const countryLabel = (code: string) => `${regionName(code)} (${code})`
