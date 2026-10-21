# Changelog

All notable changes to truck-dispatch-toolkit are recorded here.
This project follows semantic versioning.

## 1.0.0 (2026-10-21)

First public release.

- `rates`: true rate per mile on loaded and all miles, deadhead
  percent, break-even RPM with target margin, and the four-band rate
  verdict (below cost, thin, fair, strong).
- `profit`: full load profit breakdown with fuel, factoring, driver
  pay (percent of linehaul or per loaded mile), tolls and lumper,
  net profit, profit per mile, and margin percent.
- `hos`: simplified U.S. hours-of-service trip feasibility with the
  11-hour, 14-hour, and 70-hour limits, 30-minute break modelling,
  violations list and limiting factor, plus cycle reset advice.
- `detention`: detention charge calculator (free time, grace period,
  billable time rounded up to a billing increment) and a plain-text
  detention claim letter generator.
- `ifta`: per-state gallon apportionment and fuel tax estimates with
  a bundled approximate 2025 rate table for 13 states, caller-supplied
  rates, and unrated-state reporting.
- CLI (`dispatch-toolkit`) with rate, profit, hos, and detention
  commands and `--json` output.
- Checklists: pre-book carrier vetting, load booking workflow, and
  driver onboarding documents.
- Test suite: 22 hand-checked cases, zero dependencies.
