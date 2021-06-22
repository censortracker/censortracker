import settings from '../settings'

const currentBrowser = settings.getBrowser()

/**
 * Simple element selector.
 * @param id Select by given ID.
 * @param query Select by given query.
 * @param cls Select by given class.
 * @param doc Document.
 * @returns {NodeListOf<*>|HTMLElement|HTMLCollectionOf<Element>}
 */
export const select = ({ id, query, cls, doc = document }) => {
  if (id) {
    return doc.getElementById(id)
  }

  if (cls) {
    return doc.getElementsByClassName(cls)
  }

  return doc.querySelectorAll(query)
}

/**
 * Translate document
 * @param doc Document to translate.
 */
export const translateDocument = (doc) => {
  for (const element of select({ query: '[data-i18n-key]', doc })) {
    const value = element.getAttribute('data-i18n-key')
    const message = currentBrowser.i18n.getMessage(value)

    if (message) {
      element.innerHTML = message
    }
  }
}
