## 2026-04-10 - Reverse Tabnabbing via target=_blank
**Vulnerability:** External links using `target="_blank"` in the options and index pages lacked the `rel="noopener noreferrer"` attribute.
**Learning:** This exposes the application to reverse tabnabbing, where a potentially malicious newly-opened tab can access the original window's `window.opener` object and maliciously navigate it. Although modern browsers default to `noopener`, explicit declarations provide defense-in-depth for older environments.
**Prevention:** Always append `rel="noopener noreferrer"` when adding `target="_blank"` external links.
