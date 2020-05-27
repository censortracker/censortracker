![](https://raw.githubusercontent.com/roskomsvoboda/censortracker/master/.github/readme-logo.png)

[![Build Status](https://github.com/roskomsvoboda/censortracker/workflows/Node.js%20CI/badge.svg?branch=master&event=push)](https://github.com/roskomsvoboda/censortracker/actions)


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
-   Warns if a user visits a site that can merge or modify https traffic
    (site in [ORI](https://97-fz.rkn.gov.ru/))

Installation
============

To:

    ~ npm install 
    ~ npm run build
    ~ cd dist/

Make sure that "Developer Mode" is enabled and then just "Load unpacked"
from <span class="title-ref">dist/</span> to your browser.

License
=======

Censor Tracker is licensed under the MIT License. See [LICENSE] for more
information.

  [DPI]: https://en.wikipedia.org/wiki/Deep_packet_inspection
  [LICENSE]: https://github.com/roskomsvoboda/censortracker/blob/master/LICENSE
