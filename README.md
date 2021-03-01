[![Logo](/.github/censortracker-popups.svg)](https://github.com/roskomsvoboda/censortracker)

![Build](https://github.com/roskomsvoboda/censortracker/workflows/Build/badge.svg?branch=master)
[![CodeFactor](https://www.codefactor.io/repository/github/roskomsvoboda/censortracker/badge)](https://www.codefactor.io/repository/github/roskomsvoboda/censortracker)

**Censor Tracker** is an extension for [Google Chrome] and [Mozilla Firefox] which helps to
bypass censorship in Russia and helps to detect resources blocked using DPI filters.

[<img src="/.github/chrome-web-store.png" title="Chrome Web Store" width="170" height="48" />](https://chrome.google.com/webstore/detail/censor-tracker/gaidoampbkcknofoejhnhbhbhhifgdop)
[<img src="/.github/firefox-add-ons.png" title="Firefox Add-ons" width="170" height="48" />](https://addons.mozilla.org/ru/firefox/addon/censor-tracker/)


Note
----
This extension developed for users from Russian and will work correctly only in Russia since there are 
too many dependencies in data that is specific only for Russia.

You can find the Russian version of this README [here](/README_RU.md).

Features
========

Censor Tracker provides a lot of useful features, here are most
important:

-   Detects [DPI]-based locks
-   Bypass [DPI]-based locks
-   Bypass [registry](https://eais.rkn.gov.ru/) locks

Installation
============

To build extension for Chrome (Chromium), run:

    ~ npm install && npm run dev:chrome
    ~ cd dist/chrome

To build extension for Firefox, run:

    ~ npm install && npm run dev:firefox
    ~ cd dist/firefox

Testing
=======


To run all the kind of tests just run following command:

    ~ npm run test

to run just unit tests:

    ~ npm run test:unit

and to run end-to-end tests you need too add `chromedriver` to your `$PATH` and then run this command:

    ~ npm run test:e2e

**Attention**: e2e tests works only on unix systems and requires OpenSSL for generating chrome extension id.


License
=======

Censor Tracker is licensed under the MIT License. See [LICENSE] for more
information.

  [DPI]: https://en.wikipedia.org/wiki/Deep_packet_inspection
  [LICENSE]: https://github.com/roskomsvoboda/censortracker/blob/master/LICENSE
  [Google Chrome]: https://www.google.com/chrome/
  [Mozilla Firefox]: https://www.mozilla.org/en-US/firefox/new/
