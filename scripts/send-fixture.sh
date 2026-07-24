#!/usr/bin/env bash
# Sign a webhook fixture with APP_SECRET and POST it to a locally running bot,
# so the full signature-verification + router dispatch path can be exercised
# without a live Meta app. See test/fixtures/ for available payloads.
#
# Usage: APP_SECRET=... ./scripts/send-fixture.sh test/fixtures/text-message.json [url]

set -euo pipefail

FIXTURE="${1:?Usage: $0 <fixture.json> [url]}"
URL="${2:-http://localhost:3000/}"

if [ -z "${APP_SECRET:-}" ]; then
  echo "APP_SECRET must be set in the environment (same value the bot is booted with)." >&2
  exit 1
fi

BODY="$(cat "$FIXTURE")"
SIGNATURE="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$APP_SECRET" | sed 's/^.* //')"

curl -sS -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: $SIGNATURE" \
  -d "$BODY" \
  -w '\nHTTP %{http_code}\n'
