import browser from './browser-api'

type Catalog = Record<string,
  {
    message: string;
    placeholders?: Record<string,
      { content: string }>
  }>
const languages = ['en', 'ru', 'uk']
const auto = { language: 'auto', catalog: {} }
let { language, catalog }: { language: string, catalog: Catalog } = auto
let pending: Promise<string> | undefined
let loading = Promise.resolve(language)
let revision = 0

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
const isPlaceholders = (value: unknown) => value === undefined ||
  (isRecord(value) && Object.values(value)
    .every((item) => isRecord(item) && typeof item.content === 'string'))
const isCatalog = (value: unknown): value is Catalog => isRecord(value) &&
  Object.values(value).every((entry) => isRecord(entry) &&
    typeof entry.message === 'string' && isPlaceholders(entry.placeholders))

// The native catalog cannot follow the user's language choice.
const load = async (value: unknown) => {
  if (typeof value !== 'string' || !languages.includes(value)) {
    return auto
  }
  const response = await fetch(
    browser.runtime.getURL(`_locales/${value}/messages.json`))
  const json: unknown = await response.json()

  return isCatalog(json) ? { language: value, catalog: json } : auto
}

const select = (value: unknown) => {
  const current = ++revision

  loading = load(value).catch(() => auto).then((next) => {
    if (current === revision) {
      ({ language, catalog } = next)
    }
    return language
  })
}

export const getUILanguage = () => language === 'auto'
  ? browser.i18n.getUILanguage?.() || 'en' : language

export const initializeLanguage = () => {
  if (!pending) {
    pending = (async () => {
      browser.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.uiLanguage) {
          select(changes.uiLanguage.newValue)
        }
      })
      const initialRevision = revision
      const { uiLanguage } = await browser.storage.local.get({ uiLanguage: 'auto' })

      if (revision === initialRevision) {
        select(uiLanguage)
      }
      return loading
    })().catch(() => 'auto')
  }
  return pending
}

export const getMessage = (key: string, substitutions?: string | string[]) => {
  const entry = catalog[key]

  if (!entry) {
    return browser.i18n.getMessage(key, substitutions)
  }
  const values: string[] = typeof substitutions === 'string' ? [substitutions] : substitutions ?? []
  const substitute = (text: string) => text.replace(/\$\$|\$([1-9]\d*)/g,
    (match, index?: string) => index
      ? String(values[Number(index) - 1] ?? '') : '$')

  return entry.message.replace(/\$\$|\$([1-9]\d*)|\$(\w+)\$/g,
    (match, index?: string, name?: string) => {
      if (name) {
        return substitute(entry.placeholders?.[name.toLowerCase()]?.content || '')
      }
      return index ? String(values[Number(index) - 1] ?? '') : '$'
    })
}
