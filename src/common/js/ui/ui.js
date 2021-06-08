/**
 * Simple element selector.
 * @param id Select by given ID.
 * @param query Select by given query.
 * @param cls Select by given class.
 * @returns {NodeListOf<*>|HTMLElement|HTMLCollectionOf<Element>}
 */
export const select = ({ id, query, cls }) => {
  if (id) {
    return document.getElementById(id)
  }

  if (cls) {
    return document.getElementsByClassName(cls)
  }

  return document.querySelectorAll(query)
}

export const getTranslatedPopupText = () => {
  return {
    siteIsUnavailable: 'Сайт недоступен',
    controlledByOtherExtensions: 'Другое расширение контролирует прокси. Подробнее &rarr;',
    privateBrowsingPermissionsRequired: 'Прокси отключён. Требуется разрешение на работу в приватных окнах &rarr;',
    ori: {
      found: {
        title: 'Является организатором распространения информации',
        statusIcon: 'images/icons/status/icon_danger.svg',
        detailsText: 'Сервис может передавать ваши личные данные, в том числе сообщения и весь трафик, ' +
            'российским государственным органам в автоматическом режиме.',
        detailsClasses: ['text-warning'],
        cooperationRefused: {
          message: 'Сервис заявил, что они не передают трафик российским ' +
            'государственным органам в автоматическом режиме.',

        },
      },
      notFound: {
        title: 'Не является организатором распространения информации',
        statusIcon: 'images/icons/status/icon_ok.svg',
        detailsText: 'Сервисы из реестра ОРИ могут передавать ваши личные данные, в т.ч. сообщения и весь трафик, ' +
            'государственным органам в автоматическом режиме. Этот сервис не находится в реестре ОРИ.',
      },
    },
    restrictions: {
      found: {
        title: 'Запрещён в России',
        statusIcon: 'images/icons/status/icon_info.svg',
        detailsText: 'Доступ к сайту запрещён, но Censor Tracker даёт к нему доступ через надёжный прокси.',
      },
      notFound: {
        title: 'Не запрещён в России',
        statusIcon: 'images/icons/status/icon_ok.svg',
        detailsText: 'Если доступ к сайту запретят, то Censor Tracker предложит открыть сайт через надёжный прокси.',
      },
    },
  }
}
