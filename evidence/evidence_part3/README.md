# Part 3 evidence

Everything here was produced from a real run of the containerised stack
(`docker compose up --build`), not from a development server.

## `demonstration-script.md`

The running order for the demonstration video: what to have on screen in each
section, the point to make while it is there, and the commands that set the demo
up. See [`demonstration-script.md`](demonstration-script.md).

## `logs/`

| File | What it shows |
|---|---|
| `security.log` | Security events only, as written by the API inside its container. Covers sixteen distinct event types: logins (success, failure with the reason, lockout), token rejections (missing, tampered, expired, revoked), access-control denials by role and by ownership, rate-limit blocks, and stripped XSS, NoSQL and prototype-pollution payloads |
| `app.log` | Every event, including the business trail: gig creation and updates, bookings with their transaction reference and amount, and income views |
| `error.log` | Errors only. Empty, because the run produced none |
| `api-container.log` | API container stdout, showing start-up, the database connection and the request log |
| `client-container.log` | nginx access and error output from the client container |
| `docker-compose-ps.txt` | All three containers reporting healthy |

What to notice in `security.log`:

* **Field names only.** `input.validation_failed` and `input.nosql_operator_removed`
  record *which* field was rejected (`email.$ne`), never the value submitted. An
  injection payload cannot be replayed out of the logs.
* **Masked emails.** Login events carry `t***@test.com` — enough to correlate
  attempts against one account without storing the address.
* **Request IDs.** Every entry carries `requestId`, the client IP, and the user id
  and role once authenticated, so one request can be followed end to end.
* **The failure reason is logged, not returned.** `auth.login.failure` records
  `wrong_password` or `unknown_email`. The client always receives the same generic
  message, so the distinction helps an investigator without helping an attacker.
* **One line of JSON per event**, so the logs can be searched and aggregated by a
  tool rather than read by eye.

## `cloud-logging/`

The same events are shipped to **Grafana Cloud Loki**, so the logs are searchable
centrally rather than only inside a container. The queries used, the labelling and
redaction decisions, and screenshots of the live stream are in
[`cloud-logging/README.md`](cloud-logging/README.md).

## `cicd/`

| File | What it shows |
|---|---|
| `ci-pipeline-success.png` | A GitHub Actions run of `ci.yml` on `main` with every job green: backend lint, audit and tests; frontend lint, tests and build; and the Docker stack built, started and exercised by the API suite. The Vitest job summary reports 11 test files and 57 tests passing |

## `static-analysis/`

ESLint and `npm audit` results for both projects, the baseline findings from before
any fixes, and an explanation of what was fixed and what was triaged. See
[`static-analysis/README.md`](static-analysis/README.md).

The headline: static analysis found a genuine **prototype pollution** vulnerability
in the request sanitiser, which has been fixed and covered by tests.

## `end-to-end/`

| File | What it shows |
|---|---|
| `tax-verification.txt` | A transcript proving the tax feature works through the containers: a freelancer earns R150 000 across three bookings, and the API returns R9 765 of tax — R150 000 × 18% = R27 000, less the R17 235 primary rebate. It also checks that expenses lower the bill, that a Client is refused the income endpoint with 403, and that a token stops working after logout |
| `tax-verification.sh` | The script that produced it, so the run can be repeated |

## Reproducing all of it

```bash
docker compose up --build --detach --wait
cd api && npm run test:api && npm run test:ratelimit
cd .. && bash evidence/evidence_part3/end-to-end/tax-verification.sh
docker compose exec -T api cat /app/logs/security.log
```
