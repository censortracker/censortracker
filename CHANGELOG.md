# 20.15.1

A packaging release: nothing in the extension's behaviour changes, but the
Firefox build can be signed again.

- **The Firefox manifest now declares what data the extension collects.**
  Mozilla has required `browser_specific_settings.gecko.data_collection_permissions`
  of everything submitted to AMO since 3 November 2025, and a package without it
  is refused at validation — which is where `web-ext sign` runs, so the release
  workflow could produce only an unsigned ZIP, and an unsigned ZIP is what
  release Firefox rejects as "corrupt". The declaration is `required: ["none"]`,
  which is accurate: the extension downloads its configuration and proxy lists
  and sends nothing back beyond a `{"type":"ping"}` warm-up carrying no
  identifiers, and the DNS-over-HTTPS lookups resolve proxy hostnames on an
  explicit action, never the sites being visited. Firefox older than 140 ignores
  the key, so `strict_min_version` stays at 91.1.0 — with nothing collected there
  is no consent to obtain and nothing for those versions to miss.

# 20.15.0

Routing corrections found by auditing the extension against what Chromium and
Firefox actually document — the reference that audit produced ships as
`SKILL.md`. Three of them change which traffic goes where, so it is worth
re-checking any site or proxy you had reason to watch.

- **Sites under a multi-label suffix — .co.uk, .com.br, .org.uk — were never
  proxied at all.** The blocklist stores what tldts calls the registrable
  domain, so a blocked site is held as `example.co.uk`, while the PAC cut the
  host down to its last two labels and compared that: `www.example.co.uk` became
  `co.uk`, which is not in the list and never would be. Everything under every
  such suffix went direct, silently. The same truncation threw away any imported
  entry deeper than two labels: a list naming `cdn.example.com` matched nothing.

  The list is now matched by suffix, the way the ignore list already was. One
  entry still covers all of its subdomains — that has not changed and is the
  point of it — and every host under one blocked site still goes through the
  same proxy, because the hash that picks the proxy is taken from the matching
  entry rather than from the host. The walk stops before a bare public suffix,
  so a stray `com` in a malformed imported list cannot route the whole internet
  through the proxy. An imported list is also reduced to bare hosts on the way
  in, dropping the scheme, path or port that could never have matched anyway.

- **A proxy check that cannot install its PAC now says so instead of passing
  everything.** Each probe is routed by the checker's own PAC and by nothing
  else, so if installing it failed, every probe travelled direct, succeeded, and
  reported the proxy it was meant to be testing as working. It now fails the run
  with a clear message — and on Firefox raises the private-windows prompt, since
  a missing private-windows permission makes `proxy.settings.set()` throw rather
  than warn, and that is the usual cause.

- **Firefox no longer resolved names locally for part of a proxy chain.** On the
  SOCKS-authenticating path, `proxyDNS` was set alongside the username and
  password — so only hops that carried a login asked the proxy to resolve the
  destination. That path is taken as soon as *any one* proxy in the chain needs
  a SOCKS login, and it then answers for every hop, so a proxy without
  credentials looked up the destination on this machine: the lookups the proxy
  exists to hide went to the local resolver, `.onion` and `.i2p` could not be
  reached through it at all, and the very same proxy resolved remotely whenever
  the PAC was driving instead. Every SOCKS5 hop now asks the proxy to resolve.
  SOCKS4 deliberately still does not — it cannot carry a host name, and
  requesting one turns the connection into SOCKS4a, which a plain SOCKS4 proxy
  does not answer.

- The PAC object URL is released when proxying is switched off. Firefox has no
  way to be handed a PAC as text, so the script is served from a blob; clearing
  the settings left the last one pinned, and it holds the whole blocklist.

- **The minimum browser version now means something.** The Firefox manifest
  promised 91.1 while the build transpiled for 98, so anyone on 91–97 was offered
  an update that might not run; the Chromium manifest set no floor at all,
  though the build assumes 94. Nothing in the code needs more than Firefox 91 —
  `proxy.settings` and `proxy.onRequest` date to 60, `proxy.onError` to 68, and
  `crypto.randomUUID`, `browser.scripting` and `browser.action` all sit behind
  guards with a fallback — so the build was lowered to meet the promise rather
  than the promise raised to cut those users off. `minimum_chrome_version: 94`
  is declared, and the READMEs state both floors.

