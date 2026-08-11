---
name: browser-proxying
description: Как браузеры на самом деле применяют проксирование из расширения — PAC, chrome.proxy, browser.proxy.onRequest, аутентификация, обход локальных адресов. Читать перед любым изменением маршрутизации в Censor Tracker.
---

# Проксирование в браузерных расширениях

Справочник по тому, как Chromium и Firefox применяют проксирование, заданное
расширением, и что из этого уже стоило нам багов. Каждый факт ниже подтверждён
официальным источником — список в конце; догадки помечены явно.

Читайте это **до** правки маршрутизации: почти каждый пункт здесь появился
после того, как кто-то предположил обратное.

---

## 1. Что чем управляет в этом репозитории

Маршрутизацией занимаются два независимых механизма, и они должны давать
одинаковый ответ.

| | Механизм | Где | Когда работает |
|---|---|---|---|
| Основной | Сгенерированный PAC-скрипт | `background/pac.js` → `browser.proxy.settings` | Всегда, оба браузера |
| Запасной | `browser.proxy.onRequest` | `background/proxy-auth.js` | Только Firefox и только когда в цепочке есть SOCKS с логином |

Плюс два потребителя того же решения, которые ничего не маршрутизируют, но
обязаны предсказывать результат:

- `background/site-rules.js` → `resolveProxyForHost()` — то, что попап
  показывает пользователю («через какую проксю откроется этот сайт»).
- `background/proxy.js` → `describeRouteFor()` — собирает для попапа контекст.

**Классификация хоста живёт в одном месте — `background/host-rules.js`.**
`getPacScript()` не переписывает её в тексте PAC, а встраивает исходник функций
через `Function.prototype.toString()`; `site-rules.js` и `proxy-auth.js`
импортируют те же функции напрямую. Так три ответа не могут разойтись.

### Правило для встраиваемых функций

`isPrivateHost`, `isIgnoredHost` (в `host-rules.js`) и `hashHost` (в `pac.js`)
встраиваются в PAC как текст. Из этого следует жёсткое ограничение:

- **Никаких ссылок на модульную область видимости.** Все вспомогательные
  функции и константы объявляются внутри тела. Внешнее имя переживёт
  `toString()`, но в PAC его не существует — а production-сборка это имя ещё и
  переименует (terser).
- **Только то, что есть в песочнице PAC.** Нет `console`, нет `URL`, нет
  `fetch`, нет `browser`/`chrome`.
- `let`/`const`/стрелки допустимы: PAC исполняют те же движки (V8 и
  SpiderMonkey), что и страницы.

Нарушение проявляется **только в production-сборке** (в dev-сборке имена не
переименовываются) и выглядит как «PAC перестал применяться» — то есть весь
трафик молча идёт напрямую.

---

## 2. PAC: язык и среда исполнения

### Что вызывается и с чем

```js
function FindProxyForURL(url, host) { … }
```

- Верхний уровень скрипта выполняется **один раз** при установке PAC. Всё
  тяжёлое (списки, предрасчитанные строки) должно жить там.
- `FindProxyForURL` вызывается **на каждый запрос**. Здесь недопустимы лишние
  аллокации и линейные проходы по большим спискам.
- В Chromium `url` **санитизирован**: путь, query, фрагмент и user-info
  вырезаны — это сделано в Chrome 52 по соображениям безопасности и не
  отключается. Опираться в PAC на путь нельзя.
- `host` — хост без квадратных скобок для IPv6.

### Встроенные функции

Без DNS (дёшево): `isPlainHostName`, `dnsDomainIs`, `localHostOrDomainIs`,
`shExpMatch`, `dnsDomainLevels`, `convert_addr`, `weekdayRange`, `dateRange`,
`timeRange`, `alert`.

**С DNS (дорого, вызывать в последнюю очередь):** `isResolvable`, `dnsResolve`,
`isInNet` (если передан хост, а не IP). MDN прямо предупреждает: они требуют
обращения к DNS-серверу, а при работе через проксю та сделает собственный
резолв, удваивая нагрузку.

В нашем PAC ни одна DNS-функция не используется — вся классификация строковая
и арифметическая.

### Возвращаемое значение

Строка из записей через `;`, слева направо — приоритет:

```
DIRECT
PROXY host:port
SOCKS host:port
```

Firefox дополнительно понимает `HTTP`, `HTTPS`, `SOCKS4`, `SOCKS5`.
Chromium понимает `PROXY`, `HTTPS`, `SOCKS4`, `SOCKS5`, `DIRECT`.

