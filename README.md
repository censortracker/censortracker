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

Censor Tracker provides a lot of useful features, here are the most important:

- Configurable proxy
- Country-specific proxying
- Custom proxy and ignore lists
- Censorship-resistant itself
- Warns about websites that transfer data to third parties
- Supports  `Vless`, `Vmess` and `Shadowsocks` proxies ([Censor Tracker Proxy](https://github.com/censortracker/proxy)
  is
  required)

Permissions
===========

Censor Tracker requires the following permissions:

- `alarms` to support periodic tasks, such as database synchronization
- `activeTab` to detect IDO websites
- `management` to be able to detect permission conflicts (e.g. with other extensions)
- `notifications` to show notifications
- `proxy` to configure and use Censor Tracker proxy servers
- `storage` to save preferences
- `unlimitedStorage` to save the database of blocked websites (there are a lot of them)
- `webNavigation` for handling requests
- `http://*/*` and `https://*/*` to proxy any website, retrieve the list of proxy servers, and detect the user's
  country (required for country-specific proxying)

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