- **Documentation.** `SKILL.md` collects what Chromium and Firefox actually do
  with extension proxying — PAC support and its limits, `mandatory`, the hosts
  each browser bypasses on its own (RFC 1918 is in neither), proxy
  authentication and why SOCKS logins cannot work on Chromium, service-worker
  lifetime — each point against the official source, with the traps this project
  has already hit. Two claims that were wrong are corrected: `pacScript.mandatory`
  governs a PAC that cannot be run, not a proxy that cannot be reached, and the
  README's permission list had drifted from the manifests.

  The host hash that decides which proxy a site goes through is now embedded
  into the PAC from its one definition, rather than written out a second time
  inside the script. A comment claimed a test held the two copies in agreement;
  no such test existed.

# 20.14.4

- **"Ignored sites" is honoured again, and local addresses are never proxied.**
  A local address could not be reached at all while the extension was on: the
  router's admin page, a NAS, anything on the home network. Three separate
  faults added up to it.

  A local address could not even be *stored*. Everything typed into "Ignored
  sites" was run through the same filter as the blocklist, which keeps only what
  is a registrable domain — and `192.168.1.1`, `::1`, `localhost` and `nas` have
  none, so each of them was dropped the moment Save was pressed, with the line
  disappearing from the editor as the only sign. Choosing "never proxy" for such
  a site from the popup wrote an empty entry for the same reason. The list now
  stores hosts, so an address, a bare name or a pasted URL all end up as the
  host they name.

  The list was then never consulted when routing. It only ever filtered the
  blocklist, which is enough while just blocked sites are proxied and does
  nothing at all with "proxy ALL traffic" switched on — there is no blocklist
  there to filter, so every ignored site went through the proxy anyway. The
  generated PAC now checks the list itself, in both modes, ahead of everything
  else. An entry covers its subdomains, so ignoring `example.com` also ignores
  `cdn.example.com`.

  Finally, local and private destinations were bypassed only in proxy-all mode,
  and the ranges were incomplete. They are now bypassed in every mode, and the
  set covers what was missing: `100.64.0.0/10` (carrier-grade NAT, which is also
  what Tailscale hands out), `.lan`, `.internal`, `.home.arpa` and the other
  reserved local suffixes, IPv4-mapped IPv6 addresses, and broadcast/multicast.
  `172.16.0.0/12` and `fe80::/10` are matched by value now rather than by
  wildcard, so no public address can be caught by accident.

  One definition of "is this local?" drives the PAC, the popup's explanation of
  where a site comes out, and Firefox's SOCKS routing path — the PAC embeds the
  same function the rest of the extension calls, so the three cannot disagree.

# 20.14.3

- **A SOCKS proxy with a login is now marked in the list itself.** Chromium
  cannot deliver such a login — during the SOCKS handshake it offers only the
  "no authentication" method, so the proxy is contacted without credentials and
  refuses. The warning used to appear once, in the form, at the moment of
  saving; now every affected row carries a mark explaining why that proxy will
  never authenticate no matter how often it is checked. Rows without
  credentials, and HTTP/HTTPS proxies with them, are untouched.

# 20.14.2

- **Proxy authentication actually works now.** The handler shipped in 20.12.0
  never answered a single challenge: it lived only in the background service
  worker, which is asleep almost all the time, and a login prompt blocks the
  connection while it waits for a reply. By the time the worker woke, loaded
  its script and read the credentials out of storage, the request was gone —
  the proxy saw one attempt without credentials and nothing more.

  Two changes fix it. The credentials are kept in memory and the reply is now
  sent without awaiting anything, so no round-trip stands between the prompt
  and the answer. And the handler is registered by the settings page as well
  as the background, which is what makes *checking* an authenticating proxy
  work — that page is open for the whole check, exactly when the prompts
  arrive.

  Verified against a proxy that demands a login: previously the request failed
  with ERR_INVALID_AUTH_CREDENTIALS after a single unauthenticated attempt;
  now the challenge is answered with the stored credentials and the page
  loads. The same holds on the check path.

