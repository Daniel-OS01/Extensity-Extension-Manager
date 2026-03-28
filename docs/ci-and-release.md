# CI And Release

## Local Commands

### Install Dependencies

```bash
npm install
```

### Run Automated Checks

```bash
npm test
npm run check:manifest
```

### Build The Extension

```bash
make dist
```

This writes the packaged extension ZIP to `dist/dist.zip`.

### Build The Chrome Web Store Submission Bundle

```bash
npm run bundle:chrome-store
```

This creates `artifacts/chrome-web-store/` with:

- the extension ZIP renamed for release use
- a manifest snapshot
- submission metadata
- SHA-256 checksums
- release notes for the submission package

## GitHub Actions

### CI Workflow

File: `.github/workflows/ci.yml`

Runs on push and pull request.

Steps:

- install dependencies with `npm ci`
- run unit tests
- validate the manifest contract
- build the extension with `make dist`
- build the Chrome Web Store submission bundle
- upload both the distribution ZIP and the submission bundle as artifacts

### Chrome Web Store Bundle Workflow

File: `.github/workflows/chrome-web-store-bundle.yml`

Runs on:

- manual dispatch
- version tags matching `v*`

Steps:

- install dependencies
- run tests
- validate the manifest
- build the extension
- generate the submission bundle
- upload the bundle with the current manifest version in the artifact name

## What The Submission Bundle Solves

The workflow does not publish directly to the Chrome Web Store. It creates the files needed for a clean upload package and release handoff.

That means:

- packaging is reproducible
- the upload ZIP is versioned and checksummed
- GitHub Actions stores the release artifact
- the repo has a machine-readable record of what was packaged

## Manual Release Tasks Still Required

- upload the extension ZIP in the Chrome Web Store dashboard
- update listing copy, screenshots, privacy disclosures, and distribution settings
- review permissions and manifest changes before submission
- complete any publisher-account-specific signing or verification requirements

## Recommended Manual Test Pass Before Release

- load the unpacked extension in Chrome
- open the popup and verify list/grid mode, sort mode, alias display, and undo
- edit profiles and confirm rename, selection, and bulk delete behavior
- open the dashboard and verify aliases, groups, URL rules, import/export, and history
- validate reminder alarms and notifications
- validate keyboard shortcuts from `chrome://extensions/shortcuts`
- build and inspect the generated `dist/dist.zip` and `artifacts/chrome-web-store/`
