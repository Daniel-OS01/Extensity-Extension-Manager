# Extensity Plus Improvement Roadmap

This file is a backlog of candidate improvements for Extensity Plus after the current Round 3 fix set. It is intentionally broader than an implementation plan and should be read as a decision-support document for follow-up work, not as a statement that these features already exist.

Each idea below is future-looking. The purpose is to capture concrete user-facing improvements, the repo areas they would likely touch, and the tradeoffs worth considering before anyone writes code.

## How to Read This Doc

- `Idea`: The feature or refinement being proposed.
- `Problem`: The user pain or product gap the idea is trying to solve.
- `Proposal`: The shape of the change, including likely implementation direction.
- `Why it matters`: The practical value if the idea ships.
- `Example`: A concrete scenario that shows how the idea would behave.
- `Likely touchpoints`: The files or modules that would probably carry most of the work.
- `Effort`: A rough implementation size estimate.
- `Priority`: A rough sequencing signal for planning, not a commitment.

## Planning Principles

- Preserve popup speed. The popup is the highest-frequency surface and should stay fast even for users with many installed extensions.
- Keep the background as state owner. UI pages can request and render state, but coordination logic should remain centralized in the existing background and storage layers.
- Avoid sync-storage bloat. Small preference flags are fine, but large derived datasets should stay computed or live in local storage if persistence is truly needed.
- Favor additive UI changes over architecture churn. Small focused controls are usually lower risk than broad rewrites of popup, dashboard, or profile flows.
- Keep MV3 and Knockout/KSB constraints visible. Proposed changes should fit the current extension runtime model instead of assuming a full framework migration.

## Popup UX

This section focuses on the popup because it is still the primary control surface for day-to-day extension toggling. The goal here is not to make the popup visually busier, but to let users choose between a cleaner compact layout and a more descriptive layout without slowing the interaction loop.

### 1. Flat Popup List Rows

- `Idea`: Add a popup appearance option that removes the rounded card or bubble around each extension row in list view.
- `Problem`: The current card treatment is visually distinct, but it uses a lot of vertical space and can feel heavy when the list is long.
- `Proposal`: Add a small sync option such as `flatPopupList`, expose it on the Options page, and apply a list-view-only body class in the popup so `styles/index.css` can switch from card rows to flat divider rows.
- `Why it matters`: This gives dense-list users a faster-scanning layout without forcing a redesign on users who like the current card styling.
- `Example`: In card mode, each row keeps its rounded border and hover lift. In flat mode, the same list becomes simple rows with bottom dividers and a subtle hover background while profile pills remain unchanged.
- `Likely touchpoints`: `options.html`, `js/options.js`, `js/storage.js`, `js/index.js`, `styles/index.css`, `styles/options.css`.
- `Effort`: Small.
- `Priority`: High.

### 2. Popup Density and Metadata Presets

- `Idea`: Offer appearance presets for compact rows versus expanded rows with extra metadata.
- `Problem`: Some users want the popup to show only icon, name, and toggle state, while others want aliases, usage hints, rule badges, or group markers visible at a glance.
- `Proposal`: Add one or two appearance presets instead of many independent switches. The compact preset would minimize row height and secondary text. The expanded preset would show optional metadata badges using existing extension metrics and labels.
- `Why it matters`: A preset model keeps the UI understandable while still letting the popup adapt to different working styles.
- `Example`: Compact mode shows one tight line per extension. Expanded mode adds small badges such as `alias`, `rule`, or `recent` below the title or aligned to the right side of the row.
- `Likely touchpoints`: `index.html`, `js/index.js`, `js/storage.js`, `styles/index.css`, `options.html`.
- `Effort`: Medium.
- `Priority`: Medium.

### 3. Better Empty, Loading, and Search States

- `Idea`: Replace generic empty states with explicit messages for loading, zero results, and filtered lists.
- `Problem`: The popup currently works best when there is data to render. Search misses, empty profiles, or temporary loading states can feel abrupt and do not always explain what the user should do next.
- `Proposal`: Add state-aware helper text and lightweight placeholder rows instead of blank space. Keep the messages small and action-oriented so they do not compete with the main list.
- `Why it matters`: Users understand whether the popup is still loading, whether their search is too narrow, or whether the active profile simply has no matching extensions.
- `Example`: Searching for `work vpn` with no matches would show `No extensions matched this search` plus a small `Clear search` action instead of an empty list.
- `Likely touchpoints`: `index.html`, `js/index.js`, `styles/index.css`.
- `Effort`: Small.
- `Priority`: Medium.

