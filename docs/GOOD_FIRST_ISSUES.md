# Good first issues

Starter issues for truck-dispatch-toolkit. Each one is self contained,
with a clear finish line: code, tests, docs. Read CONTRIBUTING.md
before starting, and claim an issue by commenting on it.

## 1. Full IFTA quarterly rate tables as data

* **Scope:** Add `src/data/ifta-rates/` with one JSON file per quarter
  (for example `2025-q1.json`) covering all IFTA jurisdictions, sourced
  from the official IFTA rate matrix, plus a `loadRates(quarter)`
  helper in `src/ifta.js`. Keep `DEFAULT_RATES` as the offline fallback.
* **Tests:** loader returns an object for a known quarter, throws a
  clear error for a missing quarter, and spot checks three states
  against the source file.
* **Size:** medium. Mostly careful data entry plus a small loader.

## 2. Canadian hours-of-service module

* **Scope:** New `src/hos-ca.js` implementing the Canadian federal
  rules: 13 hours driving, 14 hours on duty, 16 hour elapsed window,
  70/7 and 120/14 cycles, and the daily off-duty requirement. Same
  return shape as `planTrip` so the CLI can offer `--canada`.
* **Tests:** feasible and infeasible trips for both cycle options, a
  break and rest edge case, all numbers computed by hand first.
* **Size:** medium. The rules are documented by the CCMTA; mirror the
  structure of `src/hos.js`.

## 3. Metric unit support (km and litres)

* **Scope:** Optional `units: 'metric'` on `trueRate`, `loadProfit`,
  and the IFTA functions: distances in kilometres, fuel in litres,
  results labelled accordingly. Imperial stays the default and no
  existing return value changes.
* **Tests:** the existing worked examples converted to metric produce
  the same economics within rounding, and invalid unit strings throw.
* **Size:** medium. Conversion belongs at the edges, not in the math.

## 4. Spanish translation of the checklists

* **Scope:** Translate the three files in `docs/checklists/` into
  Spanish under `docs/checklists/es/`, keeping checkbox structure and
  regulation references (CFR numbers do not translate). A bilingual
  reviewer should check trucking terms (rate con, detention, lumper)
  against common U.S. Spanish usage in the industry.
* **Tests:** none (docs), but keep filenames identical to the English
  versions so links are predictable.
* **Size:** small to medium. Translation quality matters more than speed.

## 5. Deadhead optimizer helper (two-load chain comparison)

* **Scope:** New `chainCompare` in `src/rates.js`: given load A alone
  versus a chain of loads A then B (each with linehaul, loaded miles,
  and the deadhead between them and after), return both scenarios'
  all-miles RPM and total revenue, and which one wins per day using
  each load's transit days.
* **Tests:** a chain that wins on RPM but loses on revenue per day, a
  chain that wins outright, and rejection of negative inputs.
* **Size:** medium. The interesting part is the per-day comparison.

## 6. Static web demo page for the calculators

* **Scope:** A single dependency-free HTML page in `docs/demo/` that
  loads `src/*.js` (they are environment-agnostic CommonJS; use a tiny
  module shim) and wires the rate, profit, and detention calculators
  to forms. No build step, no frameworks, works from a file:// open
  or any static host.
* **Tests:** manual checklist in the PR (each calculator reproduces
  the CLI example output from the README), plus the Node test suite
  must still pass untouched.
* **Size:** medium. Keep the design clean and printable.

## 7. GitHub Pages live demo

* **Scope:** Once issue 6 (the static demo page in `docs/demo/`)
  exists, publish it with GitHub Pages from the `docs/` folder and
  link it from the README. Verify every calculator on the live page
  against the CLI examples, including the new lane, broker, fuel,
  check-call, and accessorial tools where the page supports them.
* **Tests:** manual checklist in the PR: each live calculator
  reproduces the README example output, and the page loads with no
  console errors from a cold cache.
* **Size:** small. Mostly settings, a link, and careful checking.
  Depends on issue 6.

## 8. CSV import for the lane book

* **Scope:** A `lane-import` CLI command (and a `fromCSV` helper in
  `src/lanes.js`) that reads a spreadsheet export of booked loads
  with header columns origin, dest, equipment, linehaul, miles, and
  date, and appends them to a lane book JSON file. Bad rows are
  reported with line numbers, not silently skipped.
* **Tests:** a small fixture CSV imports with exact RPMs, a row with
  a missing miles value is rejected and reported, and the imported
  book produces the same `laneStats` as the same loads added by hand.
* **Size:** medium. CSV parsing stays dependency-free; quoted fields
  with commas are the interesting edge.

## 9. Per-state fuel price table as data

* **Scope:** Mirror the IFTA data approach for fuel prices: add
  `src/data/fuel-prices/` with dated JSON snapshots of average
  diesel prices by state (sourced from published EIA weekly data,
  with the source and date recorded in each file), plus a loader in
  `src/fuel.js` so `priceCompare` and `planFuel` can pull a state's
  price by name. Snapshots are history, clearly labelled as not live
  prices.
* **Tests:** loader returns a price for a known state and snapshot,
  throws a clear error for a missing snapshot, and a price pulled
  from the table feeds `priceCompare` unchanged.
* **Size:** medium. Careful data entry plus a small loader, same
  shape as issue 1.

---

Finished one? Open the pull request with the test output pasted in.
Welcome aboard.
