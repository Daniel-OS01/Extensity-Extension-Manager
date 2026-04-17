## 2024-04-17 - Add `aria-hidden="true"` to FontAwesome icons and `aria-label` to icon-only buttons
**Learning:** Icon-only action links and purely decorative icons (like FontAwesome `<i class="fa ...">`) need proper accessibility attributes. Screen readers may read out the icon's unicode or CSS class if not hidden.
**Action:** When adding or fixing icons, always include `aria-hidden="true"` on the purely decorative `<i>` tags, and ensure the interactive wrapper (like `<button>` or `<a>`) has an explicit `aria-label` or `title` acting as an accessible name if there's no visible text.
