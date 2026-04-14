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

---

## Round 1 — UI Polish And Dark Mode

Applied after initial 2.0 launch. Addressed visual regressions and added polish across all pages.

### Popup (`index.html`, `styles/index.css`)

- Replaced sidebar layout with horizontal pill strip for profiles above the extension list.
- Widened popup from 320px to a CSS-variable-controlled `var(--popup-width, 380px)`.
- Added `ProfileModel.isActive` observable set imperatively in `applyState` so the active profile pill is highlighted without N² reactive dependencies.
- Added profile badge display inside each extension row (right side, `.item-actions` area). Each badge shows the short profile name with a thick left border in one of 5 rotating colors (`profile-color-0` through `profile-color-4`).
- Profile badge computation builds a `profileMap` in `applyState`: extension ID → array of `{name, colorClass}` objects. Skips reserved profiles (`__always_on`, `__favorites`).
- Added `ExtensionModel.profileBadges` observable array to `js/engine.js`.

### Dark Mode — Header And Toolbar

- Introduced CSS variables `--header-bg`, `--btn-bg`, `--input-bg` in `styles/index.css`.
- Light defaults: semi-transparent white values.
- Dark mode overrides: dark navy/slate values (`#1c2540`, `rgba(30,45,70,0.85)`, `rgba(26,34,52,0.95)`).
- Applied `var(--header-bg)` to `#header`, sort toolbar, and search bar — eliminating the hardcoded `rgba(255,255,255,...)` values that caused a white header in dark mode.

### CSS Custom Property Theming

- Added reactive `ko.computed` in `js/index.js` that sets `--font-size`, `--item-padding-v`, `--item-spacing`, `--popup-width` whenever options change.
- Extension items use `padding: var(--item-padding-v, 10px) 12px` and `margin-bottom: var(--item-spacing, 8px)`.
- Body uses `font-size: var(--font-size, 12px)` and `width: var(--popup-width, 380px)`.

---

## Round 2 — Appearance Controls And Layout Fixes

Applied after Round 1 user review. Three specific problems were fixed.

### Appearance Replaced String Enums With Pixel Values

**`js/storage.js`**

Removed:
- `fontSize: "normal"`
- `spacingScale: "normal"`

Added:
- `fontSizePx: 12`
- `itemPaddingPx: 10`
- `itemSpacingPx: 8`
- `popupWidthPx: 380`

Because `OptionsCollection` auto-derives observables from `syncDefaults`, these keys are immediately usable as `options.fontSizePx`, `options.itemPaddingPx`, etc. in all page bindings.

**`options.html`**

Replaced the Appearance card's two `<select>` dropdowns (`spacingScale`, `fontSize`) with four `<input type="number">` fields for `fontSizePx`, `itemPaddingPx`, `itemSpacingPx`, and `popupWidthPx`.

**`js/options.js`**

Removed `applyPreset` dispatch method. Replaced three wrapper functions with direct px-value setters:

- Compact: `fontSizePx(11)`, `itemPaddingPx(6)`, `itemSpacingPx(4)`
- Default: `fontSizePx(12)`, `itemPaddingPx(10)`, `itemSpacingPx(8)`
- Comfortable: `fontSizePx(13)`, `itemPaddingPx(14)`, `itemSpacingPx(12)`

Added `applyCssVars(options)` function and called it inside `applyState`.

**`js/dashboard.js`**

Removed stale class toggles (`spacing-compact`, `font-small`, etc.) from `applyThemeClasses`. Added `applyCssVars` function and call in `applyState`.

**`js/profiles.js`**

Removed stale class toggles from `bodyClass` computed. `applyCssVars` called on body class application.

### Extension Name Truncation Fixed

Removed `<div id="content-main">` sidebar wrapper from `index.html`. Extension list now spans full popup width. Profiles occupy a horizontal pill strip above extensions, not a 120px left column.

Removed from `styles/index.css`:
- `#content { display: flex }` sidebar container rule
- `#profiles { flex: 0 0 120px }` fixed narrow column rule
- `#content-main { flex: 1 1 0 }` right panel rule

---

