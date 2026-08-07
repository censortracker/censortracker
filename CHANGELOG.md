# 20.9.3

- **Proxies given as hostnames now get a country too.** Geo-IP only maps
  addresses, so until now a proxy written as `proxy.example.com` stayed
  "unknown" no matter how often detection ran. Hostnames are resolved over
  DNS-over-HTTPS first (Cloudflare, falling back to Google — extensions get no
  DNS API on Chromium), then geo-located as before. Names sharing an address
  cost a single geo lookup, and results are cached per hostname so nothing is
  resolved twice. Note that resolving a name discloses it to the resolver —
  the same class of exposure as the geo-IP lookup it feeds, and only for
  hostname proxies
- **Fixed country codes rendering as "NL NL".** The flag emoji was built from
  regional indicator pairs, and Windows ships no glyphs for those, so Chrome
  drew the letters instead — right next to the code. Flags are gone; the cells
  show the code, with the full country name in the tooltip
- **Sortable columns in the proxy list.** Click a column header to sort by it,
  click again to reverse; an arrow marks the active column. Name, address,
  country, exit country, ping, site-open latency and status are all sortable,
  and the headers are keyboard-operable. Sorting is a view preference — the
  stored order is left alone, so it never disturbs the chain or the order the
  checker walks the list in. Rows with nothing to compare (an untested proxy
  under "ping", say) always sort last, in both directions
- **The "keep only" country picker no longer looks broken when it is empty.**
  It is filled from countries that have already been resolved, so before a
  detection run there was simply nothing to choose and no hint why. It now
  says which case applies — the proxy list is empty, or the countries have not
  been determined yet — and the button next to it is disabled until there is
  something to pick. Note that only proxies given as IPv4 addresses can have
  their country resolved; ones given as hostnames stay unknown

# 20.9.2

- **Fixed proxying refusing to switch on whenever the site list was not
  empty.** Chromium rejects a PAC script containing any non-ASCII character
  (`'pacScript.data' supports only ASCII code`), and the blocklist was
  embedded verbatim — so a single internationalized domain (`пример.рф`)
  failed the whole `setProxy()` call. The extension then caught that failure
  and turned proxying back off, which is why the toggle would not stick and
  traffic kept going direct. It also explains why an empty list appeared to
  work: with no domains there was no non-ASCII to reject.
- Domains are now converted to their Punycode form before going into the PAC,
  and the finished script is escaped to ASCII as a safety net. This also fixes
  internationalized domains never matching in the first place: the browser
  hands the PAC the Punycode host, so a Unicode entry in the list could never
  have matched it

# 20.9.1

Fixes a regression in 20.9.0 that could stop proxying entirely.

- **Proxying no longer silently falls back to a direct connection.** The
  response validation added in 20.9.0 was too strict about the shape of the
  proxy config, and failing it is worse than not checking at all: the address
  never reaches storage, the PAC is then built without a proxy, and every
  request goes direct while the interface still shows proxying as enabled.
  The address is now derived from anything a usable `host:port` can be formed
  from — a `server` field that already carries its port is accepted, and a
  scheme prefix or trailing slash is stripped instead of being passed through.
  Only a payload with no usable address at all is refused
- Fixed a related bug that predates 20.9.0: a `server` value carrying a scheme
  produced the PAC directive `HTTPS https://host:443`, which is not valid and
  silently disabled routing. The ping endpoint is built the same way now

# 20.9.0

Hardening and proxy-list quality-of-life, ported from the `jimdi/censortracker`
fork and reworked to fit this tree.

Security:

- **PAC injection fixed.** `fetchSourceText()` interpolated the proxy chain
  into a single-quoted PAC string literal without escaping. A quote inside a
  proxy URI — routinely fetched from third-party subscription feeds — closed
  the literal and ran arbitrary code inside the PAC sandbox. The directive is
  now emitted via `JSON.stringify()`
- **Private ranges no longer leak through the proxy** in proxy-all mode. The
  bypass list covered only `127.*`, `10.*`, `192.168.*` and `::1`; it now also
  covers `172.16.0.0/12`, link-local `169.254.0.0/16`, `0.0.0.0`, IPv6
  unique-local (`fc00::/7`) and IPv6 link-local (`fe80::/10`)