### 4. Keyboard-First Popup Navigation

- `Idea`: Expand keyboard support beyond current focus behavior and make the shortcuts discoverable inside the popup.
- `Problem`: Power users can already navigate some extension UIs with the keyboard, but the popup does not yet advertise a complete keyboard flow for search, movement, apply, or toggle actions.
- `Proposal`: Add slash-to-search, arrow navigation that is visually obvious, enter-to-toggle, escape-to-clear-search, and a small shortcut hint surface that can collapse after first use.
- `Why it matters`: Keyboard support reduces mouse travel and makes the popup more accessible for both expert users and users relying on keyboard navigation.
- `Example`: Pressing `/` focuses search, pressing down arrow highlights the next extension, pressing enter toggles it, and pressing `?` opens a compact shortcut legend.
- `Likely touchpoints`: `index.html`, `js/index.js`, `styles/index.css`.
- `Effort`: Medium.
- `Priority`: High.

## Profiles

This section covers the Profiles page because it is the most configuration-heavy surface and now carries more responsibility after the Round 3 layout and sorting work. The biggest gaps here are layout control, naming ergonomics, and clearer management flows when the profile list gets large.

### 5. In-Page Profiles Layout Switch

- `Idea`: Add a layout switch directly on the Profiles page for `Landscape` and `Portrait`.
- `Problem`: Layout currently depends on an option set elsewhere, which makes the Profiles page feel less self-sufficient than the popup and dashboard surfaces.
- `Proposal`: Reuse the existing `profileDisplay` option and expose two visible pill buttons near the top of `profiles.html`. The buttons should save only that option and then refresh the page state through the existing API path.
- `Why it matters`: Users can correct the layout immediately when the current orientation feels wrong, instead of leaving the page to find the setting in Options.
- `Example`: A user on a narrower screen flips from `Landscape` to `Portrait` directly inside the page and sees the profile management stack become easier to read without reopening anything.
- `Likely touchpoints`: `profiles.html`, `js/profiles.js`, `styles/options.css`, `js/storage.js`, `js/background.js`.
- `Effort`: Small.
- `Priority`: High.

### 6. RTL-Safe Profile Naming

- `Idea`: Make editable profile names handle RTL text correctly without flipping the rest of the layout.
- `Problem`: Users entering Hebrew or Arabic profile names can run into awkward caret behavior, mixed-direction punctuation issues, or visually confusing alignment when the page assumes LTR text everywhere.
- `Proposal`: Apply `dir="rtl"` only to the new-profile input, inline rename inputs, and the text wrapper for custom profile names in the sidebar. Reserved English labels should keep their current direction and alignment.
- `Why it matters`: This solves a real usability issue for multilingual users without turning the entire page into a bidi edge case.
- `Example`: Typing the name `עבודה - Dev` keeps the caret on the correct side, keeps Latin text readable inside the same value, and shows the saved profile label right-aligned in the sidebar.
- `Likely touchpoints`: `profiles.html`, `js/profiles.js`, `styles/options.css`.
- `Effort`: Small.
- `Priority`: High.

### 7. Favorites and Always On Management Polish

- `Idea`: Make `Favorites` and `Always On` easier to inspect, edit, and compare with normal profiles.
- `Problem`: Reserved profiles are useful, but they still feel like special cases instead of first-class management surfaces. Users often need to know which extensions are pinned permanently versus only used in a named profile.
- `Proposal`: Add clearer reserved-profile summaries, counts, and lightweight actions such as `show only missing`, `show overlap`, or `move selected to favorites`.
- `Why it matters`: Better reserved-profile management reduces accidental profile clutter and makes the mental model of persistent extensions easier to follow.
- `Example`: A user can open `Always On`, see `8 extensions`, then switch to `Favorites` and inspect which 3 items overlap without manually scanning the full list.
- `Likely touchpoints`: `profiles.html`, `js/profiles.js`, `styles/options.css`, `js/storage.js`.
- `Effort`: Medium.
- `Priority`: Medium.

### 8. Profile Diff Before Apply or Save

