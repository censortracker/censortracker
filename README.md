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

- Built-in and custom HTTP, HTTPS, SOCKS4 and SOCKS5 proxies, with site distribution and failover
- HTTP/HTTPS proxy authentication in both browsers; SOCKS5 authentication in Firefox
- Regional blocked-site registries and optional external hostname lists, including Anticensority
- Full hostname and subdomain rules, international domain names, and exclusion lists
- Proxy imports from text, files, URLs and PAC files; optional subscriptions and Antizapret imports
- Parallel proxy checks with delay, exit IP and country results; filtering, sorting and bulk deletion
- Optional proxy-all mode and site exit-country restrictions in Advanced options
- Popup details for the planned route and last checked exit; selection of related page domains to proxy
- Validated settings backups, including imports from legacy Censor Tracker and avatarDD fork backups
- Warnings for websites in the information-disseminator registry
- Amnezia Premium local proxy with automatic port detection and connection checks

To use the local proxy, open AmneziaVPN and enable **Local system proxy**.
Select **Amnezia Premium local proxy** in the extension settings. The extension
uses the control API at `localhost:49490` and gets the SOCKS5 port from the app.
It checks the connection every minute, or every three seconds while the settings
page is visible. If the app stops, proxy routing is suspended and sites use the
normal browser connection. Routing resumes when the app returns. Selecting the
proxy list stops the local proxy. Manage VPN configurations in AmneziaVPN.

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

Install dependencies from the repository root:

    npm ci

Build commands and output directories:

    npm run build:chrome         # .output/chrome-mv3-dev/
    npm run build:firefox        # .output/firefox-mv2-dev/
    npm run build:chrome:prod    # .output/chrome-mv3/
    npm run build:firefox:prod   # .output/firefox-mv2/
    npm run build:firefox:modern # .output/firefox-mv2-modern/ (Firefox 140+)

The standard Firefox build supports Firefox 91.1.0+ and uses the extension consent
page. The modern build also includes Firefox's native data consent metadata.
Firefox 91 rejects this [manifest field](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings).
Both builds use the same code, assets, and API permissions. Use
`npm run release:firefox:modern` to save the modern archive in `releases/firefox-modern/`.

Run tests and all lint checks from the repository root:

    npm test
    npm run typecheck
    npm run lint
    npm run stylelint
    npm run locales:check

For browser tests, build the production bundles, then run `npm run test:browser`. The tests need `chromium`,
`firefox` and `openssl` on `PATH`; use `CHROMIUM` and `FIREFOX` to specify other browser executable paths.
To test the Chrome development bundle, build it and set `CT_BROWSER_BUILD=dev`.
To test modern Firefox consent, set `CT_FIREFOX_BUILD=modern` and run
`node --test --test-name-pattern='Firefox=true' tests/browser-consent.cjs`.
For Chromium 108, use a display or `xvfb-run` with `CT_CHROMIUM_HEADLESS=off`.
Newer versions use the default `new` headless mode.
Use fixed browser binaries. For archived Firefox builds, set the
`DisableAppUpdate` distribution policy so the binary cannot update during tests.

The proxy authentication test uses website navigation. Chromium 108 does not
send authentication events for extension fetches. On that version, background
proxy checks need credentials cached by an authenticated website request.
See the [Chromium issue](https://issues.chromium.org/issues/40275804).

Extension sources use strict TypeScript modules. Background services and their
types are in `src/shared/js/background/`. `background-rpc.ts` defines the message
contract for callers and handlers. The `Background` import alias is unchanged.
Pages use Preact TSX in `src/shared/ui/pages/`. Shared components, hooks, and Sass
definitions are in `src/shared/ui/`. Components use SCSS Modules; shared values
are in `styles/_tokens.scss`. Keep rich catalog messages in `RichMessage` so
dynamic substitutions are escaped.

WXT uses Vite and the Preact plugin to compile TypeScript, JSX, and external CSS.
The targets remain Chromium 108+ (Manifest V3) and Firefox 91.1.0+ (Manifest V2).
Type checks run separately. Node tests use Babel to load TypeScript modules.
Build configuration and task scripts remain JavaScript.
Functions used by PAC generation must remain self-contained when serialized.

WXT entrypoints are in `src/entrypoints/`. The background entrypoint calls
`startBackground` synchronously. Static assets are in `public/`. Translation
catalogs are in `src/locales/`. WXT copies them to `_locales/` in each build.
`src/manifest.ts` keeps the browser permissions and compatibility metadata.

Pages share one Preact app and use History API routing. Each original `.html`
path has a WXT HTML entrypoint, so direct loads and reloads use the same URLs.
Internal links use absolute paths. New tabs and external links keep their original
behaviour. Page state and subscriptions reset when the route changes.
Use `npm run dev` or `npm run dev:firefox` for WXT development with live reload.

To compare page screenshots, keep the original build directory and run:

    CHROMIUM=/path/to/chrome node tests/visual.cjs /path/to/original/.output .output /tmp/ct-visual

The runner fixes data, timestamps, and animation frames. It checks three languages,
both themes, page states, and layout boundaries. It saves screenshots, differences,
and the browser version in `report.json`. For the Firefox rendering engine, use
`CT_VISUAL_ENGINE=firefox FIREFOX=/path/to/playwright/firefox`. The browser must
match the installed `playwright-core` version. Chromium can vary by a few pixels
at toggle edges even when both inputs use the same build. Use a baseline control
comparison to identify this rendering variance. Use `CT_VISUAL_CASES`,
`CT_VISUAL_LANGUAGES`, or `CT_VISUAL_WIDTHS` to check a smaller set during development.
Run `npm run test:reproducible` to compare release files and archives from two paths.

The Build workflow runs on each push and uploads the Chrome and both Firefox production folders as artifacts.

**Troubleshooting**: If you're getting error on building an extension using `npm`, please make sure that your
shell supports per-command environment variables (i.e something like this
`CT_FIREFOX_MODERN=1 wxt build -b firefox --mv2` in `npm run build:firefox:modern`)

License
=======

Censor Tracker is licensed under the MIT License. See [LICENSE] for more
information.

[LICENSE]: https://github.com/censortracker/censortracker/blob/master/LICENSE
