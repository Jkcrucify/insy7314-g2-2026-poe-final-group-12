# Demonstration video script

A running order for the Part 3 video. Each section names what to have on screen
and the point to make while it is there. Roughly 9–11 minutes at a normal pace.

## Before you start recording

```bash
# 1. Bring the stack up and wait for all three containers to report healthy
docker compose up --detach --build --wait

# 2. Seed a freelancer with a full tax year of income, so the charts have data
docker compose exec -e SEED_DEMO=yes api node scripts/seed-demo.js
```

That prints the credentials:

| Role | Email | Password |
|---|---|---|
| Freelancer | `demo.freelancer@hustlehub.test` | `Demo!Pass123` |
| Client | `demo.client@hustlehub.test` | `Demo!Pass123` |

Then set up, before the recording light goes on:

* Browser tabs, in this order: `http://localhost:8080`, the GitHub **Actions** tab,
  the GitHub **Security** tab, Grafana **Explore**.
* A terminal in the project root, font size up so it is readable on video.
* Close anything with personal information in it. Your `.env` holds a real Grafana
  token — do not open that file on camera.
* Decide who narrates which section if the marks are shared.

Do the account lockout section **last**. It locks an account for fifteen minutes,
and you do not want that account to be the one you still need.

---

## 1. The containerised stack (about 45 seconds)

**On screen:** terminal.

```bash
docker compose ps
```

Say: three containers — MongoDB, the API, and nginx serving the built React app —
each with its own health check. The database port is deliberately not published to
the host, so MongoDB is reachable only from inside the Docker network. Both
application containers run as a non-root user.

Worth adding: the whole stack starts from one command on any machine with Docker,
which is the point of containerising it.

## 2. Authentication and the business flow (about 2 minutes)

**On screen:** the browser at `http://localhost:8080`.

1. Sign in as the **client**.
2. Open a gig and book it. Confirm the payment.
3. Point at the transaction reference that comes back.

Say: the booking and its transaction are written in a MongoDB **transaction**, so a
booking can never exist without its matching payment record, even if the process
dies halfway through.

4. Sign out, sign in as the **freelancer**.
5. Show the booking has appeared on their side.

## 3. The tax estimation component (about 3 minutes — the largest section)

**On screen:** the Income and tax page, `/income`.

This is the new feature, so give it the most time.

1. **The four tiles.** Income for the tax year, estimated tax, what is left, and the
   effective rate. The seeded account shows R412 000 for 2026/2027 and R72 992 of
   tax.

2. **The monthly chart.** Nine months of earnings across the tax year. Mention that
   the South African tax year runs from 1 March to the end of February, not January
   to December, and that the page follows the tax year rather than the calendar year.

3. **The bracket split.** This is the part to dwell on. The bar shows the income
   divided across the brackets it passes through — R237 100 taxed at 18%, the next
   R133 400 at 26%, and the last R41 500 at 31%. Make the point that **only the top
   slice is taxed at the top rate**, which is the thing people most often get wrong
   about how tax works.

4. **Open "How this is worked out".** Read the figures off it:

   | | |
   |---|---|
   | Gross income | R412 000 |
   | Gross tax | R90 227 |
   | Less the primary rebate | R17 235 |
   | **Tax payable** | **R72 992** |

   Say the rates come from the published SARS tables for the 2025/2026 year of
   assessment, and that the panel names the table version so the figures can be
   checked against SARS directly.

5. **Change the expenses field.** Enter `80000` and let it recalculate. Expenses are
   deductible, so taxable income drops and the bill falls with it.

6. **Change the age group** to 65–74. The rebate increases, so the tax drops again.
   Mention the tax threshold: below it, no tax is owed at all.

7. Point out the **provisional tax** figure — a sole proprietor pays in two
   instalments rather than through PAYE, so the page halves the annual estimate.

If you need one sentence to tie it together: the component takes the income the
platform already records and turns it into the number a freelancer actually needs
to put aside, which is the problem the brief asks it to solve.

## 4. Role-based access control (about 30 seconds)

**On screen:** the browser.

Sign in as the **client** and try to reach `/income` directly in the address bar.
The route refuses. Say the guard is enforced on the server as well, not just hidden
in the interface — the API returns 403 even if the request is made directly, which
you will see in the logs shortly.

## 5. Additional security feature: JWT revocation (about 1 minute)

**On screen:** the browser, then the terminal.

Say the problem first: a JSON Web Token is self-contained, so the server normally
cannot take one back before it expires. Signing out only forgets the token locally,
which means a copied token keeps working.

1. Sign out in the browser.
2. In the terminal, replay the token that was just signed out:

```bash
curl --insecure --silent -o /dev/null -w '%{http_code}\n' \
  https://localhost:5001/api/transactions/income \
  -H "Authorization: Bearer <the token>"
```

It returns **401**. Say each token carries a unique id, signing out records that id
in a revoked list, and the authentication middleware checks it on every request.
The entries carry a MongoDB TTL index, so they delete themselves when the token
would have expired anyway and the collection cannot grow without bound.