**Failover идёт по этой строке.** Если в ней нет `DIRECT`, то при недоступности
всех перечисленных прокси запрос падает — он не «утечёт» в прямое соединение.
Для инструмента обхода цензуры это желаемое поведение, и именно поэтому
`buildRotations()` никогда не дописывает `DIRECT` в конец.

Расписание повторных попыток к «мёртвой» прокси различается:

- **Chromium**: неудачная прокси помечается плохой на **5 минут**; она не
  выбрасывается, а опускается в конец списка.
- **Firefox**: повтор через **30 минут**, далее с шагом +30 минут.

### Кодировка (Chromium)

`pacScript.data` должен быть **чистым ASCII** — иначе весь вызов
`proxy.settings.set()` отклоняется, и проксирование не применяется вообще.
Отсюда две вещи в `pac.js`:

- домены переводятся в Punycode (`toPunycode`);
- готовый текст прогоняется через `toAsciiSource()`, который экранирует всё
  оставшееся как `\uXXXX`.

Хосты в PAC приходят уже в Punycode, поэтому Unicode-запись в блок-листе не
совпала бы ни с чем даже без этого ограничения.

---

## 3. Chromium (Chrome, Edge, Opera, Brave, Yandex, Vivaldi)

### API

`chrome.proxy`, разрешение `"proxy"`. Режимы: `direct`, `auto_detect`,
`pac_script`, `fixed_servers`, `system`. Мы используем `pac_script` с
**встроенным** текстом (`pacScript.data`), а не URL.

### `mandatory` значит не то, что кажется

`pacScript.mandatory` относится к **скрипту**, а не к прокси: когда PAC не
удалось получить или выполнить, откат на прямое соединение запрещён, и запросы
падают с `ERR_MANDATORY_PROXY_CONFIGURATION_FAILED`. Это **не** про
недоступную проксю — та и так не даст утечки, если возвращённая строка не
содержит `DIRECT`.

У Firefox для `autoConfigUrl` эквивалента нет: флаг чисто Chromium-ский.

### `scope` и инкогнито

`scope: 'regular'` — настройки применяются к обычным окнам и **наследуются
окнами инкогнито**, если те не переопределены. Отдельные scope
`incognito_persistent` / `incognito_session_only` существуют, причём последний
можно установить только при открытом окне инкогнито.

`levelOfControl` показывает, кто на самом деле управляет настройкой: другое
расширение с более высоким приоритетом может отобрать её
(`controlled_by_other_extensions`).

### Неявный обход прокси — и чего в нём НЕТ

Chromium **всегда** пускает мимо прокси:

- `localhost`, `*.localhost`
- `[::1]`
- `127.0.0.1/8`
- `169.254/16`
- `[FE80::]/10`

Обосновано безопасностью: веб-платформа считает `localhost` защищённым
источником, и возможность его проксировать давала бы лишние полномочия.
Отключается только флагом командной строки `<-loopback>`.

> **Ключевой момент.** В этом списке **нет RFC 1918** — ни `192.168.0.0/16`, ни
> `10.0.0.0/8`, ни `172.16.0.0/12`, ни CGNAT `100.64.0.0/10`. Роутер, NAS,
> принтер, домашний сервер — всё это браузер отправит в проксю, если PAC не
> скажет иначе. Именно на этом сломалась версия 20.14.3: адреса из
> «Игнорируемых сайтов» проксировались, и на локальный IP было не зайти.
> Поэтому `isPrivateHost()` в `host-rules.js` перечисляет диапазоны явно и
> проверяется **во всех режимах**, а не только при «проксировать весь трафик».

### SOCKS: аутентификации нет вообще

Документация сети Chromium прямо говорит: для SOCKS4 и SOCKS5 «no proxy
authentication methods are supported». Хука в SOCKS-рукопожатие расширению не
предоставляется, `onAuthRequired` для SOCKS не срабатывает никогда (он про
HTTP-уровень). Логин к SOCKS-прокси в Chromium **недоставим в принципе** — это
не баг расширения. Поэтому такие записи помечаются в списке прокси (20.14.3).

Работает только для HTTP-прокси (Basic, Digest, Negotiate, NTLM) и
HTTPS-прокси (то же плюс клиентские сертификаты).

### DNS через SOCKS

- SOCKS4 — резолв **всегда на стороне клиента**, и цель обязана быть IPv4
  (адрес кодируется четырьмя октетами).
