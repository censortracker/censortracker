[![Logo](/.github/censortracker-popups.svg)](https://github.com/roskomsvoboda/censortracker)

![Build](https://github.com/roskomsvoboda/censortracker/workflows/Build/badge.svg?branch=master)
[![CodeFactor](https://www.codefactor.io/repository/github/roskomsvoboda/censortracker/badge)](https://www.codefactor.io/repository/github/roskomsvoboda/censortracker)

**Censor Tracker** is an extension for [Google Chrome] and [Mozilla Firefox] which helps to bypass censorship in
Russia and to detect websites blocked through the DPI filters.

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


Development
===========

Prerequisites
-------------

Make sure you have required versions of `node` and `npm`, which are:

- `node v15.4.0`
- `npm 7.6.3`

The build was tested only on the following operating systems:

- `Ubuntu 19.10`
- `macOS Catalina v10.15.7` (MacBook Pro 13″, 2017)

We don't guarantee that CensorTracker will work on outdated versions of browsers,
so make sure you're using the latest ones.

We've tested CensorTracker on the following versions:

- `Firefox 80 - 86`
- `Chrome 80 - 89`

Installation
------------

Firstly, you will need to install dependencies:

    ~ npm install


Now you can build an extension for Chrome like this:

    ~ npm run build:chrome
    ~ cd dist/chrome

and for Firefox, like this:

    ~ npm run build:firefox
    ~ cd dist/firefox


Going to production
-------------------

You can build a production version of the extension for Chrome like this:

    ~ npm run build:chrome:prod
    ~ cd dist/chrome

and for Firefox like this:

    ~ npm run build:firefox:prod
    ~ cd dist/firefox


Testing
-------


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
