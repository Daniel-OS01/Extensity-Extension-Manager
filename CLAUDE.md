# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install               # install dev dependencies (uglify-js, sass)
npm test                  # run unit tests (Node.js built-in test runner)
npm run check:manifest    # validate manifest.json structure
make dist                 # build: copy, minify, zip → dist/dist.zip
npm run bundle:chrome-store  # generate Chrome Web Store submission bundle → artifacts/chrome-web-store/
```

There is no lint or type-check command. Tests live in `tests/browser-modules.test.js` and use Node's built-in `--test` runner (no external test framework).

To run only one test file:
```bash
node --test tests/browser-modules.test.js
```

## Architecture

This is a Chrome Manifest V3 extension. The production source lives entirely in root-level files — no frontend build step.

### Service Worker Ownership

`js/background.js` is the single owner of all extension enable/disable mutations. UI pages never call `chrome.management` directly — they send messages to the background and receive state back. This single-mutation-path design ensures undo history, usage counters, reminder scheduling, and event history are always updated together.

### Message API

Background handles these message types (defined in `docs/extensity-2.0-plan.md`):
`GET_STATE`, `SET_EXTENSION_STATE`, `TOGGLE_ALL`, `APPLY_PROFILE`, `UNDO_LAST`, `SAVE_ALIAS`, `SAVE_GROUPS`, `SAVE_URL_RULES`, `IMPORT_BACKUP`, `EXPORT_BACKUP`, `SYNC_DRIVE`, `OPEN_DASHBOARD`

Each mutating message carries an operation context object with `source` (`manual` | `bulk` | `profile` | `rule` | `undo` | `import`) — this attribution is required for correct history logging and usage metric tracking.

### Storage Split

- `chrome.storage.sync` — lightweight settings and profile state (quota-sensitive; large collections must not go here)
- `chrome.storage.local` — aliases, groups, URL rules, undo stack, event history, usage counters

`js/storage.js` owns the schema defaults for both stores and exposes `load`, `save`, and `clone` helpers used throughout. `js/migration.js` handles additive version migrations.

### Module Pattern

All `js/` files use an IIFE pattern: `(function(root) { ... })(self)`. They expose a single namespace object on `root` (e.g. `root.ExtensityStorage`, `root.ExtensityHistory`). `background.js` imports all modules via `importScripts()` at the top and accesses them through their namespace.

### UI Surfaces

Each HTML page loads its own Knockout.js ViewModel:

| Page | Entry point | Role |
|------|-------------|------|
| `index.html` | `js/index.js` | Popup: toggle, sort, filter, undo, apply profile |
| `profiles.html` | `js/profiles.js` | Profile editor: rename, bulk delete, layout |
| `options.html` | `js/options.js` | Settings and backup controls |
| `dashboard.html` | `js/dashboard.js` | Aliases, groups, URL rules, history, import/export |

### Supporting Modules

| File | Responsibility |
|------|---------------|
| `js/engine.js` | Knockout.js extenders and shared UI utilities (loaded by all pages) |
| `js/url-rules.js` | URL pattern matching and rule evaluation |
| `js/history-logger.js` | Append-only event history |
| `js/reminders.js` | `chrome.alarms`-based reminder scheduling |
| `js/import-export.js` | Versioned JSON backup envelope (export and import) |
| `js/drive-sync.js` | Google Drive sync stub — OAuth not yet configured |

### Build

`Makefile` copies root source files and `js/`, `styles/`, `images/`, `fonts/` into `dist/`, minifies JS (uglify-js) and CSS (sass), then zips the result. `python3 -m zipfile` is required at build time.

### Key Constraints

- `chrome.commands` is static — profile shortcuts cannot be dynamically created per user.
- Google Drive sync (`js/drive-sync.js`) is incomplete; OAuth manifest config is missing. Do not treat it as available.
- `chrome.storage.sync` quota is tight — never move large or unbounded collections there.
