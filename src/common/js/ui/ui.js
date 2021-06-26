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
 * Translate given document.
 * @param doc Document to translate.
 * @param props Properties.
 */
export const translateDocument = (doc, props = {}) => {
  for (const element of select({ query: '[data-i18n-key]', doc })) {
    const value = element.getAttribute('data-i18n-key')
    // Extract value with the given name from "props".
    const renderProp = element.getAttribute('data-i18n-render-prop')

    let message = currentBrowser.i18n.getMessage(value)

    if (renderProp && Object.hasOwnProperty.call(props, renderProp)) {
      message = currentBrowser.i18n.getMessage(value, props[renderProp])
    }

    if (message) {
      element.innerHTML = message
    }
  }
}
