## 2024-11-20 - Reverse Tabnabbing Vulnerability
**Vulnerability:** External link `target="_blank"` without `rel="noopener noreferrer"` attribute.
**Learning:** Found a missing `rel="noopener noreferrer"` attribute in an external link that opened a new tab `target="_blank"` in the index page. This opens the site up to a reverse tabnabbing vulnerability where a malicious external site could rewrite `window.opener.location` of the original site (the Chrome extension).
**Prevention:** Always use `rel="noopener noreferrer"` for any `target="_blank"` link pointing to an external domain.
