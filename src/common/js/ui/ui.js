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

export const getTranslatedPopupText = () => {
  return {
    ori: {
      found: {
        title: currentBrowser.i18n.getMessage('distrTitle'),
        statusIcon: 'images/icons/status/icon_danger.svg',
        detailsText: currentBrowser.i18n.getMessage('distrDesc'),
        detailsClasses: ['text-warning'],
        cooperationRefused: {
          message: currentBrowser.i18n.getMessage('distrCoopRefused'),

        },
      },
      notFound: {
        statusIcon: 'images/icons/status/icon_ok.svg',
        title: currentBrowser.i18n.getMessage('notDistrTitle'),
        detailsText: currentBrowser.i18n.getMessage('notDistrDesc'),
      },
    },
    restrictions: {
      true: {
        statusIcon: 'images/icons/status/icon_info.svg',
        title: currentBrowser.i18n.getMessage('blockedTitle'),
        detailsText: currentBrowser.i18n.getMessage('blockedDesc'),
      },
      false: {
        statusIcon: 'images/icons/status/icon_ok.svg',
        title: currentBrowser.i18n.getMessage('notBlockedTitle'),
        detailsText: currentBrowser.i18n.getMessage('notBlockedDesc'),
      },
    },
  }
}