# 20.14.1

- **Fixed "Could not load the sources" on large proxy lists.** A public list
  can hold hundreds of thousands of entries, and every parsed proxy was passed
  to `Array.push` as a separate argument — past the engine's argument limit,
  which threw "Maximum call stack size exceeded" and failed the whole run.
  Nothing was imported and the cause was invisible: the message blamed the
  download, which had in fact succeeded.

  Alongside the fix, a fetch now takes at most the first 5000 proxies and says
  when it has cut a list short. Beyond a few thousand nothing good happens
  anyway — the checker only ever probes a few dozen, the settings page renders
  every row, and the whole list is written to storage on each change. Parsing
  also stops at that point instead of building objects that would be thrown
  away.

- A source download is given 60 seconds rather than 15. The useful lists are
  megabytes of text, and the old budget aborted them mid-download on an
  ordinary connection, which looked exactly like an unreachable source.

# 20.14.0

- **A proxy can now be checked against a blocked site.** The existing targets
  are all sites nobody blocks, which quietly made a whole class of proxy
  untestable: the ones published by circumvention services relay only to the
  sites they exist for and refuse everything else, so probing them with Google
  asked for the one thing they will not do and reported them as unavailable
  however well they worked. Picking "A blocked site" draws the probe targets
  at random from the blocklist instead. An individual blocked site can of
  course be down on its own account, so a failure there is weaker evidence
  than one against a dedicated endpoint.

- **Proxies of that kind are marked "limited" and survive tidying up.** They
  are imported that way from Antizapret and from any PAC used as a source, and
  both "Remove dead" and the automatic removal now pass over them — as they
  already did for proxies that only need a login. Without this, one press of
  "Remove dead" deleted every proxy the previous point exists to make usable.

# 20.13.0

- **Antizapret and Anticensority can be imported, marked experimental.** Both
  are third-party services run by other people, so nothing is fetched unless
  you ask for it, and each outcome is named rather than reported as a generic
  error.

  Antizapret publishes its proxies inside a PAC script rather than as a list,
  so the servers are read out of that script and added to your proxy list like
  any other — checked, ordered, and subject to the same per-site rules. Their
  addresses are resolved over DNS-over-HTTPS and pinned, because ordinary DNS
  for those names is unreliable exactly where the service is meant to be used.
  Note that the service answers only from Russian IP addresses; anywhere else
  the import will say so instead of looking broken.

  The Anticensority blocklist is an optional extra list of blocked domains —
  around 660k hostnames, which fold to roughly 530k second-level domains, the
  only form this extension's PAC can match. It is stored separately from your
  own proxying list, so it can be switched off or removed without disturbing
  anything you added by hand.

- **A PAC script can now be used as a proxy source.** Feeding one to the
  auto-fetch list used to split it on whitespace like a plain list, harvesting
  fragments of the program — and, since PAC providers routinely point at a
  proxy client running on your own machine, filling the list with `localhost`
  entries that could never work. PAC content is now recognised and its proxy
  declarations read properly, with local addresses left out.

# 20.12.0

- **Proxies that ask for a login and password now work.** The credentials were
  already parsed, stored, exported and shown back in the edit form — and then
  quietly dropped. A PAC script has no room for them and nothing delivered them
  by any other route, so an authenticating proxy failed no matter what was
  typed into the field. The extension now answers the proxy's authentication
  challenge itself, with the credentials saved for that exact proxy.

  Two refusals are what make this safe to switch on. A challenge that does not
  come from a proxy is never answered, so a website replying `401` cannot
  harvest the proxy login. And a challenge from an address that is not one of
  the configured proxies is never answered either. If a proxy turns the
  credentials down they are not resent in a loop: the proxy is reported as
  needing authorization rather than as dead, so auto-removal leaves it alone
  and the login can be corrected.

- **SOCKS proxies with a login work in Firefox.** SOCKS credentials are
  negotiated inside the SOCKS handshake instead of as an HTTP challenge, so
  they need a different route altogether: Firefox is handed the routing
  decisions directly rather than through the PAC. That only happens when a
  selected proxy actually carries SOCKS credentials — every other setup stays
  on the PAC path it has always used, and the two are built from one shared
  description so they cannot disagree about where a site should go.

  Chromium offers no hook into the SOCKS handshake and cannot pass such a login
  at all. Rather than fail silently, the settings page now says so when a proxy
  like that is saved.