- SOCKS5 — резолв **всегда на стороне прокси**. Аналога firefox-овского
  `network.proxy.socks_remote_dns` в Chromium нет.

### `onAuthRequired` в Manifest V3

- Нужно разрешение **`webRequestAuthProvider`**. `webRequestBlocking` в MV3
  большинству расширений больше недоступен (остаётся только для расширений,
  установленных политикой).
- Указывается ровно один из режимов: `blocking` или `asyncBlocking`. В Chromium
  используется `asyncBlocking` с колбэком, в Firefox — `blocking` с промисом.

### Service worker живёт 30 секунд

Фоновый service worker выгружается **после 30 секунд бездействия**; событие или
вызов API сбрасывают таймер, входящее событие «оживляет» уснувший worker.

Практическое следствие, стоившее нам версии 20.14.2: запрос логина к прокси
блокирует соединение, пока слушатель думает. Если ответ приходит после
пробуждения worker'а, загрузки его скрипта и похода в `storage`, запрос уже
потерян. Поэтому учётные данные держатся **в памяти**, а ответ отдаётся
синхронно, без единого `await` (`answerProxyAuthSync`).

### Загрузка внешних PAC

Если когда-нибудь понадобится `pacScript.url` вместо `data`: такие загрузки
никогда не идут через проксю, не видны `webRequest` и service worker'ам, не
поддерживают HTTP-аутентификацию и клиентские сертификаты, ограничены 30
секундами, 1 МБ и ответом ровно `200`. Кодировка по умолчанию — **ISO-8859-1**,
а не UTF-8.

---

## 4. Firefox

### PAC ставится только по URL

У `browser.proxy.settings` нет поля для встроенного текста PAC — есть только
`autoConfigUrl`. Отсюда приём в `applyPacData()`: текст заворачивается в `Blob`
с типом `application/x-ns-proxy-autoconfig`, и в настройки уходит
`URL.createObjectURL(blob)`. Предыдущий object URL обязательно отзывать
(`revokeObjectURL`), иначе при частых обновлениях (проверка прокси обновляет PAC
многократно) они накапливаются.

Свойства `settings`: `proxyType` (`none` | `autoDetect` | `system` | `manual` |
`autoConfig`, по умолчанию `system`), `autoConfigUrl`, `http`, `ssl`, `socks`,
`socksVersion` (4 или 5, по умолчанию 5), `passthrough` (список хостов через
запятую), `proxyDNS` (по умолчанию `true` для SOCKS5 и `false` для SOCKS4),
`httpProxyAll`, `autoLogin`, `ftp`. **Пропущенные свойства сбрасываются в
значения по умолчанию** — передавайте объект целиком.

### Приватные окна: без разрешения `set()` бросает исключение

> «Changing proxy settings requires private browsing window access because proxy
> settings affect private and non-private windows… If your extension doesn't
> have private window permission, calls to `proxy.settings.set()` throw an
> exception.»

Это не предупреждение, а отказ. Проверять — `extension.isAllowedIncognitoAccess()`.
В репозитории на это заведены `grantIncognitoAccess()`, флаг
`privateBrowsingPermissionsRequired` и страница `incognito-required.html`.

### `proxy.onRequest`

Требует разрешение `"proxy"` **и** host-разрешения на перехватываемые URL:
паттерны в `filter` должны быть подмножеством host-разрешений расширения.

Слушатель может вернуть `ProxyInfo`, массив `ProxyInfo`, либо промис к тому или
другому. **Массив — это failover:** если прокси на позиции N недоступна к
моменту истечения её `failoverTimeout`, браузер пробует N+1.

> ⚠️ **Тонкость, которую легко пропустить.** «By default, the request fails over
> to any browser-defined proxy unless a `null` object or an array ending in a
> `null` object (`[{…}, null]`) is returned.» То есть без завершающего `null`
> после исчерпания вашего списка Firefox уйдёт на прокси, настроенную в самом
> браузере (у нас это наш же PAC из `proxy.settings`). Явный `{type:'direct'}` —
> это осознанное прямое соединение, а не «утечка», и именно его мы возвращаем
> для локальных и игнорируемых хостов.

### `ProxyInfo`

