#!/usr/bin/env bash
# Checks that a server runs a given commit: ./smoke-test.sh <base URL> <full commit SHA>
#
# Passes when <base URL>/health answers HTTP 200 with "version" equal to the SHA.
# Retries, because the containers may still be starting. Used by the deploy jobs after
# deploy.sh (issues #11 and #16), and can be run by hand from any machine.
#
# SMOKE_TEST_ATTEMPTS (default 12) and SMOKE_TEST_DELAY_SECONDS (default 5) set how long
# it keeps trying: one minute by default.

set -euo pipefail

readonly ATTEMPTS="${SMOKE_TEST_ATTEMPTS:-12}"
readonly DELAY_SECONDS="${SMOKE_TEST_DELAY_SECONDS:-5}"
readonly REQUEST_TIMEOUT_SECONDS=5

fail() {
  echo "smoke test: $*" >&2
  exit 1
}

main() {
  # Secrets pasted on Windows can carry spaces or "\r"; a trailing slash is also allowed
  local base_url
  base_url="$(printf '%s' "${1:-}" | tr -d '\r[:space:]')"
  base_url="${base_url%/}"
  local expected_sha="${2:-}"

  [[ "$base_url" =~ ^https?://[^/]+ ]] || fail "usage: $0 <http(s) base URL> <full commit SHA>"
  [[ "$expected_sha" =~ ^[0-9a-f]{40}$ ]] || fail "usage: $0 <http(s) base URL> <full 40-character commit SHA>"

  local url="$base_url/health"
  local attempt body version
  for attempt in $(seq 1 "$ATTEMPTS"); do
    if body="$(curl --silent --show-error --fail --max-time "$REQUEST_TIMEOUT_SECONDS" "$url")"; then
      version="$(jq -r '.version // empty' <<< "$body" 2>/dev/null || true)"
      if [[ "$version" == "$expected_sha" ]]; then
        echo "Attempt $attempt: /health is ok and reports $version"
        return 0
      fi
      echo "Attempt $attempt: /health answered, but reports version '$version'"
    else
      echo "Attempt $attempt: /health did not answer with 200"
    fi
    if [[ "$attempt" -lt "$ATTEMPTS" ]]; then
      sleep "$DELAY_SECONDS"
    fi
  done

  fail "/health never reported $expected_sha after $ATTEMPTS attempts"
}

main "$@"
