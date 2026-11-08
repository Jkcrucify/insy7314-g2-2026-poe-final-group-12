# Static code analysis results

Two independent tools analyse this codebase. Both run in the CI pipeline and both
fail the build on a finding.

| Tool | Scope | What it looks for |
|---|---|---|
| ESLint + `eslint-plugin-security` | `api/` | Correctness bugs and dangerous patterns within a file: object injection, non-literal regular expressions (ReDoS), unsafe file paths, `eval` |
| ESLint + `react`, `react-hooks`, `jsx-a11y` | `client/` | Component correctness, the rules of hooks, accessibility defects, and XSS vectors (`dangerouslySetInnerHTML`, `javascript:` URLs) |
| CodeQL (`security-extended`) | whole repository | Semantic data-flow analysis: follows untrusted input from an HTTP request through to a database query, file path or response |
| `npm audit` | both | Known vulnerabilities in dependencies |

## Current result

```
$ cd api && npm run lint -- --max-warnings=0
(no output - 0 problems)

$ cd client && npm run lint -- --max-warnings=0
(no output - 0 problems)

$ cd api && npm audit --omit=dev
found 0 vulnerabilities

$ cd client && npm audit --omit=dev
found 0 vulnerabilities
```

ESLint prints nothing when a run is clean, which is why `eslint-api.txt` and
`eslint-client.txt` are empty files. The machine-readable `*.json` reports record
the same result with the full list of files that were analysed.

## Baseline, before any fixes

The first ESLint run over the API reported **21 problems (1 error, 20 warnings)**:

| Rule | Count | Where |
|---|---|---|
| `security/detect-object-injection` | 16 | `gigController.js`, `sanitizeMiddleware.js`, `logger.js`, `tax.js`, `server.js` |
| `security/detect-non-literal-fs-filename` | 3 | `server.js`, `logger.js` |
| `no-unused-vars` | 1 | `bookingController.js` |
| unused `eslint-disable` directive | 1 | `errorMiddleware.js` |

The client run reported **211 problems**, of which 207 were test-runner globals
that the configuration had not yet declared.

## What was fixed, and why

**1. Prototype pollution in the request sanitiser (genuine vulnerability).**
`middleware/sanitizeMiddleware.js` copied every key of the request body onto a new
object using bracket notation. A body of `{"__proto__": {"isAdmin": true}}` would
therefore have written to `Object.prototype`, adding `isAdmin` to **every object in
the running process**. Any later code that read a property it had never set would
have seen the attacker's value. `__proto__`, `constructor` and `prototype` are now
dropped alongside the MongoDB operator keys, and the attempt is recorded as
`input.prototype_key_removed` in `security.log`. Covered by three tests in
`tests/integration/security.test.js`.

**2. The same guard in the log redactor.** `utils/logger.js` rebuilt log metadata
the same way. Lower risk, because the result is only serialised to JSON, but it was
the same pattern and is now closed the same way.

**3. Computed property access removed from the tax engine.** `utils/tax.js` looked up
rebates and thresholds with `TAX_TABLE.rebates[group]`. Rewritten to use `Map.get`,
which cannot reach the object prototype no matter what `group` contains. This
removes the sink rather than suppressing the warning.

**4. `no-unused-vars` in `bookingController.js`.** The `({ __v, ...rest })` idiom
intentionally discards a field. Resolved by enabling `ignoreRestSiblings`, the
option ESLint provides for exactly this pattern, rather than deleting the code.

## What was triaged rather than changed

Four findings are false positives for this codebase. Each is suppressed at the
precise line with a comment naming the reason, so the suppression is reviewable:

| Location | Finding | Why it is safe |
|---|---|---|
| `controllers/gigController.js` | object injection | The key comes from the `EDITABLE_FIELDS` whitelist declared in the same file, never from the request |
| `server.js` | object injection | `process.env[key]` where the keys are string literals in that file |
| `server.js`, `utils/logger.js` | non-literal fs filename | `CERT_DIR` and `LOG_DIR` are deployment configuration read once at start-up; no request can influence them |
| `client/eslint.config.js` | `react-hooks/set-state-in-effect` | The project fetches on mount with `useEffect` plus a loading flag, which is the documented React pattern. Every other rule of hooks remains an error |

## Dependency audit

`npm audit --omit=dev` is the pipeline gate: a high or critical advisory in anything
that ships inside the container fails the build. Both projects report **0
vulnerabilities** at that level.

Fixes applied to reach it:

- **API:** `npm audit fix` upgraded `body-parser`, `brace-expansion` and `proxy-addr`
  (the last one carried a critical advisory). All three arrive through Express.
- **Client:** Vitest was upgraded from 3.x to 5.x, clearing two critical advisories
  in `vitest` and `tinypool`.

A second, non-blocking audit including dev tooling still reports advisories in the
Newman and Postman packages. Resolving those would mean downgrading Newman to a
much older major version, which would lose the HTML reporter the evidence relies on.
Newman runs on the build machine only and never enters the deployed image, so it is
reported for visibility rather than treated as an exposure.
