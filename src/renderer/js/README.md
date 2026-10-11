# Renderer code (`src/renderer/js`)

The JavaScript of the app's pages. Each HTML page in `src/renderer/pages/` loads one bundle,
`js-bundled/<page>.bundle.js`, built by `scripts/build-renderer.js` (esbuild) from
`entries/<page>.js`. Modules use CommonJS `require`; `require("electron")` means
`core/electron-bridge.js`, the API the preload exposes (no Node.js in the pages).

## Layers

Each folder is a layer. A module imports only from **its own layer or the layers below**:

| Layer | Folder               | What goes there                                                                                                                                |
| ----- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | `utils/`             | Pure helpers with no app knowledge: HTML escaping, number formatting                                                                           |
| 1     | `core/`              | App-wide infrastructure: IPC bridge, i18n, settings store, theme, typed DOM lookups (`dom.js`), tooltips, toasts, dates in the user's language |
| 2     | `services/`          | Data and side effects without UI: network APIs (`services/api/`), analytics, saved locations, reminders                                        |
| 3     | `components/`        | UI pieces used by several pages: page header, prayer list, adhan overlay, location pickers, dialogs                                            |
| 4     | `app/`               | `app-shell.js`: the start-up every page shares (settings, theme, header, adhan, mini player)                                                   |
| 5     | `pages/`, `windows/` | One page each (`windows/` = the small windows: widget, popups, background player)                                                              |
| 6     | `entries/`           | One file per bundle: starts its page through `app-shell.js`                                                                                    |

Two more rules: **a page never imports another page** (shared code moves down to
`components/`, `services/` or `core/`), and **no circular imports**.

## Pages

A small page is one file, `pages/<name>.js`. When a page grows past one concern, it becomes a
folder, `pages/<name>/`, whose `index.js` keeps the same exports and only wires the parts
together (see `pages/quran/`):

- one module per concern (`surah-list.js`, `reader.js`, `translation-picker.js`, …)
- `state.js` for what several of its modules read and change. CommonJS exports are not live
  bindings: a `let` reassigned in one file is not seen by another, so shared values live on one
  object (`state.currentSurah = …`)
- network code goes down to `services/api/`, big static tables to `src/renderer/data/*.json`

## Enforced by `npm run lint` (and CI)

- `lint:architecture` (`scripts/check-architecture.js`): the layers, independent pages, no cycles
- ESLint `max-lines`: at most **300 code lines** per file (blank lines and comments not counted),
  in the main process too
- ESLint `no-unsanitized` (Mozilla): no `innerHTML` / `insertAdjacentHTML` / `outerHTML` with
  anything but a constant string (see HTML below)
- `lint:types`: TypeScript checks the JSDoc types (`src/renderer/tsconfig.json`), including every
  IPC channel name (`src/shared/ipc-channels.d.ts`)
- `lint:csp` / `lint:locales`: every page's Content-Security-Policy, the translation files

## Conventions

- Elements a page cannot work without: `byId("id", HTMLButtonElement)` / `query()` / `queryAll()`
  from `core/dom.js` (typed, with a clear error if missing). Optional ones:
  `document.getElementById()` and a null check.
- Text: `data-i18n` attributes in the HTML, `t("key")` in code (`core/i18n.js`); keys in
  `src/renderer/locales/{en,ar,fr}`.
- HTML: build it with the `` html`...` `` tag and put it on the page with `setHtml(el, fragment)`
  or `insertHtml(el, position, fragment)` (`utils/html.js`). Every `${value}` is escaped, nested
  `` html`...` `` fragments and arrays of them go in as they are, `false`/`null` add nothing:

  ```js
  setHtml(list, html`<ul>${items.map((item) => html`<li>${item.name}</li>`)}</ul>`);
  ```

  So text from the network, the user or a translation never becomes markup. (Prettier leaves
  the template contents alone: `embeddedLanguageFormatting` is off.)
- Prayer times and Hijri dates come from the main process (offline cache), never from Aladhan
  directly.

## Adding things

- **A page**: the HTML in `src/renderer/pages/<group>/`, `entries/<page>.js`, the page module in
  `pages/`, its CSS in `css/04-pages/`, the page name in `PAGE_GROUPS`
  (`src/main/config/paths.js`), then `node scripts/check-csp.js --fix`.
- **An IPC channel**: add it to `src/shared/ipc-channels.d.ts` first; `npm run lint:types` then
  lists the preload allow-list and the main-process handler to add.