| Поле | Ограничение |
|---|---|
| `type` | `direct`, `http`, `https`, `socks` (=SOCKS5), `socks4`, `masque` |
| `host`, `port` | обязательны, кроме `direct` |
| `username`, `password` | **только для `socks`**; для `masque` запрещены |
| `proxyDNS` | **только для `socks` и `socks4`**, по умолчанию `false` |
| `failoverTimeout` | секунды до перехода к следующему элементу массива |
| `proxyAuthorizationHeader` | для HTTP/HTTPS-прокси в CONNECT; готовый заголовок вида `Basic …` |
| `connectionIsolationKey` | дополнительный ключ изоляции соединения |

Отсюда важное: **SOCKS-логин в Firefox доставляется через `proxy.onRequest`**,
а не через `onAuthRequired`, — ровно противоположно Chromium, где он недоставим
никак. Для HTTP/HTTPS-прокси в Firefox есть два пути: `onAuthRequired` или
готовый `proxyAuthorizationHeader` без всякого челленджа.

Обратите внимание: `type: 'direct'` игнорирует остальные поля и **не
переопределяет прокси, настроенную пользователем**.

### localhost всегда напрямую

С Firefox 67 локальные адреса (`localhost`, `127.0.0.1`, `::1`) обходят проксю
всегда; отключается только скрытой настройкой
`network.proxy.allow_hijacking_localhost` в `about:config`. Изменение сделано
после CVE-2018-18506, где PAC мог непреднамеренно проксировать localhost.
RFC 1918, как и в Chromium, сюда **не входит**.

### `proxy.onError` отдаёт `Error`

Firefox передаёт в `proxy.onError` объект `Error`, а не `{ error }`, как
Chromium в `proxy.onProxyError`, а `webRequest.onErrorOccurred` — третий формат.
Чтение `.error` у `Error` даёт `undefined` и раньше роняло обработчик; сейчас
все три формата нормализуются в `extractProxyError()`.

---

## 5. Матрица различий

| | Chromium | Firefox |
|---|---|---|
| Встроенный текст PAC | `pacScript.data` | нет — только `autoConfigUrl` (Blob URL) |
| PAC обязан быть ASCII | **да** | нет |
| `mandatory` | есть (про скрипт) | нет |
| Схемы в PAC | PROXY, HTTPS, SOCKS4, SOCKS5, DIRECT | + HTTP, SOCKS |
| Неявный обход | localhost, `*.localhost`, 127/8, 169.254/16, fe80::/10 | localhost, 127.0.0.1, ::1 (c FF 67) |
| RFC 1918 в обходе | **нет** | **нет** |
| Плохая прокси | 5 минут в конец списка | повтор через 30 мин, шаг +30 мин |
| SOCKS-логин | **невозможен** | `ProxyInfo.username/password` |
| HTTP-логин | `onAuthRequired` + `webRequestAuthProvider` | `onAuthRequired` (`blocking`) или `proxyAuthorizationHeader` |
| Перехват запроса | нет аналога | `proxy.onRequest` |
| DNS у SOCKS5 | всегда на стороне прокси | `proxyDNS`, по умолчанию `true` для v5 |
| Фон | service worker, 30 с простоя | persistent background page |
| Приватные окна | scope-и, наследование | без разрешения `settings.set()` **бросает** |

---

## 6. Грабли, на которые уже наступали

Каждый пункт — реальный релиз, подробности в `CHANGELOG.md`.

1. **`tldts.getDomain()` возвращает `null` для IP и односегментных хостов.**
   `getDomain('192.168.1.1')`, `getDomain('localhost')`, `getDomain('nas')` —
   все `null`. Любая фильтрация пользовательского списка через него молча
   выбрасывает ровно те адреса, ради которых список и заводили (20.14.4).
   Для списков хостов используйте `normalizeHostEntry()` из `host-rules.js`,
   а не `removeDuplicates()` из `utilities.js`.

2. **Список исключений, который фильтрует только блок-лист, не работает в
   режиме «проксировать весь трафик»** — фильтровать там нечего (20.14.4).
   Любое правило «не проксировать» обязано проверяться в самом
   `FindProxyForURL`.

3. **`shExpMatch` с шаблонами диапазонов почти всегда неточен.** `'172.2?.*'`
   выглядит как 172.20–172.29, но подобных шаблонов для `100.64.0.0/10` не
   существует вовсе. Числовое сравнение октетов и короче, и точнее (20.14.4).

4. **Второй уровень домена ≠ хост.** `FindProxyForURL` обрезает хост до второго
   уровня перед сверкой с блок-листом, поэтому запись `sub.example.com` в
   списке не совпадёт ни с чем, а `192.168.1.1` превращается в `1.1`.

