# 20.2.0

- Reworked the proxy settings into a single unified list of the built-in
  (backend) proxy and user proxies, fixing the broken/cramped layout on Edge
- The address of the currently-used proxy (and of every list entry) is now
  visible
- Proxies can be added, renamed, edited, deleted and switched from the list;
  the built-in proxy can be edited into an overridable copy


# 20.1.0

- Fixed Firefox/Chromium runtime detection so the extension works on Chrome,
  Edge, Opera, Yandex, Brave, Vivaldi, Firefox and Safari (Chromium 148+ also
  exposes a `browser` namespace, which previously broke detection)
- Hardened the popup so it no longer goes blank when a proxy/backend dies, and
  added timeouts to all background network requests
- Custom proxy field now accepts any common format (e.g.
  `socks5://user:pass@host:port`) and auto-detects the protocol
- Manage multiple custom proxies: save several, name them, pick the active one
  from a list and delete entries; the previously hidden built-in proxy can be
  imported into the editable list and overridden
- Added a one-click "related domains" helper: scan the active page and add the
  extra domains it needs to the proxy list via checkboxes
- Added support for an alternative blocklist source (custom registry URL,
  JSON or plain-text formats) for when the default registry is unavailable
- Added a GitHub Actions workflow that builds and releases packages for all
  supported browsers
- Fixed the `browser.storag.local` typo that silently broke ignore-list sync


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
