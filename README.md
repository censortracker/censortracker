<p align="center">
  <a href="https://censortracker.org/" target="_blank" rel="noreferrer noopener">
    <img width="250" alt="Censor Tracker's Quokka" src="https://censortracker.org/static/img/quokka_big.svg">
  </a>
</p>

<p align="center">
 <b>Censor Tracker</b> is a powerful <strong>censorship circumvention</strong> browser extension.<br>
</p>

<p align="center">It supports custom proxies and the local SOCKS5 proxy in <a href="https://amnezia.org/premium">Amnezia Premium</a>.</p>

<p align="center">
  <a href="https://chrome.google.com/webstore/detail/censor-tracker/gaidoampbkcknofoejhnhbhbhhifgdop" target="_blank">
      <img src="https://img.shields.io/chrome-web-store/v/gaidoampbkcknofoejhnhbhbhhifgdop" alt="Test">
  </a>
  <a href="https://addons.mozilla.org/ru/firefox/addon/censor-tracker/" target="_blank">
      <img src="https://img.shields.io/amo/v/censor-tracker" alt="Test">
  </a>
</p>


Features
========

Censor Tracker offers a range of useful features, including:

- Built-in and custom HTTP, HTTPS, SOCKS4 and SOCKS5 proxies
- Country-specific proxy routing
- Customizable proxy and exclusion lists
- Proxy imports from text, files, URLs and PAC files
- Built-in resistance to censorship
- Warnings for websites that share user data with third parties
- Support for the [Amnezia Premium](https://amnezia.org/premium) local proxy (enable **Local system proxy** in AmneziaVPN)

Permissions
===========

Censor Tracker requires the following permissions:

- `alarms` — Enables periodic tasks such as database synchronization and re-requesting the list of proxy servers.
- `activeTab` — Allows inspection of the current page when the user requests related domains.
- `management` — Identifies permission conflicts (e.g., with other extensions).
- `notifications` — Displays notifications.
- `proxy` — Configures built-in and custom proxy routes.
- `storage` — Saves user preferences.
- `unlimitedStorage` — Stores the database of blocked websites (due to its large size).
- `tabs` (Firefox) — Reads tab URLs and supports page inspection.
- `scripting` (Chromium) — Reads resource hostnames from the current page on request.
- `webNavigation` (Chromium) — Monitors navigation and proxy connection errors.
- `webRequest` — Handles request events and proxy authentication.
- `webRequestAuthProvider` (Chromium) and `webRequestBlocking` (Firefox) — Supply proxy credentials.
- `<all_urls>` — Allows website proxying, service downloads, country detection and page inspection.

Requirements
============

The standard builds support these minimum browser versions:

- Mozilla Firefox 91.1.0 or higher
- Chromium (Google Chrome, Brave, Edge, Opera etc.) 108 or higher

Development
===========

Use Node.js 24.15.0 or higher and the npm version included with it.

Optionally, you may like:

- [`nvm`](https://github.com/nvm-sh/nvm)

Firstly, you will need to install dependencies:

    npm ci

Now you can build an extension for Chrome like this:

    npm run build:chrome         # .output/chrome-mv3-dev/

and for Firefox, like this:

    npm run build:firefox        # .output/firefox-mv2-dev/

Use the `:prod` suffix for production builds. Run tests and lint checks with:

    npm test
    npm run lint

**Troubleshooting**: If you're getting error on building an extension using `npm`, please make sure that your
shell supports per-command environment variables (i.e something like this
`CT_FIREFOX_MODERN=1 npm run build:firefox:prod`)

License
=======

Censor Tracker is licensed under the MIT License. See [LICENSE] for more
information.

[LICENSE]: https://github.com/censortracker/censortracker/blob/master/LICENSE
