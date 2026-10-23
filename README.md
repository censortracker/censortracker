<p align="center">
  <a href="https://censortracker.org/" target="_blank" rel="noreferrer noopener">
    <img width="250" alt="Censor Tracker's Quokka" src="https://censortracker.org/static/img/quokka_big.svg">
  </a>
</p>

<p align="center"><b>English</b> | <a href="README_RU.md">Русский</a></p>

<p align="center">
 <b><a href="https://censortracker.org/">Censor Tracker</a></b> (<a href="https://storage.googleapis.com/amnezia/censortracker">mirror</a>) is a powerful <strong>censorship circumvention</strong> browser extension.<br>
</p>

<p align="center">It supports custom proxies and the local SOCKS5 proxy in <a href="https://amnezia.org/premium">Amnezia Premium</a> (<a href="https://storage.googleapis.com/amnezia/amnezia.org?m-path=/premium">mirror</a>).</p>

<p align="center">
  <a href="https://chrome.google.com/webstore/detail/censor-tracker/gaidoampbkcknofoejhnhbhbhhifgdop" target="_blank">
      <img src="https://img.shields.io/chrome-web-store/v/gaidoampbkcknofoejhnhbhbhhifgdop" alt="Test">
  </a>
  <a href="https://addons.mozilla.org/ru/firefox/addon/censor-tracker/" target="_blank">
      <img src="https://img.shields.io/amo/v/censor-tracker" alt="Test">
  </a>
</p>

<p align="center">
  <img src=".github/media/censortracker_popup_en.png" alt="Censor Tracker popup">
</p>


Features
========

Censor Tracker is an extension that bypasses internet restrictions. It helps you open restricted sites and warns you about sites that share data with government agencies. It works in Russia, Ukraine, Belarus, Kazakhstan, Kyrgyzstan, Uzbekistan, Azerbaijan, Georgia, Turkey and other countries.

With the extension, you can:

- Bypass restrictions, including DPI-based blocking
- Hide your IP from the sites you visit with built-in proxy servers
- Add your own proxies and proxy list subscriptions
- Use the extension together with the [Amnezia VPN](https://amnezia.org/premium) ([mirror](https://storage.googleapis.com/amnezia/amnezia.org?m-path=/premium)) app (Premium) with the "Amnezia Local Proxy" option
- Manage your own lists of sites to open through a proxy
- Learn about sites that share your data with third parties (Russia only)
- Open `*.onion` and `*.i2p` sites without additional software

Censor Tracker does not collect your browser history and does not send data about the sites you open. It has no analytics or trackers. Network functions turn on only after you give consent. For details, see the [privacy policy](https://github.com/censortracker/censortracker/wiki/Privacy-Policy).

If something does not work, try to reinstall the extension or contact support on Telegram: [@censortracker_support_bot](https://t.me/censortracker_support_bot) or by email: support@censortracker.org

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

- [nvm](https://github.com/nvm-sh/nvm)
- [Nix](https://nixos.org/): `nix develop` (or `direnv allow`) gives Node.js and
  `chromium-latest`, `chromium-min`, `firefox-latest`, `firefox-min` for browser tests

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