- **Settings import is allow-listed and shape-checked.** `importSettings()`
  wrote an arbitrary JSON file straight into `storage.local`, which let a
  shared settings file pin a chosen proxy server or forge the blocklist. Only
  user-owned settings are restored now; everything derived is re-synced.
  Unlike the fork's version the allow-list includes `customProxies`/
  `proxyChain`, so exporting settings remains a usable backup of the proxy
  list — and because that makes proxy ids reachable from a file, the imported
  list is validated: ids must look like ones the extension issues, entries
  without a protocol or URI are dropped, duplicate ids are collapsed, and
  chain entries pointing at nothing are removed
- **Markup escaping in the proxy list.** Proxy ids went into `data-id="…"`
  unescaped, as did the id and name of every local-proxy config — the latter
  arriving from the local daemon's HTTP API. Both are escaped now
- Server responses are validated before use: a malformed proxy payload can no
  longer be stored as the literal URI `undefined:undefined`, the ignore feed is
  rejected unless it is an array of real domains, and config mirrors returning
  a non-object are skipped
- `atob()` on the `loadFor` parameter is guarded and the result must be an
  http(s) URL; local-proxy config UUIDs are URL-encoded; the options page no
  longer publishes the `server` module as `window.server`

Fixes:

- `setProxy()` calls are serialized. Storage changes, tab events and the
  options page can all trigger a PAC rebuild at once, and overlapping runs
  raced — the slower one won and could install a PAC built from an already
  stale domain list or chain
- Config mirrors are now fetched in parallel instead of one-at-a-time, so an
  unreachable mirror no longer costs a full 8s timeout before the next is
  tried. The winner is still chosen by mirror *priority*, not by whoever
  answers first, and the GeoIP lookup and storage writes happen once, for the
  winner only
- A reachable GeoIP service that answers without a country code now falls back
  to the default region instead of returning `undefined`, which matched no
  config entry and flagged a supported country as unsupported
- A malformed disseminators (ORI) payload is no longer stored. The registry
  calls `.find()` on that value for every tab load, so one bad sync used to
  break disseminator warnings for the rest of the session
- Fixed the Firefox "incognito required" tab page, which linked a stylesheet
  that does not exist and rendered completely unstyled. It also carried the
  only i18n key in the tree with no translation; every key referenced anywhere
  now resolves in all three locales

Proxy list:

- Adding a proxy that is already in the list no longer creates a duplicate
  (the bulk paste/subscription path already de-duplicated; the single-add form
  did not)
- New **"Remove duplicates"** toolbar button. A chain slot held by a removed
  duplicate is handed over to the surviving entry instead of being dropped
- Proxies answering **407 Proxy Authentication Required** get their own
  "auth required" status instead of being reported as dead — and are no longer
  deleted by dead-proxy auto-removal, since they work once credentials are set
- During a check, rows now show "queued" until their batch actually starts, so
  a large run no longer claims to be probing every proxy at once

Build:

- Replaced the deprecated `eslint-loader` with `eslint-webpack-plugin` and
  moved from ESLint 6.8 to 8.57 (`babel-eslint` → `@babel/eslint-parser`). The
  rule set was preserved rather than reset — verified by diffing
  `eslint --print-config`, 229 enabled rules became 238 with nothing weakened.
  Dropped five devDependencies nothing referenced any more

# 20.8.0

- New country pre-filter for the proxy list. A proxy's country is resolved from
  its IP address, so it is known *before* anything connects to it:
  - "Determine countries" resolves the country of every proxy that doesn't have
    one yet (batched, cached, with progress)
  - a blocklist mode removes proxies from the listed countries immediately —
    they are never checked at all
  - an allowlist mode keeps only the listed countries
  - "Keep only this country" picks from the countries actually present in the
    list (flag + proxy count) and removes everything else
  - the filter can run automatically on proxies fetched from subscriptions and
    pasted from the clipboard, and runs first when "Test all" is pressed
  - proxies whose country can't be resolved are kept unless explicitly opted in
- Fixed a dead custom proxy leaving the browser unable to load anything: the
  proxy-error handler used to bail out whenever a custom proxy was in use, so a
  failing hop (especially with "proxy all traffic" on) was never acted upon. The
  chain is now re-probed, dead hops are unticked and the proxies stay in the list
- Fixed `Error on connection to null`: the failing server is derived from the
  configured address when storage doesn't have it, and the config re-sync now
  runs even when no server can be blamed
- Proxy recovery is rate-limited to once every 30 seconds. An unreachable proxy
  makes the browser report an error for every request, and each one used to
  trigger a full re-sync round
- Fixed the proxy-error handler throwing on Firefox, where `proxy.onError` hands
  over an `Error` object instead of `{ error }`
