# HustleHub+Secure Freelance Marketplace (MERN)

HustleHub+ is a full-stack MERN marketplace where **Freelancers** list services (gigs) and **Clients** browse and book them through a simulated payment. Every booking creates a transaction record, each freelancer's income is tracked from those transactions, and that income is turned into an estimated SARS tax bill with a charted breakdown.

The project is containerised, covered by 85 backend and 57 frontend automated tests plus a 123-assertion API security suite, analysed by two independent static analysis tools, and built by a GitHub Actions pipeline that fails on any failing check.

---

## Features

**Everyone**

* Register and log in as a Client or a Freelancer (JWT authentication)
* Browse and search gigs by keyword and category

**Freelancers**

* Create, update and delete their own gigs
* See bookings received and the transactions behind them
* **Income & tax dashboard:** income for the current tax year charted month by month, an estimated tax bill, take-home pay, effective and marginal rates, a bracket-by-bracket breakdown and the top earning gigs
* Adjust the estimate for deductible business expenses and age group

**Clients**

* Book a gig with a simulated payment
* View their own bookings and transactions

Each booking and its transaction are written together inside a single MongoDB transaction, so a payment record can never exist without its booking, or the reverse.

---

## Tax estimationhow it works

A HustleHub+ freelancer is a **sole proprietor**: gig income is taxed as personal income, not company income. The calculation uses the published SARS individual tax tables for the **2025/2026 year of assessment** and lives in [`api/utils/tax.js`](api/utils/tax.js).

### The tax year

The South African tax year runs from **1 March to the last day of February**. Only transactions inside that window count toward the estimate. All-time income is still shown separately on the dashboard. Boundaries are computed in UTC so they do not drift with the server's timezone.

### The tables

| Taxable income | Rate |
|---|---|
| R0 – R237 100 | 18% of taxable income |
| R237 101 – R370 500 | R42 678 + 26% of the amount above R237 100 |
| R370 501 – R512 800 | R77 362 + 31% of the amount above R370 500 |
| R512 801 – R673 000 | R121 475 + 36% of the amount above R512 800 |
| R673 001 – R857 900 | R179 147 + 39% of the amount above R673 000 |
| R857 901 – R1 817 000 | R251 258 + 41% of the amount above R857 900 |
| R1 817 001 and above | R644 489 + 45% of the amount above R1 817 000 |

Rebates (cumulative by age) and the matching tax thresholds:

| Age | Rebate | Tax threshold |
|---|---|---|
| Under 65 | R17 235 | R95 750 |
| 65 to 74 | R26 679 | R148 217 |
| 75 and over | R29 824 | R165 689 |

### The five steps

1. **Taxable income** = income earned in the tax year − deductible business expenses. Expenses can reduce income to zero but never below it.
2. **Gross tax** = the bracket's fixed base amount + (the bracket rate × income above the bracket's lower edge). The tables are cumulative, so each slice of income is taxed at its own ratethis is *marginal* taxation, not a flat rate applied to the whole amount.
3. **Tax payable** = gross tax − the age rebate, floored at zero. The rebate is a credit against tax owed, never a refund.
4. **Effective rate** = tax payable ÷ taxable income (what is actually paid overall). **Marginal rate** = the rate charged on the next rand earned.
5. **Provisional payments** = tax payable ÷ 2, because sole proprietors pay in two instalments (end of August and end of February).

### Worked example

A freelancer earning **R500 000** in the tax year, under 65, with no expenses:

```
Bracket 1   R0        – R237 100 : R237 100 × 18% = R42 678
Bracket 2   R237 100  – R370 500 : R133 400 × 26% = R34 684
Bracket 3   R370 500  – R500 000 : R129 500 × 31% = R40 145
                                   ─────────────────────────
                        Gross tax                  R117 507
                        Less primary rebate       (R17 235)
                                   ─────────────────────────
                        Tax payable                R100 272

Effective rate  R100 272 / R500 000 = 20.05%
Marginal rate                          31%
Take-home       R500 000 - R100 272 = R399 728
Each provisional payment               R50 136
```

Why **R95 750** is tax free for someone under 65: R95 750 × 18% = R17 235, exactly cancelled by the primary rebate.

### Where it is shown

The **Income & tax** page (`/income`, freelancers only) presents:

* Four summary tilesincome this tax year, estimated tax, estimated take-home, marginal rate
* A **bar chart** of income for each of the twelve months of the tax year
* A **segmented bar** splitting taxable income into take-home pay and tax
* The explanation above, filled in with the freelancer's own figures
* A table of every bracket applied, with the income and tax in each, totalled to the gross tax, the rebate and the amount payable
* The five highest-earning gigs of the tax year

The dashboard (`/dashboard`) carries a condensed version: an estimated tax tile and the monthly income chart.

Both charts are hand-built SVG with no charting dependency. The two series colours were validated for colour-vision-deficiency separation and for contrast against the card surface; identity is never carried by colour alone (every segment is labelled and legended), and each chart offers the same figures as a data table for screen readers.

