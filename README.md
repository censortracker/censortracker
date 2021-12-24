CensorTracker: Bypass Censorship
================================

[![Logo](/.github/media/censortracker_popup_en.png)](https://github.com/roskomsvoboda/censortracker)

![Build](https://github.com/roskomsvoboda/censortracker/workflows/Build/badge.svg?branch=master)
[![CodeFactor](https://www.codefactor.io/repository/github/roskomsvoboda/censortracker/badge)](https://www.codefactor.io/repository/github/roskomsvoboda/censortracker)

**CensorTracker** is an extension for [Google Chrome] and [Mozilla Firefox] which helps to bypass censorship and to detect websites blocked through the DPI filters.

[<img src="/.github/media/chrome-web-store.png" title="Chrome Web Store" width="170" height="48" />](https://chrome.google.com/webstore/detail/censor-tracker/gaidoampbkcknofoejhnhbhbhhifgdop)
[<img src="/.github/media/firefox-add-ons.png" title="Firefox Add-ons" width="170" height="48" />](https://addons.mozilla.org/ru/firefox/addon/censor-tracker/)


Features
========

CensorTracker provides a lot of useful features, here are the most
important:

- Configurable proxy
- Country-specific proxying
- Detects [DPI]-filtration
- Bypass censorship and restrictions
- Warns about sites that transfer data to third parties


How does DPI-filters detection work?
====================================

<img src="/.github/media/dpi-diagram.svg" style="width:500px;"/>


What about this "Report DPI-filter" thing?
==========================================

We are collecting anonymized data to check the availability issues of the websites for users from different parts of the country. Such data helps us to extend the list of blocked websites for proxying them and fastly react to new acts of censorship.

Our backend is open source, so you can check how it works: [censortracker_backend](https://github.com/roskomsvoboda/censortracker_backend)

This is an **experimental** feature and can be removed in future releases if it turns out that it is an ineffective way to detect censorship.

Development
===========

Prerequisites
-------------

Make sure you have required versions of `node` and `npm`, which are:

- `node v15.4.0` or higher
- `npm 7.6.3` or higher

Optionally, you may like:

- `docker`
- [`nvm`](https://github.com/nvm-sh/nvm)


The build was tested only on the following operating systems:

- `Ubuntu 19.10`
- `macOS Catalina v10.15.7`

We don't guarantee that CensorTracker will work on outdated versions of browsers,
so make sure you're using the latest ones.

We've tested CensorTracker on the following versions:

- Mozilla Firefox 80 or higher
- Google Chrome 80 or higher

Docker
------

You can use `docker` to avoid installation of all the requirements globally:

```bash
~ docker-compose build
~ docker-compose run ct npm run build:{BROWSER}
```

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


**Troubleshooting**: If you're getting error on building an extension using `npm`, please make sure that your
shell supports per-command environment variables (i.e something like this `NODE_ENV=production npm run build:firefox:prod`)


Going to production
-------------------

You can build a production version of the extension for Chrome like this:

    ~ npm run build:chrome:prod
    ~ npm run release:chrome
    ~ cd release/chrome

and for Firefox like this:

    ~ npm run build:firefox:prod
    ~ npm run release:firefox
    ~ cd release/firefox

**Attention**: Webpack automatically increments a key `version` in the `manifest.json` file on *every build*.
To prevent such behavior you need to add `BUILDUP=0` before the `npm run` command, just like that:

    ~ BUILDUP=0 npm run build:firefox:prod

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
