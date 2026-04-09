
## 2024-04-09 - Accessible Icon-Only Header Links
**Learning:** In Knockout.js templates, adding `aria-hidden="true"` to inner `<i>` tags (like FontAwesome icons) does not interfere with the outer `<a>` or `<button>` data-bindings (e.g. `data-sbind`). The `aria-label` must be placed on the interactive container for screen readers to properly announce the action, rather than relying solely on `title` tooltips.
**Action:** When updating icon-only links across all HTML entrypoints, ensure `aria-label` is on the wrapping `<a>` or `<button>`, and `aria-hidden="true"` is on the inner `<i>`, without removing `title` for sighted users.