- Informational messages are no longer logged at warn/error level. Chromium (and
  Opera, which surfaces the "Errors" button prominently) collects those into the
  extension's error list, which made ordinary events like "PAC has been set
  successfully!" look like failures
- Chromium listener registration is guarded, so a missing API can no longer throw
  while the service worker is evaluating and take every other listener with it


# 20.7.1

- Added a "Proxy ALL traffic" toggle in the proxy settings: route every
  website (except local/private destinations) through the selected proxies,
  not only the blocked ones. Previously, selecting a proxy only affected
  websites from the registry/custom list, so any other site kept connecting
  directly by design — which looked like "proxying doesn't work" when
  checked against an IP-echo site
- When that toggle is on, an empty blocklist no longer disables proxying,
  and the settings page now warns when the proxying list is empty
- Fixed the proxy datagrid columns drifting out of alignment (the actions
  column was content-sized, so every row resolved its own grid)
- The proxy settings and domain list pages now use the full window width
  instead of a fixed phone-sized column
- Fixed the exit-country check of two proxies in one parallel batch
  colliding on a shared host (www.cloudflare.com / checkip.amazonaws.com
  were used by both the connectivity pool and the IP-echo pool)


# 20.7.0

- The proxy list is now a datagrid with one column per parameter: name,
  address, country, exit country, ping, site-open time and status
- The proxy's country moved out of the name into its own column, and a new
  "exit" column shows the country websites actually see when connecting
  through the proxy (detected 2ip.ru-style — an IP-echo request routed
  through the proxy, geo-resolved and cached)
- Latency is now measured two ways, each in its own column: "ping" (raw
  round-trip to the proxy server itself) and "site" (time to open a test
  site through the proxy)
- New bulk actions: remove unchecked, remove untested and remove all proxies
  (with confirmation)
- Added "Copy list" buttons to the proxied-domains and exclusions editors
- Performance: the PAC script no longer rebuilds its blocklist and proxy
  rotations on every request; the registry is cached in memory (invalidated
  via storage.onChanged); config sync fetches run in parallel; the warm-up
  ping is throttled; dead proxies fetched from sources are removed in one
  batch
- Fixed a phantom proxy re-appearing after the list was emptied (the legacy
  single-proxy migration re-imported the mirrored address of the chain's
  first hop)


# 20.6.0

- Selecting several proxies now actually uses all of them: traffic is
  load-balanced across the selected proxies (each site is routed through one,
  chosen consistently, with the rest as automatic failover) instead of always
  using only the first reachable one. (True multi-hop chaining isn't possible
  with a browser PAC.)


# 20.5.0

- Each proxy row now shows the country of its server (flag + code), resolved
  from the proxy IP via a free HTTPS geo-IP lookup and cached so every IP is
  fetched only once; flags fill in automatically in the background


# 20.4.1

- Fixed dead-proxy removal after a parallel check: results are now persisted
  per batch in a single write (the parallel probes were racing each other and
  losing some "dead" statuses), removal happens in one atomic pass, and routing
  is restored without forcing proxying back on


# 20.4.0

- Proxy checking now runs in parallel (multi-threaded) instead of one proxy at
  a time, so large lists finish far faster
- Browsing no longer drops while checking: the user's real traffic keeps
  flowing through the active proxy/chain for the whole run — only the
  connectivity-probe endpoints are routed through the proxies under test
  (the checker PAC is applied as mandatory so a dead proxy fails the probe
  instead of leaking to a direct connection)
- Added a "Stop" button to abort a running check and a manual "Remove dead"
  button; dead proxies can also be dropped on the fly during a check
- Added one-click presets for ready-made, regularly-updated proxy
  subscriptions (monosans, Proxifly, TheSpeedX)
- Made the proxy list and proxy-sources sections collapsible (state is
  remembered) and added a live progress bar while checking
- The PAC script now emits the correct `PROXY` keyword for plain HTTP proxies
  so imported HTTP proxies work when activated


# 20.2.2

- Fixed dark-theme contrast on the popup "Scan this page" / "Add domains"
  buttons and the options "Cancel" / "Close tab" buttons, whose labels were
  rendering invisible (same colour as the background) under a dark colour scheme


# 20.2.1

- Firefox releases are now signed by Mozilla and shipped as an installable
  `.xpi` — the previous unsigned `.zip` was rejected by stable Firefox with the
  misleading "this add-on appears to be corrupt" error
- Added a stable add-on id (`browser_specific_settings.gecko.id`) so Firefox
  recognises updates and applies them cleanly


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
