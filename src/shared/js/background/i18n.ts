import en from '../../../locales/en/messages.json'
import ru from '../../../locales/ru/messages.json'
import uk from '../../../locales/uk/messages.json'
import browser from './browser-api'

type Catalog = Record<string,
  {
    message: string;
    placeholders?: Record<string,
      { content: string }>
  }>
const catalogs: Record<string, Catalog> = { en, ru, uk }
let language = 'auto'
let pending: Promise<string> | undefined
let revision = 0

export const getUILanguage = () => language === 'auto'
  ? browser.i18n.getUILanguage?.() || 'en' : language

export const initializeLanguage = () => {
  if (!pending) {
    pending = (async () => {
      browser.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.uiLanguage) {
          revision++
          language = Object.prototype.hasOwnProperty.call(
            catalogs, changes.uiLanguage.newValue as string,
          )
            ? changes.uiLanguage.newValue as string : 'auto'
        }
      })
      const initialRevision = revision
      const { uiLanguage } = await browser.storage.local.get({ uiLanguage: 'auto' })

      if (revision === initialRevision) {
        language = Object.prototype.hasOwnProperty.call(catalogs, uiLanguage) ? uiLanguage : 'auto'
      }
      return language
    })().catch(() => 'auto')
  }
  return pending
}

export const getMessage = (key: string, substitutions?: string | string[]) => {
  if (language === 'auto') {
    const native = browser.i18n.getMessage(key, substitutions)

    if (native) {
      return native
    }
  }
  const catalog = catalogs[getUILanguage().split('-')[0].toLowerCase()] || en
  const entry = catalog[key] || catalogs.en[key]

  if (!entry) {
    return ''
  }
  const values: string[] = typeof substitutions === 'string' ? [substitutions] : substitutions ?? []
  const substitute = (text: string) => text.replace(/\$\$|\$([1-9]\d*)/g,
    (match, index) => index ? String(values[Number(index) - 1] ?? '') : '$')

  return entry.message.replace(/\$\$|\$([1-9]\d*)|\$(\w+)\$/g,
    (match, index, name) => {
      if (name) {
        return substitute(entry.placeholders?.[name.toLowerCase()]?.content || '')
      }
      return index ? String(values[Number(index) - 1] ?? '') : '$'
    })
}
