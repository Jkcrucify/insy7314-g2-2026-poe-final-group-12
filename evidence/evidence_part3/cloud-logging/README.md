# Cloud logging: Grafana Cloud Loki

Every event the API writes to disk is also shipped to **Grafana Cloud Loki**, so the
logs can be searched, dashboarded and alerted on from one place rather than by
opening a shell inside a container.

## How it is wired

`api/utils/logger.js` adds a `winston-loki` transport when three environment
variables are present. If they are absent the transport is never created, so the
application runs identically without a Grafana account:

```js
const { LOKI_HOST, LOKI_USER, LOKI_TOKEN } = process.env;
if (LOKI_HOST && LOKI_USER && LOKI_TOKEN) { ... }
```

Design decisions worth noting:

* **The same redacted line is shipped.** The transport reuses `jsonFormat`, the
  format that writes the files, so the redaction of passwords and tokens and the
  masking of email addresses apply before anything leaves the server. No secret is
  sent to a third party.
* **Batched, not per-request.** Events are buffered and flushed every 5 seconds, so
  logging adds no network round trip to a request.
* **A Loki outage cannot break the API.** `onConnectionError` writes the failure to
  local stderr and the request continues. File logging is unaffected, so an outage
  degrades observability instead of availability.
* **Labels, not log lines, carry the dimensions.** `app`, `service` and
  `environment` are Loki labels; everything else stays inside the JSON payload and
  is queried with `| json`. Labelling high-cardinality values such as user ids
  would blow up Loki's index.

Credentials are read from the project-root `.env`, which is git-ignored, and passed
through `docker-compose.yml`. `api/.dockerignore` excludes `.env` and `.env.*`, so
no credential is ever baked into an image layer.

## Queries used

| Query | What it answers |
|---|---|
| `{app="hustlehub"}` | Everything the API has emitted |
| `{app="hustlehub"} \| json \| category="security"` | The security trail only |
| `{app="hustlehub"} \| json \| category="app"` | The business trail: gigs, bookings and income views |
| `{app="hustlehub"} \| json \| message="auth.login.failure"` | Failed logins, with the reason and the masked address |
| `{app="hustlehub"} \| json \| message=~"auth.login.account_locked\|rate_limit.*"` | Brute-force defences firing |
| `sum by (message) (count_over_time({app="hustlehub"} \| json \| category="security" [1h]))` | Which security events dominate the last hour |

## Screenshots

| File | What it shows |
|---|---|
| `loki-all-events.png` | `{app="hustlehub"}` in Grafana Explore, returning live events from the containerised API |
| `loki-security-events.png` | The same stream filtered to `category="security"`, showing one token's `jti` issued at login, revoked at logout and then rejected on reuse |
| `loki-app-events.png` | The business trail, `category="app"`: gigs created, bookings with their transaction reference, income views |
| `loki-event-counts.png` | `sum by (message) (count_over_time(...))` graphed, so the security events of the last hour can be read at a glance |
