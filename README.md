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

<p align="center"><b>English</b> · <a href="README.ru.md">Русский</a></p>

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
- Support  `Vless`, `Vmess` and `Shadowsocks` proxies ([Censor Tracker Proxy](https://github.com/censortracker/proxy) is
  required)

What's new
==========

This fork adds several reliability and usability improvements on top of the
upstream extension:

### Works on every modern browser

The runtime detection no longer mistakes Chromium (which, since version 148,
also exposes a `browser` namespace in service workers) for Firefox. The
extension now correctly initializes on **Chrome, Edge, Opera, Yandex, Brave,
Vivaldi and other Chromium browsers, as well as Firefox and Safari**.

### The UI no longer dies when a proxy goes down

- The popup is wrapped in defensive error handling and always becomes visible,
  even if a background check fails — no more blank popup when the proxy or the
  backend is unreachable.
- Every network request (config sync, proxy fetch, registry/ignore lists and
  the keep-alive ping) is bounded by a timeout, so a dead or slow proxy can
  never hang background tasks or freeze the GUI.
- Fixed a typo (`browser.storag.local`) that silently broke the globally
  ignored-hosts sync, plus a crash when the configured country wasn't present
  in the remote config.

### Use any proxy, easily

The custom-proxy field now accepts almost any common format and auto-detects
the protocol, e.g. `socks5://user:pass@1.2.3.4:1080`, `https://proxy:8443` or a
plain `1.2.3.4:1080`.

### One-click helper for adding related domains

Opening a single site often requires proxying a whole set of CDN/API domains,
not just one. The popup can now **scan the current page** and present every
domain it depends on as a checklist — tick a box to add a domain to the proxy
list (untick to remove). The proxy is re-applied instantly.

<p align="center">
  <img width="320" alt="Related domains helper" src="docs/media/related-domains-helper.png">
</p>

### Alternative blocklist source

If the default registry of blocked resources is unavailable, you can point the
extension at **your own mirror** under *Advanced options*. It accepts a JSON
array of domains, a JSON object with a `domains`/`data` field, a JSON array of
objects, or a plain-text list separated by new lines/commas.

<p align="center">
  <img width="520" alt="Alternative blocklist source" src="docs/media/custom-registry-source.png">
</p>

### Automated cross-browser release builds

A GitHub Actions workflow (`.github/workflows/release.yml`) builds and packages
the extension for **all supported browsers**. Pushing a `v*` tag produces
ready-to-upload ZIP packages and attaches them to a GitHub Release; the same
workflow can also be triggered manually to download build artifacts.

Permissions
===========

Censor Tracker requires the following permissions:

- `alarms` — Enables periodic tasks such as database synchronization and re-requesting the list of proxy servers.
- `activeTab` — Detects IDO websites (primarily relevant for Russian users).
- `management` — Identifies permission conflicts (e.g., with other extensions).
- `notifications` — Displays notifications.
- `proxy` — Configures and utilizes Censor Tracker proxy servers.
- `scripting` — Scans the active tab (only when you click *Scan this page*) to discover related domains.
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
