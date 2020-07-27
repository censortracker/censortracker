[![Logo](https://raw.githubusercontent.com/roskomsvoboda/censortracker/develop/.github/censortracker-popups.svg)](https://github.com/roskomsvoboda/censortracker)

![Build](https://github.com/roskomsvoboda/censortracker/workflows/Build/badge.svg?branch=master)
[![CodeFactor](https://www.codefactor.io/repository/github/roskomsvoboda/censortracker/badge)](https://www.codefactor.io/repository/github/roskomsvoboda/censortracker)

**Censor Tracker** — это расширение для браузера [Google Chrome](https://www.google.com/chrome/) которое позволяет обходить интернет-цензуру в РФ.

Возможности
===========

Censor Tracker предоставляет различные возможности, включая:

- Обнаружение и обход DPI блокировок
- Обход блокировок, осуществляемых [реестром запрещенных сайтов](https://eais.rkn.gov.ru/)
- Выявление веб-сайтов, находящихся в списке [ОРИ](https://97-fz.rkn.gov.ru/) и передающих данные третьим лицам

Установка
=========

Чтобы установить расширение, перейдите в директорию с кодом расширения и выполните команду :

    ~ npm install && npm run dev
    ~ cd dist/


Зайдите в Chrome в раздел с расширениями и включите "Режим разработчика", нажмите на «Установить распакованное расширение» и 
укажите путь до папки, в которую вы распаковали расширение.