## Round 3 — Dashboard Fix + Profiles Layout + Dark Mode Inputs (Pending)

These changes are planned but not yet implemented. See `.claude/plans/zazzy-hugging-pearl.md` for the full implementation spec.

### Bug: Dashboard tab buttons do not switch sections

**Root cause:** `visible: isTab('history')` in KSB does not reliably track the `activeTab` observable dependency when accessed through a plain function call expression. All sections appear visible simultaneously.

**Fix:** Replace `isTab()` call pattern with explicit `ko.pureComputed` booleans per tab (`historyTab`, `groupsTab`, `rulesTab`, `aliasesTab`, `dataTab`) and reference them directly in `visible:` and `css:{}` bindings.

**Files:** `js/dashboard.js`, `dashboard.html`

### Bug: Options page inputs and selects have white background in dark mode

**Root cause:** `input[type="text"], input[type="number"], select` in `styles/options.css` use hardcoded `background: #fff`. No dark mode override exists.

**Fix:** Change to `background: var(--panel)` which resolves to `#ffffff` in light mode and `#1a2234` in dark mode. Also fix `#menu a` white pill background to use `var(--accent-soft)` in dark mode.

**Files:** `styles/options.css`

### Bug: Dashboard section headings and grid cards have hardcoded light-mode colors

**Root cause:** `dashboard.css` uses `color: #365f92`, `color: #5e6c7d`, `background: #f7f9fc`, `border: 1px solid #d2dcea` hardcoded.

**Fix:** Replace with `var(--accent)`, `var(--muted)`, `var(--surface)`, `var(--border)`.

**Files:** `styles/dashboard.css`

### Feature: Allow item padding to be set to 0

**Fix:** Change `min="2"` to `min="0"` on the `itemPaddingPx` input in `options.html`.

**Files:** `options.html`

### Feature: Profiles page layout — extensions left, profile management right

The current layout has the profile list (sidebar) on the left and the extension checklist on the right. User requested swap: extension list on left, profile management on right.

**Fix:** Swap `.sidebar` and `.extensions` divs in `profiles.html`. Update CSS grid column sizes in `styles/options.css` from `minmax(260px, 320px) minmax(0, 1fr)` to `minmax(0, 1fr) minmax(260px, 320px)`.

**Files:** `profiles.html`, `styles/options.css`

### Feature: Sort options for extension list on profiles page

Add sort controls (A-Z, Popular, Recent, Profiles) above the extension checklist. A `sortedExtensions` pureComputed sorts `ext.extensions()` by the selected mode. A `profileCountMap` observable tracks how many profiles each extension belongs to, enabling "Profiles" sort.

**Files:** `js/profiles.js`, `profiles.html`

---

## What Changed From The Original Idea

- URL rules are evaluated in the background with `tabs` and `webNavigation` instead of a blanket content script.
- Dynamic "user-configurable profile shortcuts" were replaced by static Chrome commands plus shortcut guidance.
- Large state is not forced into `chrome.storage.sync`.
- Drive sync is scaffolded but not fully enabled because OAuth configuration is still missing.
- String-enum appearance options (`fontSize`, `spacingScale`) were replaced with numeric pixel values to give users direct control.
- Sidebar layout in the popup was removed to prevent extension name truncation.

## What Is Still Deferred

### Full Google Drive Backup

The current code exposes the interface and guard rails, but it does not provide a working OAuth-backed upload/download implementation.

### Browser-Level Validation

Unit tests cover pure logic. Build validation covers manifest and packaging. Manual browser validation is still needed for:

- popup interaction and visual layout
- Chrome command behavior
- real alarm/notification flows
- live URL-rule behavior across tabs and SPA navigation
- extension management permission behavior in Chrome itself

## Current Risk Notes

- The branch changed a large surface area across multiple rounds. End-to-end manual testing in Chrome is required before release.
- The build and packaging flows are verified locally and in GitHub Actions, but that is not a substitute for loading the unpacked extension and exercising all UI surfaces.
- Round 3 changes (dashboard tab fix, profiles layout, dark mode inputs) are not yet implemented and should be treated as open bugs until merged.