If pulling the token out of devtools is awkward on camera, run the end-to-end
script instead — step 7 does exactly this:

```bash
bash evidence/evidence_part3/end-to-end/tax-verification.sh
```

## 6. Monitoring: logs and the cloud platform (about 1.5 minutes)

**On screen:** terminal, then Grafana.

```bash
docker compose exec api cat /app/logs/security.log
```

Say: one JSON object per line, so the logs are searchable by a tool rather than read
by eye. Then make the two points that matter:

* **Nothing sensitive is in them.** Passwords and tokens are redacted, email
  addresses are masked to `d***@hustlehub.test`, and a rejected input records the
  *field name* that was rejected, never the payload. An injection attempt cannot be
  replayed out of the log file.
* **The failure reason is logged but not returned.** A failed login records whether
  the email was unknown or the password wrong; the user always sees the same generic
  message. That helps an investigator without helping an attacker.

Now switch to **Grafana Cloud Explore** and run:

```
{app="hustlehub"} | json | category="security"
```

Say the same redacted lines are shipped to Grafana Cloud Loki, so logs from every
container are searchable in one place instead of by opening a shell in each one.

**The thing to point at:** find a token id that appears three times — issued at
login, revoked at logout, then rejected on reuse. That is the revocation feature
visible in the audit trail, not just in a test.

Then show the business trail too:

```
{app="hustlehub"} | json | category="app"
```

Gigs created, bookings with their reference and amount, income views.

## 7. Static code analysis (about 1 minute)

**On screen:** terminal.

```bash
cd api && npm run lint
```

Clean. Say what is running: ESLint's correctness rules plus
**eslint-plugin-security**, a static application security testing ruleset that flags
dangerous patterns — object injection through computed keys, unsafe regular
expressions, `eval`, timing-unsafe comparisons.

Then tell the story that earns the marks: the first run produced 21 findings, and
one was a genuine **prototype pollution** vulnerability in the request sanitiser. A
request containing a `__proto__` key could reach `Object.prototype`. It is fixed,
it has a test covering it, and the write-up of every finding — fixed or triaged with
a reason — is in `evidence/evidence_part3/static-analysis/`.

Mention the exceptions are scoped and justified rather than switched off globally:
test files may build malicious payloads, and operator scripts may print to the
terminal, but application code may do neither.

## 8. The CI/CD pipeline (about 1.5 minutes)

**On screen:** the GitHub Actions tab.

Open the most recent run and show the three jobs:

| Job | What it does |
|---|---|
| **Backend** | lint, production dependency audit, 85 tests |
| **Frontend** | lint, 57 tests, production build |
| **Docker** | builds both images, starts the whole stack, then runs 62 API requests against the real containers |

Say the Docker job only runs if the first two pass, and that it uses
`docker compose up --wait`, so a container failing its health check fails the build.

**Make the "fails on a failing check" point explicitly**, since the brief asks for
it: lint runs with `--max-warnings=0`, so a single unresolved finding stops the
pipeline, and the dependency audit fails the build on a high or critical advisory in
anything that ships in the container. Audit findings in build-only tooling are
reported but do not block, because that code never reaches the running image.

If you have a red run in the history, open it — a pipeline that has actually failed
and been fixed is better evidence than one that has only ever been green.

Then the **Security** tab for the CodeQL results.

## 9. Account lockout — do this last (about 45 seconds)

**On screen:** the login page.

Say the problem: a password endpoint that always answers lets an attacker guess
forever.

Enter a wrong password for the demo client **five times**. On the fifth, the account
locks and the response says how long for.

Say: five consecutive failures locks the account for fifteen minutes, the counter
resets on a successful sign-in, and the response carries a `Retry-After` header so a
legitimate client knows when to come back. Name the trade-off honestly — this can be
used to lock someone else out of their own account on purpose, which is why the lock
expires by itself rather than needing an administrator.

Add that it works alongside rate limiting: the limiter caps requests per IP address,
while the lockout protects a single account from a distributed attempt.

## 10. Close (about 30 seconds)

**On screen:** the README.

Scroll the contents, then the **security review** section. Say it covers injection,
cross-site scripting, authentication and access control — and that it also states
the known limitations honestly rather than claiming the application is perfectly
secure.

---

## Things to avoid on camera

* Opening `.env` or the root `.env` — they contain a real Grafana token and the JWT
  secret.
* Showing your Grafana account settings or API keys page.
* Reading long code files line by line. Show the behaviour, then point at the file
  that implements it.
* Claiming the application is fully secure. The README's stated limitations are a
  mark earner, not a weakness.

## Mapping to the brief

| Requirement | Section |
|---|---|
| Tax estimation with explained logic | 3 |
| Charted frontend display | 3 |
| Pipeline that fails on a failing check | 8 |
| Static code analysis with evidence | 7 |
| Containerisation | 1 |
| Logging of key events, cloud platform | 6 |
| Two additional security features | 5 and 9 |
| Security review | 10 |
| Documentation | 10 |
