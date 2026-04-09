## 2024-05-24 - Deduplication Array Filter Objects

**Learning:** When using plain objects `{}` to deduplicate array values by keys (`seen[item]`), it not only incurs the overhead of callback functions inside `.filter()` but is also susceptible to prototype collision (e.g. `__proto__` or `constructor` strings) which can create bugs or silent data drops in deduplication logic.
**Action:** Always prefer ES6 `Set` with a standard `for` loop for `uniqueArray`-like operations to guarantee type distinction (1 vs '1'), prevent prototype issues, and gain significant iteration performance boosts.
## 2024-05-24 - Single Pass Array Transformations

**Learning:** This codebase frequently performs chained `.filter(Boolean).map(...)` or multiple passes like `.filter(...).map(...)` across large sets of extensions. Creating and filtering garbage intermediate arrays degrades performance.
**Action:** Replace `Array.prototype.filter().map()` chains with a single `for` loop that pushes valid elements into a new array. This eliminates intermediate allocations and runs significantly faster in this Node context (as shown by my local benchmarks).
