#!/usr/bin/env bash
# Smoke test: every route of Program.cs, plus the jukebox page and its files.
# Usage: tests/smoke.sh [base-url]   (default http://localhost:8080, the port of `dotnet run --no-launch-profile`)
set -euo pipefail

base="${1:-http://localhost:8080}"
base="${base%/}"
passed=0
failed=0

# check <method> <path> <expected status> <text expected in the body or the headers>
check() {
  local method="$1" path="$2" want_status="$3" want_text="$4" out status
  local args=(-s -i -X "$method")
  if [[ $# -ge 5 ]]; then args+=(-H 'Content-Type: application/json' --data "$5"); fi
  out="$(curl "${args[@]}" "$base$path")" || true
  status="$(printf '%s' "$out" | head -n 1 | awk '{print $2}')"
  if [[ "$status" == "$want_status" ]] && grep -qiF -- "$want_text" <<<"$out"; then
    passed=$((passed + 1))
    printf 'ok    %-4s %-42s %s\n' "$method" "$path" "$status"
  else
    failed=$((failed + 1))
    printf 'FAIL  %-4s %-42s got %s, wanted %s with "%s"\n' "$method" "$path" "${status:-none}" "$want_status" "$want_text"
  fi
}

# The jukebox page, its strict CSP and its files
check GET /                     200 'Every record is a route.'
check GET /                     200 "script-src 'self'"
check GET /jukebox.js           200 'const RECORDS'
check GET /jukebox.css          200 '.jukebox'
check GET /cc-brand.css         200 'Clever Brand Kit'
check GET /cc-badge.svg         200 '<svg'
check GET /env                  200 '.NET version:'
check GET /platform             200 '"CC_APP_NAME"'

# The minimal API routes, unchanged
check GET /plaintext            200 'Hello, World!'
check GET /json                 200 '{"message":"Hello, World!"}'
check GET /hello/Clever         200 'Hello, Clever!'
check GET /outer/outerget       200 "I'm nested."
check GET /outer/inner/innerget 200 "I'm more nested. | nested filter! | /inner filter! Tags: (null)"
check GET /outer/inner/group/jukebox/nested/a-side 200 'Hello from jukebox:a-side! | nested filter! | /inner filter! Tags: nested, more, tags'
check GET /todo/3               200 '{"id":3,"title":"Walk the dog"}'
check GET /todo/0               400 'HTTP'
check GET /todo/42              404 'HTTP'
check GET /todos                200 'Come back home'
check POST /todos               200 'I was bound from IBindableFromHttpContext' '{"id":7,"title":"Play it again"}'
check GET /problem/plain        500 '"traceId":"traceId123"'
check GET /problem/object       500 'application/problem+json'
check GET /problem/validation   400 'The Title field is required.'
check GET /problem/objectValidation 400 'The Title field is required.'
check GET /problem/validationTyped  400 'The Title field is required.'
check GET /problem/encore       404 'HTTP'
check GET /null-result          500 'HTTP'

printf '\n%d passed, %d failed on %s\n' "$passed" "$failed" "$base"
[[ "$failed" -eq 0 ]]