> The estimate is for planning only. It assumes the freelancer is a South African tax resident with no other income and no VAT registration. It is not a substitute for a tax return.

---

## Getting started

### Option 1Docker (recommended)

The only prerequisite is Docker Desktop. No MongoDB installation, no certificate generation.

```bash
cp .env.example .env     # then set JWT_SECRET to a long random value
docker compose up --build
```

| Service | URL |
|---|---|
| Web application | <http://localhost:8080> |
| API | <https://localhost:5001> (self-signed certificate) |
| MongoDB | internal to the Docker network only, no published port |

The API generates its own TLS certificate on first start, so no private key is ever baked into an image or committed. Stop the stack with `docker compose down`, or `docker compose down --volumes` to also discard the database.

### Option 2Running locally

**Prerequisites:** Node.js 20+, a MongoDB database (Atlas or local, with replica set support for transactions), OpenSSL.

```bash
# Backend
cd api
npm install
mkdir -p certs && cd certs
openssl req -nodes -new -x509 -days 365 -subj "/CN=localhost" \
  -keyout server.key -out server.cert
cd ..
cp .env.example .env     # set MONGO_URI and JWT_SECRET
npm run dev              # https://localhost:5001
```

```bash
# Frontend, in a second terminal
cd client
npm install
npm run dev              # http://localhost:5173
```

### Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `MONGO_URI` | yes || MongoDB connection string |
| `JWT_SECRET` | yes || Signing key for JSON web tokens |
| `JWT_EXPIRES_IN` | no | `1h` | Token lifetime |
| `PORT` | no | `5001` | API port |
| `CLIENT_ORIGIN` | no | `http://localhost:5173` | The only origin allowed by CORS |
| `TRUST_PROXY` | no || Proxy hops to trust, so per-IP limits stay accurate behind nginx |
| `AUTH_RATE_LIMIT_MAX` | no | `20` | Failed auth attempts per IP per 15 minutes |
| `BOOKING_RATE_LIMIT_MAX` | no | `10` | Bookings per user per 15 minutes |
| `LOCKOUT_MAX_ATTEMPTS` | no | `5` | Failed logins before an account locks |
| `LOCKOUT_MINUTES` | no | `15` | How long an account stays locked |
| `LOG_LEVEL` | no | `info` | Minimum level written to the logs |
| `LOG_DIR` | no | `api/logs` | Where log files are written |
| `LOKI_HOST`, `LOKI_USER`, `LOKI_TOKEN` | no || Grafana Cloud Loki; when all three are set, logs are also shipped there |

The API refuses to start if `JWT_SECRET` or `MONGO_URI` is missing, rather than falling back to an insecure default.

---

## Architecture

```
insy7314-g2-2026-poe-final-group-12/
├─ .github/workflows/      CI pipeline and CodeQL scanning
├─ api/                    Express REST API (HTTPS)
│  ├─ config/              Database connection
│  ├─ controllers/         Request handlers
│  ├─ middleware/          Auth, RBAC, validation, sanitisation, rate limits, errors, logging
│  ├─ models/              Mongoose schemas
│  ├─ routes/              Route definitions
│  ├─ utils/               Logger, constants, tax engine
│  ├─ validators/          express-validator rule sets
│  ├─ tests/               Jest unit + integration suites, Postman collection, reports
│  └─ Dockerfile
├─ client/                 React 19 + Vite single-page app
│  ├─ src/api/             Fetch wrapper
│  ├─ src/components/      Shared UI, including the charts
│  ├─ src/context/         Auth context
│  ├─ src/pages/           Routed pages
│  ├─ src/__tests__/       Vitest suites
│  └─ Dockerfile           Multi-stage build, served by unprivileged nginx
├─ evidence/               Screenshots, logs and analysis results
└─ docker-compose.yml      MongoDB + API + client
```

### API endpoints

