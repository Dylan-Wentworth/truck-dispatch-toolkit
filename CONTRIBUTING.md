# Contributing to truck-dispatch-toolkit

Thanks for helping build tools dispatchers actually use. The rules are
simple and they are the point of the project.

## House rules

1. **Vanilla JavaScript only.** No frameworks, no transpilers, no
   build step. If it cannot run with `node file.js`, it does not ship.
2. **Zero dependencies.** `package.json` has no `dependencies` section
   and it stays that way. Node built-ins for the CLI only; library
   modules in `src/` use nothing outside the language.
3. **Every calculator ships with tests.** New math without a
   hand-checked test is not merged. Show the arithmetic in a comment
   for at least one test case, the way the existing worked examples do.
4. **Estimates say so.** Anything that touches regulation (HOS, IFTA)
   is labelled a planning estimate in code comments and docs. Never
   present an output as a legal or tax determination.
5. **No em dashes** in code, comments, or docs. Use periods or commas.

## Adding a calculator

1. Create `src/<name>.js` as a pure CommonJS module: no I/O, no
   globals, no mutation of inputs. Validate every input and throw
   `RangeError` with a message that names the bad field.
2. Round money outputs to 2 decimals at the boundary (see the
   `round2` pattern in `src/profit.js`); keep internal math at full
   precision.
3. Re-export from `src/index.js`, both namespaced and flat.
4. Add a command to `bin/cli.js` with kebab-case flags mapped to the
   module's camelCase parameters, plus `--json` support (the pattern
   is already there, copy it).
5. Add tests to `tests/toolkit.test.js` and run `npm test`.
6. Document it in the README with a CLI example whose output you
   paste from a real run.
7. Add a CHANGELOG entry under Unreleased.

## Style

- CommonJS, `'use strict'`, two-space indent, single quotes.
- Comments explain the business rule or the regulation, not the syntax.
- Function parameters are a single options object, like every existing
  module. Defaults match the common contract or legal default.

## Pull requests

- One calculator or one fix per PR.
- Paste the `npm test` output in the PR description.
- If your change alters a number an existing test asserts, explain
  why the old expectation was wrong, with the arithmetic.
