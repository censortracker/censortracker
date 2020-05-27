|

.. image:: https://raw.githubusercontent.com/roskomsvoboda/censortracker/master/.github/readme-logo.png
     :target: https://example.com

|


**Censor Tracker** is an extension for `Google Chrome`_ which helps to bypass censorship in Russian Federation and helps to detect resources blocked using DPI.

Features
--------

Censor Tracker provides a lot of useful features, here are most important:

- Detects `DPI`_ locks
- Bypass `DPI`_ locks
- Bypass `registry`_ locks
- Warns if a user visits a site that can merge or modify https traffic (site in `ORI`_)


Installation
------------

To:

.. code:: text

    ~ npm install && gulp dist && ls dist/


Make sure that "Developer Mode" is enabled and then just "Load unpacked" from `dist/` to your browser.


License
-------

Censor Tracker is licensed under the MIT License. See `LICENSE`_ for more
information.

.. _LICENSE: https://github.com/roskomsvoboda/censortracker/blob/master/LICENSE
.. _Google Chrome: https://www.google.com/chrome/
.. _ORI: https://97-fz.rkn.gov.ru/
.. _registry: https://eais.rkn.gov.ru/
.. _DPI: https://en.wikipedia.org/wiki/Deep_packet_inspection
