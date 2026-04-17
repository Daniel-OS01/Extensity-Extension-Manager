## 2024-05-24 - Deduplication Array Filter Objects

**Learning:** When using plain objects `{}` to deduplicate array values by keys (`seen[item]`), it not only incurs the overhead of callback functions inside `.filter()` but is also susceptible to prototype collision (e.g. `__proto__` or `constructor` strings) which can create bugs or silent data drops in deduplication logic.
**Action:** Always prefer ES6 `Set` with a standard `for` loop for `uniqueArray`-like operations to guarantee type distinction (1 vs '1'), prevent prototype issues, and gain significant iteration performance boosts.
## 2024-05-24 - String Processing Overheads

**Learning:** Chaining array methods like `.split().map().filter()[0]` on strings (e.g. for extracting the first non-empty line) creates intermediate array allocations and processes every element, even if the target is found immediately. In performance-sensitive UI operations (like formatting hundreds of extension descriptions), this causes unnecessary garbage collection and execution overhead.
**Action:** Replace chained `.map().filter()[0]` operations on large string splits with standard `for` loops to prevent array allocations and enable early `return` short-circuiting.
