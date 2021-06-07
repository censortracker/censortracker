export const getElementById = (id) => document.getElementById(id)
export const querySelectorAll = (selector) => document.querySelectorAll(selector)

export const uiConfig = {
  ori: {
    found: {
      title: 'Является организатором распространения информации',
      statusIcon: 'images/icons/status/icon_danger.svg',
      detailsText: 'Сервис может передавать ваши личные данные, в том числе сообщения и весь трафик, ' +
        'российским государственным органам в автоматическом режиме.',
      detailsClasses: ['text-warning'],
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