- `Idea`: Show a compact diff summary before applying a profile or saving a major edit.
- `Problem`: Profiles are powerful, but applying or overwriting them can feel opaque when a user does not remember exactly which extensions are about to change.
- `Proposal`: Build a lightweight diff helper that compares the target profile with the current enabled set and renders concise enable or disable summaries in the page or popup.
- `Why it matters`: A clear diff reduces hesitation and makes profiles feel safer to use for larger sets.
- `Example`: Before applying a profile, the UI could show `Enabling: VPN, React DevTools, Notion Web Clipper` and `Disabling: Grammarly, ColorZilla`.
- `Likely touchpoints`: `profiles.html`, `js/profiles.js`, `index.html`, `js/index.js`, `js/background.js`, `js/engine.js`.
- `Effort`: Medium.
- `Priority`: Medium.

## Dashboard & Data

This section targets the dashboard as the analysis and inspection surface for the extension. The intent is to make existing data more actionable rather than simply adding more numbers, with emphasis on history, rules, and small guidance layers that help users understand why the current state looks the way it does.

### 9. Richer History Presentation

- `Idea`: Expand the history tab from a simple chronological list into a filtered activity view with better labels and grouping.
- `Problem`: Basic history is useful for debugging, but it becomes harder to scan once a user has a mix of manual toggles, profile applies, reminder actions, and URL rule triggers.
- `Proposal`: Add event filters, source filters, grouped timestamps, and clearer event chips while keeping the default list simple.
- `Why it matters`: Users can answer practical questions such as `Why did this extension turn off?` without reading raw rows one by one.
- `Example`: A user filters history to `rule` events only and immediately sees that a URL rule disabled an extension at `09:14`, rather than assuming it was toggled manually.
- `Likely touchpoints`: `dashboard.html`, `js/dashboard.js`, `styles/dashboard.css`, `js/history-logger.js`, `js/background.js`.
- `Effort`: Medium.
- `Priority`: High.

### 10. Quick Profile Actions from History Rows

- `Idea`: Let users jump from a history event to a relevant profile action.
- `Problem`: History currently tells users what happened, but it does not help them act on that information. This forces context switching back to the popup or Profiles page.
- `Proposal`: Add contextual actions such as `Apply again`, `Create profile from this state`, or `Open related rule` when the history item includes enough metadata.
- `Why it matters`: The dashboard becomes a recovery and investigation tool, not just a passive log viewer.
- `Example`: After seeing a good `manual` session in history, a user clicks `Create profile from this state` and saves the exact extension set as `Client Call`.
- `Likely touchpoints`: `dashboard.html`, `js/dashboard.js`, `js/background.js`, `js/storage.js`, `profiles.html`, `js/profiles.js`.
- `Effort`: Medium.
- `Priority`: Medium.

### 11. Rule Conflict Inspection

- `Idea`: Add a rule analysis view that shows when multiple URL rules match the same URL and which one wins.
- `Problem`: URL rules are powerful, but precedence becomes hard to reason about once wildcard, regex, and later-rule ordering all interact.
- `Proposal`: Add a dashboard card or rule detail panel that computes overlapping matches, highlights later-rule precedence, and shows the resulting extension state change.
- `Why it matters`: This turns rule debugging from guesswork into a concrete inspection flow.
- `Example`: Entering `https://app.example.com/admin/settings` could show that both `*.example.com/*` and `/admin/` rules match, and that the later admin rule wins because it was defined last.
- `Likely touchpoints`: `dashboard.html`, `js/dashboard.js`, `js/url-rules.js`, `js/background.js`, `styles/dashboard.css`.
- `Effort`: Medium.
- `Priority`: High.

### 12. Trend Summaries and Empty-State Guidance

- `Idea`: Add summary cards that explain usage patterns and suggest next actions when dashboard sections are empty.
- `Problem`: A dashboard with low data volume can look unfinished even when the feature is technically working. Users also do not always know what counts as a meaningful signal in usage counters or history.
- `Proposal`: Add small summary cards such as `Most toggled this week`, `Most used profile`, or `No rules configured yet`, with links into the relevant setup surface.
- `Why it matters`: This improves first-run comprehension and gives the dashboard a stronger role even before a user has months of history.
- `Example`: If no aliases exist, the aliases tab can show `You have not named any extensions yet` plus a short one-line explanation of why aliases help in the popup.
- `Likely touchpoints`: `dashboard.html`, `js/dashboard.js`, `styles/dashboard.css`, `js/storage.js`.
- `Effort`: Small.
- `Priority`: Medium.

