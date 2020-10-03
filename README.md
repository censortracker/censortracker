[![Logo](/.github/censortracker-popups.svg)](https://github.com/roskomsvoboda/censortracker)

![Build](https://github.com/roskomsvoboda/censortracker/workflows/Build/badge.svg?branch=master)
[![CodeFactor](https://www.codefactor.io/repository/github/roskomsvoboda/censortracker/badge)](https://www.codefactor.io/repository/github/roskomsvoboda/censortracker)

**Censor Tracker** is an extension for [Google Chrome](https://www.google.com/chrome/) which helps to
bypass censorship in Russian Federation and helps to detect resources
blocked using DPI.

Note
----

This extension oriented only for Russian users and will work correctly only in Russia since
there are too many dependencies in data which is specific only for Russia.

You can find the Russian version of README [here](/README_RU.md).

Features
========

Censor Tracker provides a lot of useful features, here are most
important:

-   Detects [DPI] locks
-   Bypass [DPI] locks
-   Bypass [registry](https://eais.rkn.gov.ru/) locks
-   Warns if a user visits a website that can merge or modify https traffic
    (site in [ORI](https://97-fz.rkn.gov.ru/))

Installation
============

To build extension run:

    ~ npm install && npm run dev
    ~ cd dist/

Make sure that "Developer Mode" is enabled and then just "Load unpacked"
from <span class="title-ref">dist/</span> to your browser.

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
