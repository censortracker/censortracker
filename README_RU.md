[![Logo](/.github/media/promo-logo.png)](https://github.com/roskomsvoboda/censortracker)

![Build](https://github.com/roskomsvoboda/censortracker/workflows/Build/badge.svg?branch=master)
![Netlify](https://img.shields.io/netlify/1137e5c4-6b68-42a3-ab0b-804b92c482b8)
[![CodeFactor](https://www.codefactor.io/repository/github/roskomsvoboda/censortracker/badge)](https://www.codefactor.io/repository/github/roskomsvoboda/censortracker)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/gaidoampbkcknofoejhnhbhbhhifgdop)](https://chrome.google.com/webstore/detail/censor-tracker/gaidoampbkcknofoejhnhbhbhhifgdop)
[![Mozilla Add-on](https://img.shields.io/amo/v/censor-tracker)](https://addons.mozilla.org/ru/firefox/addon/censor-tracker/)

**Censor Tracker** это расширение для обхода цензуры для [Google Chrome] и [Mozilla Firefox]

[**English**](./README.md) | [**Russian**](./README_RU.md)

[<img src="/.github/media/chrome-web-store.png" title="Chrome Web Store" width="170" height="48" />](https://chrome.google.com/webstore/detail/censor-tracker/gaidoampbkcknofoejhnhbhbhhifgdop)
[<img src="/.github/media/firefox-add-ons.png" title="Firefox Add-ons" width="170" height="48" />](https://addons.mozilla.org/ru/firefox/addon/censor-tracker/)

Функции
========

Censor Tracker предоставляет множество полезных функций, вот самые важные из них:

- Настраиваемый прокси-сервер
- Проксирование с учетом специфики страны
- Пользовательский список проксирования
- Обход цензуры и ограничений (включая [DPI]-фильтрацию)
- Предупреждает о сайтах, которые передают данные третьим лицам

Разработка
===========

Необходимые условия
-------------

Убедитесь, что у вас есть необходимые версии `node` и `npm`, а именно:

- `node v17.4.0` или выше
- `npm 8.3.1` или выше

Также, вы можете использовать:

- [`nvm`](https://github.com/nvm-sh/nvm)


Сборка была протестирована только на следующих операционных системах:

- `Ubuntu 19.10`
- `macOS Catalina v10.15.7`

Мы не гарантируем, что Censor Tracker будет работать на устаревших версиях браузеров,
поэтому убедитесь, что вы используете последние версии браузеров.

Мы протестировали Censor Tracker на следующих версиях:

- Mozilla Firefox 98 или выше
- Google Chrome 94 или выше

Установка
------------

Первым делом установите зависимости:

    ~ npm install


Теперь вы можете создать расширение для Chrome следующим образом:

    ~ npm run build:chrome
    ~ cd dist/chrome

и для Firefox, например, так:

    ~ npm run build:firefox
    ~ cd dist/firefox


**Устранение неполадок**: Если вы получаете ошибку при создании расширения с помощью `npm`, пожалуйста, убедитесь, что ваш
shell поддерживает командные переменные окружения (т.е. что-то вроде этого `NODE_ENV=production npm run build:firefox:prod`)


Запуск
-------------------

Вы можете создать `production` версию расширения для Chrome следующим образом:

    ~ npm run build:chrome:prod
    ~ npm run release:chrome
    ~ cd release/chrome

и для Firefox:

    ~ npm run build:firefox:prod
    ~ npm run release:firefox
    ~ cd release/firefox

Лицензия
=======

Censor Tracker распространяется под лицензией MIT License. Смотрите [LICENSE] для подробной ифнормации.

  [DPI]: https://en.wikipedia.org/wiki/Deep_packet_inspection
  [LICENSE]: https://github.com/roskomsvoboda/censortracker/blob/master/LICENSE
  [Google Chrome]: https://www.google.com/chrome/
  [Mozilla Firefox]: https://www.mozilla.org/en-US/firefox/new/