5. **Ответ на запрос логина не переживает поход в `storage`** (20.14.2).
   См. раздел про service worker.

6. **`console.warn`/`console.error` в Chromium попадают в список ошибок
   расширения.** Информационные сообщения — только `console.log`.

7. **Регистрация обработчиков в Chromium должна быть защищена проверками:**
   отсутствие одного API роняло весь service worker на этапе загрузки, а вместе
   с ним и все остальные обработчики.

8. **`browser` есть и в Chromium** (в service worker'ах, начиная со 148), так
   что определять Firefox по наличию `browser` нельзя — проверяется
   `browser.runtime.getBrowserInfo`.

---

## 7. Чеклист перед изменением маршрутизации

1. Правило про «не проксировать» добавлено в `FindProxyForURL` **до** ветки
   `proxyAll`? Иначе оно не сработает в режиме всего трафика.
2. Та же логика отражена в `resolveProxyForHost()` — или, лучше, обе стороны
   зовут одну функцию из `host-rules.js`?
3. Если функция встраивается в PAC — она self-contained? (см. §1)
4. `proxy-auth.js` → `handleProxyRequest()` даёт тот же ответ? Это Firefox с
   SOCKS-логином, отдельный путь, про который забывают.
5. Новое поле в маршрутизации прокинуто во **все** места сборки: `_setProxy()`,
   `applyCheckerPac()`, `applyRouting()`, `setRoutingSnapshot()`,
   `describeRouteFor()`.
6. Ключ хранилища добавлен в `REGISTRY_STORAGE_KEYS` (`registry.js`), иначе
   кэш не сбросится, и настройка применится только после перезапуска.
7. Собрано в **production**-режиме и проверено там: часть проблем со
   встраиванием видна только после terser.

### Как проверять

PAC нельзя выполнить внутри расширения — CSP Manifest V3 запрещает
`new Function`. Проверять надо снаружи: сгенерировать скрипт настоящим
`getPacScript()` и выполнить его в песочнице (`node:vm`), подсунув реализации
PAC-встроенных функций (`isPlainHostName`, `shExpMatch`, `dnsDomainIs`).
Полезно сравнивать не только «проксируется/нет», но и **какую именно строку**
вернул PAC против цепочки из `resolveProxyForHost()` — иначе расхождение в
`hashHost` останется незамеченным, а попап начнёт называть не ту проксю.

Отдельно стоит прогонять тот же набор проверок против PAC, полученного из
**минифицированной** сборки: это единственный способ убедиться, что встраивание
через `toString()` пережило babel и terser.

---

## 8. Источники

- [Chromium — `net/docs/proxy.md`](https://chromium.googlesource.com/chromium/src/+/HEAD/net/docs/proxy.md)
  — схемы прокси, неявный обход, DNS у SOCKS, отсутствие SOCKS-аутентификации,
  кэш плохих прокси, санитизация URL, правила загрузки PAC.
- [`chrome.proxy`](https://developer.chrome.com/docs/extensions/reference/api/proxy)
  — `ProxyConfig`, `PacScript.mandatory`, `bypassList`, `onProxyError`.
- [`chrome.types` — `ChromeSetting`](https://developer.chrome.com/docs/extensions/reference/api/types)
  — `scope`, `levelOfControl`.
- [`chrome.webRequest`](https://developer.chrome.com/docs/extensions/reference/api/webRequest)
  — `onAuthRequired`, `webRequestAuthProvider`, `isProxy`, MV3-ограничения.
- [Жизненный цикл service worker'а расширения](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
  — 30 секунд простоя.
- [MDN — `proxy.settings`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/proxy/settings)
  — свойства, требование доступа к приватным окнам.
- [MDN — `proxy.onRequest`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/proxy/onRequest)
  — возвращаемые значения, failover, поведение без завершающего `null`.
- [MDN — `proxy.ProxyInfo`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/proxy/ProxyInfo)
  — поля и их ограничения.
- [MDN — PAC-файл](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Proxy_servers_and_tunneling/Proxy_Auto-Configuration_PAC_file)
  — встроенные функции, DNS-предупреждение, формат возврата, расписание повторов.
- [Bugzilla 1507110](https://bugzilla.mozilla.org/show_bug.cgi?id=1507110)
  — localhost всегда напрямую с Firefox 67, `network.proxy.allow_hijacking_localhost`.