| Method | Route | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/register` | public | Create a Client or Freelancer account |
| `POST` | `/api/auth/login` | public | Authenticate, receive a JWT |
| `POST` | `/api/auth/logout` | private | Revoke the current token |
| `GET` | `/api/auth/me` | private | Current user profile |
| `GET` | `/api/gigs` | private | Browse and search gigs |
| `GET` | `/api/gigs/mine` | Freelancer | The caller's own gigs |
| `GET` | `/api/gigs/:id` | private | One gig |
| `POST` | `/api/gigs` | Freelancer | Create a gig |
| `PUT` | `/api/gigs/:id` | Freelancer, owner | Update own gig |
| `DELETE` | `/api/gigs/:id` | Freelancer, owner | Delete own gig |
| `POST` | `/api/bookings` | Client | Book a gig, recording the transaction |
| `GET` | `/api/bookings/mine` | private | Bookings made or received |
| `GET` | `/api/bookings/:id` | participants only | One booking |
| `GET` | `/api/transactions/mine` | private | The caller's transactions |
| `GET` | `/api/transactions/income` | Freelancer | Income, monthly series and tax estimate |

---

## Security implementation

| Control | Implementation |
|---|---|
| **Authentication** | JWT, HS256, one-hour expiry, required on every protected route. Passwords hashed with bcrypt at 12 rounds. A strong-password policy is enforced at registration (8–64 characters, upper, lower, number, symbol) |
| **Authorisation (RBAC)** | Role middleware: only Freelancers manage gigs and view income, only Clients book. Ownership checks stop users reading or modifying anyone else's data (403). Registering as `Admin` is blocked. The role is read from the **database**, never from the token |
| **Input validation** | `express-validator` rule sets on every route that accepts input, including query parameters. Invalid input is rejected with a 400 listing the field namesnever the submitted values |
| **Sanitisation** | HTML stripped with `xss`; MongoDB operator keys (`$…`) and dotted paths removed; prototype-chain keys (`__proto__`, `constructor`, `prototype`) dropped; Mongoose `sanitizeFilter` and `strictQuery` enabled; 10 KB request body limit |
| **Rate limiting** | Login/register: 20 failed attempts per IP per 15 minutes. Bookings: 10 per user per 15 minutes. All API routes: 300 per 15 minutes |
| **Account lockout** | Five consecutive failed logins lock the account for 15 minutessee [Additional security features](#additional-security-features) |
| **Session revocation** | Logging out blocklists the token server-sidesee [Additional security features](#additional-security-features) |
| **Security headers** | Helmet on the API with a strict CSP (`default-src 'none'`), HSTS, `nosniff`, frame and referrer policies, and `Cache-Control: no-store` on every response. nginx sends an equivalent CSP plus `Permissions-Policy` for the React app |
| **CORS** | Restricted to the configured frontend origin, with an explicit method and header allow-list |
| **Safe errors** | Generic messages, no stack traces. Login returns the same message and takes the same time whether the email exists or not |
| **Transport & secrets** | HTTPS end to end. Secrets live in `.env`, which is git-ignored; `.env.example` documents them. TLS keys are generated at container start, never committed |
| **Containers** | Both images run as a non-root user. The database publishes no port outside the Docker network |

---

## Additional security features

Two controls go beyond the baseline required by the brief. Both are functional, both are covered by automated tests, and both close a gap the baseline leaves open.

### 1. Per-account lockout after repeated failed logins

**The gap.** IP rate limiting protects *an address*. An attacker spreading guesses across a botnet, or sitting behind the same NAT as legitimate users, defeats it: each address stays under the limit while the account is attacked steadily.

**The control.** The `User` document carries `failedLoginAttempts` and `lockUntil`. Five consecutive failures lock the account for 15 minutes. While locked, the API returns **423 Locked** with a `Retry-After` header and refuses the login *before* checking the passwordso an attacker who guesses correctly during a lock still gains nothing. A successful login clears the counter. The update is applied atomically with `$inc`/`$set`, so simultaneous requests cannot race past the threshold.

Both thresholds are configurable with `LOCKOUT_MAX_ATTEMPTS` and `LOCKOUT_MINUTES`.

**Logged as:** `auth.login.account_locked` when the lock is applied, `auth.login.locked_out` on each refused attempt.

**Trade-off, stated deliberately.** The 423 response confirms that an account exists, which the generic 401 is designed to hide. The alternativereturning 401 while lockedleaves users unable to tell a wrong password from a locked account, and support cannot either. We chose the clearer response because enumeration is already slowed by the IP rate limiter and the uniform-timing login path, and because a lockout that cannot be explained to the user tends to be switched off. The decision is recorded here so a reviewer can disagree with it knowingly.

**Files:** [`api/models/User.js`](api/models/User.js), [`api/controllers/authController.js`](api/controllers/authController.js). **Tests:** five cases in `tests/integration/auth.test.js`, three in the Postman suite.

### 2. Server-side token revocation on logout

**The gap.** A JWT is valid until it expires because the server holds no session. "Log out" in a browser only clears local storage. A token copied beforehandfrom a shared machine, an XSS payload, a proxy logkeeps working for the rest of its hour.

**The control.** Every token issued now carries a unique `jti` claim. `POST /api/auth/logout` records that `jti` in a `RevokedToken` collection, and the auth middleware refuses any token whose `jti` is listed, on every protected route. Logging out therefore ends the session on the server, not just in the browser. The frontend calls the endpoint before clearing its own state.

Each entry stores the token's own expiry under a **MongoDB TTL index**, so the document deletes itself the moment the token would have expired anyway. The blocklist can never grow beyond one hour of logouts.

Revocation is per token, not per user: logging out on one device leaves other sessions working.

**Logged as:** `auth.logout.success`, and `auth.token.rejected` with `reason: "revoked"` on a replay attempt.

**Files:** [`api/models/RevokedToken.js`](api/models/RevokedToken.js), [`api/middleware/authMiddleware.js`](api/middleware/authMiddleware.js). **Tests:** six cases in `tests/integration/auth.test.js`, six in the Postman suite, one in `client/src/__tests__/Navbar.test.jsx`.

### A third control, found by static analysis

Prototype-pollution protection was added after `eslint-plugin-security` flagged the request sanitiser. It is described under [Static code analysis](#static-code-analysis).

---

