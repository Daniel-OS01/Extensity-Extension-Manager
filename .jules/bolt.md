## 2024-05-24 - Deduplication Array Filter Objects

**Learning:** When using plain objects `{}` to deduplicate array values by keys (`seen[item]`), it not only incurs the overhead of callback functions inside `.filter()` but is also susceptible to prototype collision (e.g. `__proto__` or `constructor` strings) which can create bugs or silent data drops in deduplication logic.
**Action:** Always prefer ES6 `Set` with a standard `for` loop for `uniqueArray`-like operations to guarantee type distinction (1 vs '1'), prevent prototype issues, and gain significant iteration performance boosts.
## 2024-05-24 - Observable Evaluation in Loops

**Learning:** Knockout observables like `self.profiles.items()` will be redundantly evaluated on every iteration if called inside a loop, multiplying the observable resolution overhead by `N`. Furthermore, chaining `.filter().map()` inside such loops compounds the issue by repeatedly allocating intermediate arrays.
**Action:** Always cache Knockout observables outside of loops in performance-sensitive logic, and consolidate `.filter().map()` chains into a single `for` loop pass when iterating repeatedly to avoid excessive GC thrashing and redundant computations.
