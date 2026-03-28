# Extensity 2.0 Status

## What Was Implemented

### Foundation And Build

- Added `package.json` and `package-lock.json` with local `sass` and `uglify-js` dev dependencies.
- Updated `Makefile` to use project-managed tools and package `dashboard.html`.
- Updated `BUILD.md` and root `README.md` to match the current build and packaging flow.

### Manifest And Background

- Upgraded `manifest.json` to `2.0.0`.
- Switched the MV3 service worker to `js/background.js`.
- Added permissions for `alarms`, `contextMenus`, `management`, `notifications`, `storage`, `tabs`, and `webNavigation`.
- Added static commands for toggle-all and profile cycling.

### Storage And Migration

- Added `js/storage.js` for promise-based storage access and sync/local defaults.
- Reworked `js/migration.js` to handle legacy migration plus additive 2.0 storage migration.
- Moved quota-sensitive feature data to local storage.

### Popup

- Added popup list/grid mode.
- Added alpha, popularity, and recent-use sorting.
- Added alias-aware searching.
- Added always-on badges and high-contrast styling.
- Added keyboard navigation and undo support.

### Profiles And Options

- Added profile rename on the profiles page.
- Added selection and bulk delete for profiles.
- Added profile layout mode selection.
- Added options for view mode, sort mode, contrast mode, reminders, dashboard access, and shortcut guidance.

### Dashboard And Data Tools

- Added `dashboard.html`, `js/dashboard.js`, and `styles/dashboard.css`.
- Added aliases editing.
- Added groups editing and membership assignment.
- Added URL rules editing.
- Added event history view.
- Added JSON import/export and CSV export.

### Automation Features

- Added URL rule matching logic in `js/url-rules.js`.
- Added history creation and capping logic in `js/history-logger.js`.
- Added reminder queue and alarm helpers in `js/reminders.js`.
- Added a Drive sync boundary in `js/drive-sync.js`.

### CI And Release Automation

- Added `.github/workflows/ci.yml`.
- Added `.github/workflows/chrome-web-store-bundle.yml`.
- Added `scripts/validate-manifest.js`.
- Added `scripts/create-chrome-store-bundle.js`.
- Added unit tests for pure modules under `tests/`.

## What Changed From The Original Idea

- URL rules are evaluated in the background with `tabs` and `webNavigation` instead of a blanket content script.
- Dynamic “user-configurable profile shortcuts” were replaced by static Chrome commands plus shortcut guidance.
- Large state is not forced into `chrome.storage.sync`.
- Drive sync is scaffolded but not fully enabled, because OAuth configuration is still missing.

## What Is Still Deferred

### Full Google Drive Backup

- The current code exposes the interface and guard rails, but it does not yet provide a working OAuth-backed upload/download implementation.

### Browser-Level Validation

- Unit tests cover pure logic.
- Build validation covers manifest and packaging.
- Manual browser validation is still needed for:
  - popup interaction and visual layout
  - Chrome command behavior
  - real alarm/notification flows
  - live URL-rule behavior across tabs and SPA navigation
  - extension management permission behavior in Chrome itself

## Current Risk Notes

- The branch changed a large surface area at once, so end-to-end manual testing in Chrome is still important.
- The build and packaging flows are verified locally and in GitHub Actions, but that is not a substitute for loading the unpacked extension and exercising the UI.