## Automation & Sync

This section covers the features that reduce repeated manual work. The repo already has relevant pieces for rules, reminders, backups, and Drive sync, so the next step is to make those features easier to trust, inspect, and recover from when something unexpected happens.

### 13. Import Preview and Restore Diff

- `Idea`: Show a structured preview before a backup restore changes live state.
- `Problem`: Import and restore flows are high-impact. Users need confidence that a backup file is valid and that restoring it will not silently overwrite profiles, aliases, rules, or reminder data they still care about.
- `Proposal`: Extend the import flow so parsed backups can be previewed before apply. The preview should summarize additions, replacements, and version compatibility warnings instead of dumping raw JSON.
- `Why it matters`: Restore operations become safer and easier to audit, especially when users manage multiple devices or keep several dated backups.
- `Example`: Importing a backup could show `Profiles added: 3`, `Profiles replaced: Work, Travel`, `Rules imported: 5`, and `Reminder queue entries: 2` before the final confirmation step.
- `Likely touchpoints`: `dashboard.html`, `js/dashboard.js`, `js/import-export.js`, `js/storage.js`, `js/background.js`.
- `Effort`: Medium.
- `Priority`: High.

### 14. Dry-Run URL Rule Matcher

- `Idea`: Add a dry-run tool that evaluates sample URLs against current rule definitions without changing extension state.
- `Problem`: Users can write a rule and save it, but they do not yet have an easy way to test how it behaves before it starts affecting real browsing.
- `Proposal`: Build a small rule tester that accepts a sample URL and returns match results, precedence, and the resulting extension actions. This should reuse the same matching logic as the live engine instead of duplicating it in the UI.
- `Why it matters`: Rule authoring becomes less risky and much faster to debug.
- `Example`: A user pastes `https://mail.google.com/mail/u/0/#inbox` into the tester and sees that the `mail` regex rule disables three extensions while a broader `google.com` wildcard rule would otherwise have enabled two.
- `Likely touchpoints`: `dashboard.html`, `js/dashboard.js`, `js/url-rules.js`, `js/background.js`, `styles/dashboard.css`.
- `Effort`: Medium.
- `Priority`: High.

### 15. Reminder Snooze and Quiet Hours

- `Idea`: Let users snooze reminder prompts or suppress them during configured quiet periods.
- `Problem`: Reminders are only useful if they are trusted. If a user cannot defer a reminder during a meeting or avoid reminder noise during certain hours, the feature becomes easier to dismiss than to use.
- `Proposal`: Add per-reminder snooze actions and an optional quiet-hours setting that pauses reminder surfacing without deleting queued reminder state.
- `Why it matters`: This makes reminders feel cooperative instead of intrusive.
- `Example`: A user sees `Re-enable Loom?` and chooses `Snooze 2 hours` instead of dismissing it forever. Another user configures quiet hours from `22:00` to `07:00` so reminder prompts stay out of the way overnight.
- `Likely touchpoints`: `js/reminders.js`, `js/background.js`, `js/storage.js`, `options.html`, `js/options.js`, `styles/options.css`, `dashboard.html`.
- `Effort`: Medium.
- `Priority`: Medium.

### 16. Drive Sync Health and Diagnostics

- `Idea`: Surface the state of Drive sync more clearly and explain failures in user terms.
- `Problem`: Sync features are only as trustworthy as their status reporting. Silent failures or vague errors make users assume their data is backed up when it might not be.
- `Proposal`: Add status fields such as last sync time, last successful sync result, pending changes, and the last error message with a retry action.
- `Why it matters`: Users can tell whether cross-device backup is healthy without digging through console logs or guessing.
- `Example`: A dashboard sync card could show `Last successful sync: 2026-03-28 09:42`, `Pending local changes: 1`, and `Last error: token expired`.
- `Likely touchpoints`: `js/drive-sync.js`, `js/background.js`, `js/storage.js`, `dashboard.html`, `js/dashboard.js`, `styles/dashboard.css`.
- `Effort`: Medium.
- `Priority`: Medium.

## Accessibility & Internationalization