- **The same address with and without a login are no longer one proxy.**
  Adding `user:pass@host:port` on top of an existing plain `host:port` used to
  be dropped as a duplicate, leaving only the entry that cannot authenticate —
  and no way to fix it.

- **The popup names the proxy a site goes through**, the way you named it in
  your list, instead of showing only an exit address you then had to recognise.
  The proxy table gives that name room to be read: a wider name column, smaller
  type, measurement columns trimmed to what they actually display, and a
  position column so rows can be referred to by number.

- **A site's "never open through <country>" tick box no longer forgets itself.**
  It re-read the country of wherever the site went *now* — which is exactly what
  the rule had just changed — so ticking "never through NL" moved the site to a
  German proxy and the box came back unticked and relabelled. It now stays on
  the country you acted on.

- Fetching a proxy subscription through an **HTTP** proxy was routed with an
  invalid PAC directive and could never work; it now uses the same routing as
  everything else. An entry with a missing protocol or address is no longer
  reported as alive by the checker either — the probe used to fall through to a
  direct connection and time the site instead of the proxy.

# 20.11.0

- **The popup now says where the current site comes out.** A line at the top
  reports the exit address and country the site is actually reached through —
  or that it is going direct, and why (not on the blocklist, a local address,
  no proxy selected). The answer is not a guess: it comes from the same
  blocklist, the same host hash and the same rules the PAC uses, so it matches
  what traffic really does. A proxy that has not been checked yet has no known
  exit address, so its entry country is shown instead and the popup says so.
- **A site can be told never to use proxies from a given country.** The popup
  offers "never open this site through <country>" for the country in use;
  ticking it re-routes the site to a proxy from somewhere else immediately.
  Rules are per site (a subdomain follows its parent) and several countries
  can be blocked for the same site.

  Two behaviours worth knowing. If every selected proxy turns out to be from a
  blocked country the site goes **direct** rather than through one anyway —
  the rule is treated as binding, and the popup says that is what happened.
  And a proxy whose country is unknown is *not* excluded, since blocking on a
  guess would empty the list for anyone who has not run a check; the popup
  shows how many such proxies there are.

# 20.10.0

- **The extension now tells you when a new version is out.** This build is
  installed from GitHub rather than a web store, so the browser never
  announces a release on its own — `runtime.onUpdateAvailable` only fires when
  a *store* has an update staged, which meant the existing "update available"
  banner could never appear. The release feed is polled instead, every six
  hours and at browser start, and the result shows up in three places:
  - a small **↑ badge on the toolbar icon** — ambient, always visible, and
    nothing to dismiss
  - a **strip at the top of the popup** naming the new version, linking
    straight to its release page
  - the existing alert on the settings page, whose button now opens the
    release instead of restarting the extension (restarting only ever
    relaunched the version already installed)

  Following any of those links clears the badge. Deliberately not a system
  notification: a patch release does not warrant interrupting whatever the
  user is doing. A failed or rate-limited check changes nothing and is retried
  on the next tick, so an unreachable GitHub can never raise a false alarm.
- Fixed the settings-button dot in the popup being decided by whichever of two
  independent checks ran last, so an available update was silently
  un-highlighted whenever the registry was non-empty

- **The proxy list refreshes itself again.** The list is not only edited from
  the settings page — the scheduled source fetch, the dead-hop recovery and
  the bad-proxy cleanup all run in the background and write to storage
  directly. The page was not listening for that, so whatever those jobs added
  or removed stayed invisible until the page was reloaded by hand. It now
  repaints on any outside change (and holds off while a check of its own is
  running, so live per-row updates are not interrupted)
- **"Fetch now" no longer leaves a stale grid when a source fails.** An
  unreachable source threw past the re-render, so the grid kept showing the
  list from before the click while the status sat on "Fetching…" forever. The
  grid is now repainted whatever happens, and a failure says so

# 20.9.4

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
  something to pick

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
