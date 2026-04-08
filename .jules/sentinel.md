## 2024-04-08 - Cryptographically Secure PRNG for IDs
**Vulnerability:** Weak pseudo-random number generator (`Math.random()`) used for generating IDs (e.g., in `makeId` for profiles, URLs, groups)
**Learning:** `Math.random()` provides predictable outputs which is insufficient for security-related elements or where collision resistance is important, though often used for basic ID generation.
**Prevention:** Use `crypto.getRandomValues` to provide a cryptographically secure random number when available. Keep a fallback for older environments if needed.
