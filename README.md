# Extensity Plus

Extensity Plus is a Chrome Manifest V3 extension for managing installed browser extensions and Chrome apps from a fast popup UI.

This branch upgrades the project toward a 2.0 architecture while keeping the original Extensity strengths:

- fast popup-first workflows
- simple Knockout.js architecture
- low-friction enable/disable actions
- profile-based extension management

## What It Can Do

### Popup Controls

- Enable or disable extensions from the popup.
- Toggle all extensions off and restore them with one action.
- Undo the last reversible toggle action.
- Search by extension name, alias, or description.
- Switch between list view and grid view.
- Sort extensions alphabetically, by recent use, or by toggle frequency.
- Show Always On badges and group badges directly in the popup.
- Navigate the popup with the keyboard.

### Profiles

- Save extension sets as profiles.
- Apply profiles from the popup.
- Keep Always On and Favorites as reserved profile concepts.
- Rename profiles inline.
- Select multiple profiles and bulk delete them.
- Choose the layout used on the profiles page.
- Cycle profiles with static Chrome commands.

### Dashboard

- Manage aliases for installed extensions.
- Create and edit groups.
- Create and edit URL rules.
- Review extension event history.
- Import and export backup data.
- Export the current extension inventory as CSV.

### Data And Automation

- Save lightweight preferences in `chrome.storage.sync`.
- Save large and device-specific state in `chrome.storage.local`.
- Track toggle history and usage counters.
- Schedule reminder notifications after manual enable flows.
- Apply URL-based enable/disable rules in the background service worker.
- Export and import a full versioned backup envelope.

### Build And Release

- Build the extension locally with project-managed tooling.
- Validate the manifest with a dedicated script.
- Run unit tests for pure browser modules.
- Package `dist/dist.zip` for distribution.
- Generate a Chrome Web Store submission bundle with metadata and checksums.
- Run CI and artifact packaging in GitHub Actions.

## 2.0 Architecture

The 2.0 branch moves extension state ownership into the background service worker.

Key design decisions:

- `js/background.js` is the single owner of extension enable/disable mutations.
- Popup, options, profiles, and dashboard pages communicate through a background message API.
- Undo history, reminders, usage counters, and event history are updated from the same mutation path.
- Large collections such as aliases, groups, rules, and history are kept out of `chrome.storage.sync` to avoid sync quota issues.

Main surfaces:

- `index.html`: popup
- `options.html`: options page
- `profiles.html`: profile editor
- `dashboard.html`: management dashboard

Supporting modules:

- `js/storage.js`
- `js/migration.js`
- `js/import-export.js`
- `js/url-rules.js`
- `js/history-logger.js`
- `js/reminders.js`
- `js/drive-sync.js`

## Current 2.0 Updates

Implemented in the current branch:

- MV3 service-worker-owned state pipeline
- popup list/grid view
- alpha / popular / recent sorting
- alias-aware search
- Always On badges
- high contrast mode
- popup undo
- profile rename and bulk delete
- dashboard for aliases, groups, URL rules, history, and import/export
- JSON backup/restore
- CSV export
- reminder scheduling helpers
- background URL rule evaluation
- GitHub Actions CI
- Chrome Web Store bundle generation

Deferred or partial:

- full Google Drive backup is not enabled yet because OAuth configuration is still missing
- browser-level manual validation is still required for popup flows, Chrome commands, reminders, URL rules, and live extension management behavior

## Commands And Workflow

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Validate the manifest:

```bash
npm run check:manifest
```

Build the extension:

```bash
make dist
```

Generate the Chrome Web Store submission bundle:

```bash
npm run bundle:chrome-store
```

Artifacts:

- `dist/dist.zip`
- `artifacts/chrome-web-store/`

## GitHub Actions

This repository includes:

- `.github/workflows/ci.yml`
  - runs tests
  - validates the manifest
  - builds the extension
  - creates and uploads distribution artifacts

- `.github/workflows/chrome-web-store-bundle.yml`
  - runs on manual dispatch and version tags
  - packages the Chrome Web Store submission bundle
  - uploads the release-ready artifact

## Documentation

Additional project documentation lives in `docs/`:

- `docs/extensity-2.0-plan.md`
- `docs/extensity-2.0-status.md`
- `docs/ci-and-release.md`

## Credits And Inspiration

This project is based on the original Extensity work by Sergio Kas and the broader Extensity open-source lineage.

The 2.0 planning and feature direction in this repo also drew inspiration from the following projects:

- [hankxdev/one-click-extensions-manager](https://github.com/hankxdev/one-click-extensions-manager)
- [JasonGrass/auto-extension-manager](https://github.com/JasonGrass/auto-extension-manager)
- [jeevan-lal/Extensity-Ultra](https://github.com/jeevan-lal/Extensity-Ultra)

Those repos helped inform ideas around popup management, URL-triggered behavior, and expanded extension-management UX.

## Notes

- This repo is a local evolution of the Extensity concept, not the original upstream release branch.
- If you plan to publish this fork to the Chrome Web Store, review permissions, listing content, privacy disclosures, and OAuth requirements before submission.
