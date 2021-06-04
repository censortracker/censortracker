/**
 * Translate given document
 * @param doc document object.
 */
export const translateDocument = (doc) => {
  for (const element of doc.querySelectorAll('[data-i18n-key]')) {
    const { value: transKey } = element.attributes.item('data-i18n-key')

    const message = browser.i18n.getMessage(transKey)

    if (message) {
      element.innerText = message
    }
  }
}
