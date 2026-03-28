# Extensity 2.0 Plan

## Goals

- Keep the MV3 + Knockout.js architecture instead of rewriting the extension.
- Preserve the fast popup-first UX while moving heavy CRUD and reporting into a dashboard page.
- Centralize all extension state mutations in the background service worker.
- Support import/export, aliases, groups, URL rules, reminders, and better profile management.
- Add a reproducible local build and CI pipeline.

## Constraints That Shaped The Plan

- `chrome.commands` is static, so profile shortcuts cannot be created dynamically per user.
- `chrome.storage.sync` has quota limits, so large collections cannot safely live there.
- Attribution like `manual`, `profile`, `rule`, `bulk`, `undo`, and `import` cannot be inferred reliably from passive listeners alone.
- Google Drive sync requires OAuth manifest configuration and explicit user authorization, so it should not be treated as a “free” storage toggle.

## Architecture Direction

### Background Ownership

- `js/background.js` is the single owner of extension enable/disable operations.
- UI pages call the background through a message API instead of toggling extension state directly.
- Undo history, reminders, usage counters, and event history are updated from the same mutation path.

### Storage Split

- `chrome.storage.sync` stores lightweight settings and profile state.
- `chrome.storage.local` stores large or device-specific collections like aliases, groups, URL rules, undo state, history, and usage counters.
- `js/migration.js` handles additive migrations and moves quota-sensitive data out of sync storage when needed.

### UI Surface Split

- Popup: fast browsing, toggling, sorting, filtering, undo, and applying profiles.
- Profiles page: profile rename, selection, layout, bulk delete, and editing profile membership.
- Dashboard: aliases, groups, URL rules, history, and import/export.
- Options page: layout, sorting, reminders, dashboard access, shortcut guidance, and backup controls.

## Public Contracts

### Background Message API

- `GET_STATE`
- `SET_EXTENSION_STATE`
- `TOGGLE_ALL`
- `APPLY_PROFILE`
- `UNDO_LAST`
- `SAVE_ALIAS`
- `SAVE_GROUPS`
- `SAVE_URL_RULES`
- `IMPORT_BACKUP`
- `EXPORT_BACKUP`
- `SYNC_DRIVE`
- `OPEN_DASHBOARD`

### Operation Context

Each state-changing action carries context shaped like:

```js
{
  source: "manual" | "profile" | "rule" | "bulk" | "undo" | "import" | "sync",
  profileId: string | undefined,
  ruleId: string | undefined
}
```

### Backup Envelope

Import/export and future cloud backup share one payload:

```js
{
  version: "2.0.0",
  exportedAt: number,
  settings,
  profiles,
  aliases,
  groups,
  groupOrder,
  urlRules,
  localState
}
```

## Planned Phases

### Phase 1: Foundation

- Add local build tooling through `package.json`.
- Add `js/storage.js`.
- Move service worker responsibility to `js/background.js`.
- Refactor `js/migration.js` into a utility-style migration module.

### Phase 2: State Ownership And Migration

- Route all extension toggles through the background service worker.
- Add migration defaults for the 2.0 storage model.
- Keep profiles sync-aware while moving larger collections to local storage.

### Phase 3: Popup Core UX

- Increase popup width.
- Add list/grid view.
- Add alpha/popular/recent sorting.
- Add alias display, always-on badge, high contrast mode, keyboard navigation, and undo.

### Phase 4: Profiles And Options

- Add profile rename.
- Add multi-select and bulk delete.
- Add profile layout selection.
- Add options for view, sort, reminders, dashboard access, and shortcut guidance.

### Phase 5: Dashboard And Data Tools

- Add `dashboard.html`.
- Add aliases CRUD.
- Add groups CRUD.
- Add JSON import/export and CSV export.

### Phase 6: URL Rules, History, And Reminders

- Evaluate URL rules in the background.
- Log attributed history records from the central mutation path.
- Schedule reminders for manual enable flows and cancel them on state reversal.

### Phase 7: Drive Backup

- Keep the API boundary in place, but defer full implementation until OAuth configuration is ready.

## Definition Of Done

- `make dist` builds a packaged extension locally.
- CI validates the manifest, runs unit tests, and builds the distribution artifact.
- The repo can generate a Chrome Web Store submission bundle.
- The popup, options page, profiles page, and dashboard share one consistent state model through the background service worker.