This section focuses on usability improvements that benefit more than one audience at once. Better focus handling, stronger screen-reader affordances, and more careful direction or locale handling improve the experience for keyboard users, multilingual users, and anyone working under reduced attention or visual contrast.

### 17. Focus Ring Preview and Contrast-Safe Appearance Controls

- `Idea`: Add appearance controls and previews for focus rings, selected-row states, and contrast-sensitive tokens.
- `Problem`: Theme work often starts with backgrounds and borders, but keyboard focus and selected-state visibility are what determine whether the UI remains usable when colors get more customized.
- `Proposal`: Add a small preview strip in Options that shows how focus rings, selected tabs, and row hover states look under current appearance settings. Keep the implementation tied to existing CSS variables rather than ad hoc colors.
- `Why it matters`: Appearance customization becomes safer because users can see whether a theme remains usable before saving it.
- `Example`: A user lowers accent saturation and immediately sees in the preview that the focus ring is no longer distinct enough against the panel background.
- `Likely touchpoints`: `options.html`, `styles/options.css`, `js/options.js`, `styles/index.css`, `styles/dashboard.css`.
- `Effort`: Medium.
- `Priority`: Medium.

### 18. Keyboard-Only Flow Audit

- `Idea`: Make the main surfaces fully usable without a mouse and document the supported keyboard paths.
- `Problem`: Keyboard support is uneven across the popup, Profiles page, Options page, and Dashboard. Some controls are reachable, but the overall flow is not yet deliberate.
- `Proposal`: Audit tab order, visible focus states, button activation, escape behavior, and list navigation. Fill the gaps, then add a compact keyboard help note where it is most relevant.
- `Why it matters`: This improves accessibility and speed simultaneously.
- `Example`: A user should be able to open Profiles, create a new profile, rename it, select extensions, and save it using only tab, arrow, enter, and escape.
- `Likely touchpoints`: `index.html`, `profiles.html`, `options.html`, `dashboard.html`, `js/index.js`, `js/profiles.js`, `js/options.js`, `js/dashboard.js`, `styles/index.css`, `styles/options.css`, `styles/dashboard.css`.
- `Effort`: Medium.
- `Priority`: High.

### 19. Screen-Reader Labels and Live Announcements

- `Idea`: Improve semantics and live feedback for toggles, row actions, and state-changing flows.
- `Problem`: Visual iconography and hover affordances work for sighted mouse users, but state changes such as `extension disabled`, `profile applied`, or `rule saved` are not necessarily announced in a screen-reader-friendly way.
- `Proposal`: Add clearer labels, role usage, and a lightweight live-region pattern for major actions so status changes are communicated without forcing a page reload.
- `Why it matters`: Users relying on assistive technology can operate the extension with less ambiguity and lower error risk.
- `Example`: When a profile is applied, a live region could announce `Profile Work applied. 12 extensions enabled, 5 disabled`.
- `Likely touchpoints`: `index.html`, `profiles.html`, `dashboard.html`, `options.html`, `js/index.js`, `js/profiles.js`, `js/dashboard.js`, `styles/index.css`, `styles/options.css`.
- `Effort`: Medium.
- `Priority`: Medium.

### 20. Locale-Aware Formatting and Direction Handling

- `Idea`: Standardize how dates, times, counters, and text direction are formatted across pages.
- `Problem`: History timestamps, backup metadata, and mixed-direction text can feel inconsistent when some values are raw and some are formatted. Direction handling is also currently page-specific instead of deliberate.
- `Proposal`: Centralize locale-aware formatting helpers for dates and counts, and use field-level direction handling for content such as aliases or profile names that may be RTL while the surrounding UI remains LTR.
- `Why it matters`: The UI becomes easier to scan for international users and avoids ad hoc formatting differences between pages.
- `Example`: The dashboard could show a local date format for history rows while profile names such as `עבודה` remain directionally correct inside an otherwise English page.
- `Likely touchpoints`: `js/dashboard.js`, `js/profiles.js`, `js/index.js`, `profiles.html`, `dashboard.html`, `styles/options.css`, `styles/dashboard.css`.
- `Effort`: Small.
- `Priority`: Medium.

## Engineering Quality & Release

This section is about making UI work safer to ship. The extension already has some browser-module coverage, but the next gains are likely to come from smoke tests, visual checks, and better documentation discipline around what is implemented now versus what is merely planned.

