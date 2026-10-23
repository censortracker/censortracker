# Unreleased (21.0.0)

- Added a consent page before extension data transmission, with controls to review or withdraw consent in settings and the popup. Rewrote the privacy policy text.
- Added notices after installation and updates, with a support link and saved dismissal state. Notices appear before the consent page and in the popup.
- Ported Amnezia Premium local proxy support with dynamic ports, connection checks, recovery and updated settings.
- Added a shared list for built-in and custom proxies, site distribution, failover and proxy authentication.
- Added proxy imports, optional subscriptions, parallel checks, filtering, sorting and bulk deletion.
- Added proxy check retries and failure reasons. The health flag now shows the selected proxy availability.
- Added site exit-country restrictions; local addresses and exclusions stay direct. Removed the proxy-all switch from settings.
- Added external registries, Anticensority hostname lists and Antizapret proxies limited to provider-listed domains.
- Merged regional, custom and optional API domain lists with separate caches. Added registry load status and redirect support.
- Added automatic API mirror updates, backup and storage mirrors for the Russian registry, and an FAQ mirror link.
- Added ETag caching for downloads, decreased background task frequency to 60 minutes and increased the service request timeout to 60 seconds.
- Improved domain lookup performance for large registries and cached the domain index in IndexedDB.
- Added planned route details, last checked exit information and related page domain selection to the popup.
- Added validated settings imports and exports, including legacy and avatarDD fork backups.
- Fixed restoration of registry and proxy recovery settings from backups, including external registry reloads. Kept the latest registry selection when requests finish out of order.
- Fixed settings reset to restore all user settings before synchronization, also without granted permissions.
- Fixed hostname matching, proxy endpoint validation, stale routing updates and recovery of failed proxies.
- Added built-in service endpoints and direct requests with proxy fallback.
- Fixed port knocks to use a temporary direct route, including in proxy-all mode.
- Fixed Firefox private browsing permission updates, proxy retries and blocking when no proxy is available.
- Stopped saving notification hostnames from private tabs. Bundled fonts to remove remote font requests.
- Declared data collection permissions for Firefox.
- Added detailed diagnostics and a support report export.
- Added an interface language selector for English, Russian and Ukrainian, with English fallback for missing translations.
- Fixed translations, popup layout and dark theme styles. Removed unused translation keys and updated support links to blockedin.org.
- Added an animated Easter egg.
- Migrated the build from webpack and JavaScript to WXT and TypeScript. Page logic now runs in the background, with one bundle per page.
- Cleaned up styles, optimized assets and tightened lint, type and CSP configuration.
- Updated dependencies and the domain editor; added tests, current lint tools and CI build artifacts.
- Made production bundles and release archives reproducible.
- Actualized README and images in it.
- Added direnv Nix based development shell.

Special thanks to [@avatarDD fork](https://github.com/avatarDD/censortracker) for some feature inspirations!

# 15.0.0

- Added support for importing proxy lists from a file or URL
- Fixed styles for dark theme
- Fixed a bug that caused tabs to reload


# 12.0.0

- Fix locale issues
- Refactor PAC file generator
- Add support for '*.onion' and '*.i2p' domains
- Add notification about update availability

# 10.2.0

- Fixed updating issue.

# 10.1.0

- Fixed ignore list saving issues

# 10.0.0

- Censor Tracker now knows how to automatically re-request proxy servers if there are problems with the availability of the proxy server used.
- Made server services more fault-tolerant.
- Fixed inaccuracies and bugs in UI.
- Updating of proxying/ignoring list was made more obvious: now you have to click on corresponding button to save changes.
- Added support for Kyrgyzstan and Uzbekistan.
- Fixed incorrect display of status (icons) on some sites.
- Made debugging information more detailed, so we can help you when problems.
- Fixed inaccuracies in English and Russian versions of the extension.
- Improved overall performance of the extension and reduced the size of the extension (-300kb).
- Fixed other bugs (see GitHub repository for details)

# 8.5.0

- Improved performance of `popup` and `options`
- Added support of website actions in `popup`
- Fixed debug info page for `Firefox` and `Chrome`
- Fixed proxying/ignoring conflicts
- Fixed bug which caused that some requests were not proxied (proxying was not working for `subdomain.domain.com`, but for `domain.com`)
- Fixed typos and grammar in locales
- Removed unused functionality

# 7.0.0
- Added donate button
- Improved performance of pages
- Added support of emergency endpoints
- Added support of regions
- Improved performance of tabs
- Redesigned `Options` page
- Fixed typos in locales
- Added option to choice region based on which will be used specific database of blocked websites.
- Reworked `Advanced options` to make it easy to see debug information.
- Fixed [#409](https://github.com/roskomsvoboda/censortracker/issues/409).
- Fixed [#410](https://github.com/roskomsvoboda/censortracker/issues/410).

# 6.1.0.0
- Fixed bugs
- Improved performance

# 6.0.0.0

- Fix performance issues and bugs
- Migrated to Manifest v3 for Chromium version.
- Added ``chrome.alarms`` and ``browser.alarms`` support.
- Fixed config caching issues.
- Added `Parental Control` feature.
- Fixed [#382](https://github.com/roskomsvoboda/censortracker/issues/382).

### 5.3.1.0

- Fixed duplication in ignore

### 5.3.0.0

- Fixed bugs
- Improved performance
- Add global ignore support

### 5.2.0.0

- Fixed config fetching mechanism
- Improve `onInstall` handler

### 5.1.0.0

- Fixed status icon to make it clear when proxy is enabled/disabled
- Fixed spontaneous activation of proxying on browser start up
- Prevent default dialog window on saving ignored/proxied websites
- Refactor some modules
