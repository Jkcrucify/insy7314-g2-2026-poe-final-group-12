#!/usr/bin/env bash
# End-to-end check of the tax feature against the running Docker stack.
#
# Start the stack first:
#   docker compose up --detach --wait
#
# Only needs curl and node, both of which the project already requires.
set -euo pipefail

API="https://localhost:5001/api"
C="curl --insecure --silent --show-error"
RUN=$RANDOM
PASS='Str0ng!Pass'

INCOME="$(mktemp)"
SUMMARY="$(mktemp)"
trap 'rm -f "$INCOME" "$SUMMARY"' EXIT

# Reads a dotted path out of the JSON on stdin, e.g. `json gig._id`
json() {
  node -e '
    let raw = "";
    process.stdin.on("data", chunk => raw += chunk).on("end", () => {
      let value = JSON.parse(raw);
      for (const key of process.argv[1].split(".")) value = value[key];
      console.log(value);
    });
  ' "$1"
}

echo "1. Register a freelancer and a client"
$C -X POST "$API/auth/register" -H 'Content-Type: application/json' \
  -d "{\"username\":\"taxf$RUN\",\"email\":\"taxf$RUN@test.com\",\"password\":\"$PASS\",\"role\":\"Freelancer\"}" >/dev/null
$C -X POST "$API/auth/register" -H 'Content-Type: application/json' \
  -d "{\"username\":\"taxc$RUN\",\"email\":\"taxc$RUN@test.com\",\"password\":\"$PASS\",\"role\":\"Client\"}" >/dev/null
echo "   freelancer: taxf$RUN@test.com    client: taxc$RUN@test.com    password: $PASS"

FTOK=$($C -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"taxf$RUN@test.com\",\"password\":\"$PASS\"}" | json token)
CTOK=$($C -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"taxc$RUN@test.com\",\"password\":\"$PASS\"}" | json token)

echo "2. Create a R50 000 gig as the freelancer"
GIG=$($C -X POST "$API/gigs" -H "Authorization: Bearer $FTOK" -H 'Content-Type: application/json' \
  -d '{"title":"Brand identity package","description":"Full brand identity: logo, palette, typography and a usage guide.","category":"Design","price":50000,"deliveryDays":14}' \
  | json gig._id)
echo "   gig id: $GIG"

echo "3. Book it three times as the client (R150 000 of income)"
for i in 1 2 3; do
  REF=$($C -X POST "$API/bookings" -H "Authorization: Bearer $CTOK" -H 'Content-Type: application/json' \
    -d "{\"gigId\":\"$GIG\",\"confirmPayment\":true}" | json transaction.reference)
  echo "   booking $i -> transaction $REF"
done

echo "4. Read the income and tax summary"
$C "$API/transactions/income" -H "Authorization: Bearer $FTOK" > "$INCOME"

cat > "$SUMMARY" <<'NODEEOF'
const assert = require('assert');
const fs = require('fs');

const d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const t = d.tax;

// Thousands separator without depending on the platform's locale data
const R = (n) => 'R' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const row = (label, value) => console.log(`   ${label.padEnd(16)}: ${value}`);

row('tax year', d.taxYear.label);
row('income (year)', R(d.taxYear.income));
row('taxable income', R(t.taxableIncome));
row('gross tax', R(t.grossTax));
row('less rebate', R(t.rebate));
row('TAX PAYABLE', R(t.taxPayable));
row('take-home', R(t.netIncome));
row('effective rate', `${t.effectiveRate}%   marginal: ${t.marginalRate}%`);
row('provisional x2', R(t.provisionalPayment));
row('months returned', `${d.monthly.length}  (non-zero: ${d.monthly.filter(m => m.income).length})`);
row('top gig', `${d.topGigs[0].title} ${R(d.topGigs[0].income)} x${d.topGigs[0].count}`);

const expectedGross = 150000 * 0.18;
const expectedPayable = expectedGross - 17235;

assert.strictEqual(d.taxYear.income, 150000, 'income for the tax year');
assert.ok(Math.abs(t.grossTax - expectedGross) < 0.01, 'gross tax');
assert.ok(Math.abs(t.taxPayable - expectedPayable) < 0.01, 'tax payable');
assert.ok(Math.abs(t.netIncome + t.taxPayable - t.taxableIncome) < 0.01, 'take-home plus tax');
assert.strictEqual(d.monthly.length, 12, 'twelve months returned');

console.log('\n   CHECK PASSED: R150 000 x 18% = R27 000, less the R17 235 rebate = R9 765');
NODEEOF
node "$SUMMARY" "$INCOME"

echo
echo "5. Expenses of R60 000 should lower the bill"
$C "$API/transactions/income?expenses=60000" -H "Authorization: Bearer $FTOK" | node -e '
  let raw = "";
  process.stdin.on("data", chunk => raw += chunk).on("end", () => {
    const t = JSON.parse(raw).tax;
    const R = (n) => "R" + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    console.log(`   taxable ${R(t.taxableIncome)} -> tax payable ${R(t.taxPayable)}`);
  });
'

echo
echo "6. A client must not be able to read freelancer income"
echo -n "   GET /transactions/income as Client -> "
$C -o /dev/null -w '%{http_code}\n' "$API/transactions/income" -H "Authorization: Bearer $CTOK"

echo
echo "7. Logout revokes the token"
echo -n "   logout -> "
$C -o /dev/null -w '%{http_code}\n' -X POST "$API/auth/logout" -H "Authorization: Bearer $FTOK"
echo -n "   reuse the same token -> "
$C -o /dev/null -w '%{http_code}\n' "$API/transactions/income" -H "Authorization: Bearer $FTOK"

echo
echo "ALL END-TO-END CHECKS COMPLETE"