### 21. Automated Browser Smoke Test Matrix

- `Idea`: Add a lightweight automated smoke suite for the popup, Options page, Profiles page, and Dashboard page.
- `Problem`: Manual verification currently catches many UI issues, but it does not scale well once more appearance modes, layout switches, and settings combinations are added.
- `Proposal`: Add a browser-level smoke matrix that loads the extension pages, verifies core interactions, and catches obvious regressions such as hidden sections not switching or controls not rendering after state changes.
- `Why it matters`: This covers the highest-risk user flows without requiring a full end-to-end rewrite of the test strategy.
- `Example`: A smoke run could verify that dashboard tabs switch one visible section at a time, that a profile sort button changes active state, and that popup list mode renders at least one extension row.
- `Likely touchpoints`: `tests/browser-modules.test.js`, browser automation scripts, `package.json`, `dashboard.html`, `profiles.html`, `index.html`, `options.html`.
- `Effort`: Large.
- `Priority`: High.

### 22. Visual Regression Screenshot Checklist

- `Idea`: Add a repeatable screenshot-based review step for major surfaces and core theme variants.
- `Problem`: Layout regressions and color-token regressions are easy to miss in diff-only reviews, especially when the affected change is mostly CSS or page markup.
- `Proposal`: Define a small screenshot matrix for popup list mode, popup grid mode, Options dark mode, Profiles landscape mode, Profiles portrait mode, and Dashboard dark mode. Keep it narrow enough that it is practical to run during UI-focused changes.
- `Why it matters`: Reviewers get a fast visual baseline, and subtle regressions stop depending entirely on memory.
- `Example`: A change to `styles/options.css` would automatically refresh screenshots showing the top nav pills, profile layout, and form controls in both light and dark surfaces.
- `Likely touchpoints`: screenshot tooling, CI scripts, `styles/index.css`, `styles/options.css`, `styles/dashboard.css`, page HTML fixtures.
- `Effort`: Medium.
- `Priority`: High.

### 23. Docs Hardening and Source-of-Truth Cleanup

- `Idea`: Tighten the relationship between code state, docs, and plan files so stale planning notes do not linger as if they were still current.
- `Problem`: The repo already has both long-term docs and `.claude/plans` artifacts. Without deliberate cleanup, old pending sections can contradict implemented behavior and confuse future planning.
- `Proposal`: Treat `.claude/plans` as working plans, `docs/` as durable project docs, and add a simple review pass whenever a round lands so pending language is either removed or clearly marked historical.
- `Why it matters`: Cleaner documentation reduces planning drift and helps future contributors understand what is actually live.
- `Example`: When a round is completed, `docs/extensity-2.0-status.md` would move that round to implemented state and any follow-up requests would be recorded as new planned ideas instead of appended to stale sections.
- `Likely touchpoints`: `docs/README.md`, `docs/extensity-2.0-status.md`, `docs/extensity-2.0-plan.md`, `.claude/plans/*.md`.
- `Effort`: Small.
- `Priority`: Medium.

### 24. State Contract Tests for Storage, Migration, and Import or Export

- `Idea`: Add broader contract tests for persisted state so new preference flags and backup fields stay compatible over time.
- `Problem`: UI improvements often need one or two new settings, and those settings can quietly drift across storage defaults, migrations, import or export envelopes, and background reads if they are not tested together.
- `Proposal`: Expand tests around storage defaults, migration paths, and backup validation so each new persisted field has an explicit compatibility expectation.
- `Why it matters`: This reduces the risk of shipping a UI control that appears to save correctly but is dropped by backup, ignored by migration, or read inconsistently across pages.
- `Example`: If a new `flatPopupList` option is added later, tests should verify it appears in sync defaults, survives migration, and is either included in or intentionally excluded from exported backups.
- `Likely touchpoints`: `js/storage.js`, `js/migration.js`, `js/import-export.js`, `js/background.js`, `tests/browser-modules.test.js`.
- `Effort`: Medium.
- `Priority`: High.

## Notes for Future Planning

This roadmap intentionally mixes quick wins with medium-scope UX improvements and a smaller number of larger quality investments. The next implementation plan should pick a narrow slice from this document, define acceptance criteria, and verify the relevant module boundaries before any code changes begin.
