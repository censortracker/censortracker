<p align="center">
  <a href="https://censortracker.org/" target="_blank" rel="noreferrer noopener">
    <img width="250" alt="Censor Tracker's Quokka" src="https://censortracker.org/static/img/quokka_big.svg">
  </a>
</p>

<p align="center">
 <b>Censor Tracker</b> is a powerful <strong>censorship circumvention</strong> browser extension.<br>
</p>

<p align="center">In addition, it enables the use of custom proxies and supports <strong>Vless</strong>,
<strong>Vmess</strong>, and <strong>Shadowsocks</strong> in the browser via an external client called <a href="https://github.com/censortracker/proxy">Censor Tracker Proxy</a>.</p>

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

- Configurable proxy settings
- Country-specific proxy routing
- Customizable proxy and exclusion lists
- Built-in resistance to censorship
- Warnings for websites that share user data with third parties
- Support `Vless` ([AmneziaVPN](https://amnezia.org/downloads) is required)

Permissions
===========

Censor Tracker requires the following permissions:

- `alarms` — Enables periodic tasks such as database synchronization and re-requesting the list of proxy servers.
- `activeTab` — Detects IDO websites (primarily relevant for Russian users).
- `management` — Identifies permission conflicts (e.g., with other extensions).
- `notifications` — Displays notifications.
- `proxy` — Configures and utilizes Censor Tracker proxy servers.
- `storage` — Saves user preferences.
- `unlimitedStorage` — Stores the database of blocked websites (due to its large size).
- `webNavigation` — Manages and monitors web requests.
- `http://*/*` and `https://*/*` — Allows website proxying, retrieval of proxy server lists, and user country
  detection (required for country-specific proxying).

Requirements
============

Censor Tracker works with following versions of browsers:

- Mozilla Firefox 98 or higher
- Chromium (Google Chrome, Brave, Edge, Opera etc.) 94 or higher

Development
===========

Make sure you have required versions of `node` and `npm`, which are:

- `node v17.4.0` or higher
- `npm 8.3.1` or higher

Optionally, you may like:

- [`nvm`](https://github.com/nvm-sh/nvm)

Firstly, you will need to install dependencies:

    ~ npm install

Now you can build an extension for Chrome like this:

    ~ npm run build:chrome
    ~ cd dist/chrome

and for Firefox, like this:

    ~ npm run build:firefox
    ~ cd dist/firefox

**Troubleshooting**: If you're getting error on building an extension using `npm`, please make sure that your
shell supports per-command environment variables (i.e something like this
`NODE_ENV=production npm run build:firefox:prod`)

License
=======

Censor Tracker is licensed under the MIT License. See [LICENSE] for more
information.

[LICENSE]: https://github.com/censortracker/censortracker/blob/master/LICENSE
