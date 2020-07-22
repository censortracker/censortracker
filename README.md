[![Logo](https://raw.githubusercontent.com/roskomsvoboda/censortracker/master/.github/readme-logo.png)](https://github.com/roskomsvoboda/censortracker)

![Build](https://github.com/roskomsvoboda/censortracker/workflows/Build/badge.svg?branch=master)
[![CodeFactor](https://www.codefactor.io/repository/github/roskomsvoboda/censortracker/badge)](https://www.codefactor.io/repository/github/roskomsvoboda/censortracker)

**Censor Tracker** is an extension for [Google Chrome](https://www.google.com/chrome/) which helps to
bypass censorship in Russian Federation and helps to detect resources
blocked using DPI.

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

To create tarball run following command:

    ~ npm run pack:dev


Make sure that "Developer Mode" is enabled and then just "Load unpacked"
from <span class="title-ref">dist/</span> to your browser.

License
=======

Censor Tracker is licensed under the MIT License. See [LICENSE] for more
information.

  [DPI]: https://en.wikipedia.org/wiki/Deep_packet_inspection
  [LICENSE]: https://github.com/roskomsvoboda/censortracker/blob/master/LICENSE
