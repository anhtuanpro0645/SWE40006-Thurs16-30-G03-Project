#!/usr/bin/env bash
# Tests for deploy/smoke-test.sh. Runs in CI and locally: bash deploy/tests/smoke-test.test.sh
#
# A fake "curl" command is put first on PATH. Each call answers with the next line of a
# script of responses, so retries, wrong versions and outages are tested without a server.
# A response line is either "ok <json body>" (HTTP 200) or "fail" (no answer or non-200).

set -euo pipefail

SCRIPT_UNDER_TEST="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/smoke-test.sh"
readonly SCRIPT_UNDER_TEST
readonly URL="http://203.0.113.10"
readonly SHA="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
readonly OLD_SHA="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

passed=0
failed=0

setup() {
  WORK_DIR="$(mktemp -d)"
  mkdir -p "$WORK_DIR/bin"
  RESPONSES="$WORK_DIR/responses"
  CALLS="$WORK_DIR/curl-calls.log"
  : > "$RESPONSES"
  : > "$CALLS"

  cat > "$WORK_DIR/bin/curl" <<'FAKE'
#!/usr/bin/env bash
echo "$*" >> "$FAKE_CURL_CALLS"
line_number=$(wc -l < "$FAKE_CURL_CALLS")
response="$(sed -n "${line_number}p" "$FAKE_CURL_RESPONSES")"
case "$response" in
  ok\ *) echo "${response#ok }" ;;
  *) echo "curl: (7) Failed to connect" >&2; exit 7 ;;
esac
FAKE
  chmod +x "$WORK_DIR/bin/curl"
}

teardown() {
  rm -rf "$WORK_DIR"
}

respond() {
  printf '%s\n' "$@" >> "$RESPONSES"
}

health() {
  printf 'ok {"status":"ok","db":"ok","version":"%s"}' "$1"
}

run_smoke_test() {
  PATH="$WORK_DIR/bin:$PATH" FAKE_CURL_CALLS="$CALLS" FAKE_CURL_RESPONSES="$RESPONSES" \
    SMOKE_TEST_ATTEMPTS=3 SMOKE_TEST_DELAY_SECONDS=0 \
    bash "$SCRIPT_UNDER_TEST" "$@" > "$WORK_DIR/out.log" 2>&1
}

smoke_test_fails() { ! run_smoke_test "$@"; }

check() {
  local description="$1"
  shift
  if "$@"; then
    passed=$((passed + 1))
    echo "  ok   $description"
  else
    failed=$((failed + 1))
    echo "  FAIL $description"
    sed 's/^/       | /' "$WORK_DIR/out.log"
  fi
}

attempts_were() { [[ "$(wc -l < "$CALLS")" -eq "$1" ]]; }
calls_contain() { grep -q -- "$1" "$CALLS"; }
output_contains() { grep -q -- "$1" "$WORK_DIR/out.log"; }

test_passes_when_health_reports_the_sha() {
  setup
  respond "$(health "$SHA")"
  check "passes on the first attempt" run_smoke_test "$URL" "$SHA"
  check "only one request is made" attempts_were 1
  check "requests <url>/health" calls_contain "$URL/health"
  check "fails on HTTP errors instead of reading an error page" calls_contain "--fail"
  check "sets a timeout on each request" calls_contain "--max-time"
  teardown
}

test_retries_until_the_new_version_answers() {
  setup
  respond "fail" "$(health "$OLD_SHA")" "$(health "$SHA")"
  check "passes once the new SHA is reported" run_smoke_test "$URL" "$SHA"
  check "took three attempts" attempts_were 3
  check "logs the old version it saw" output_contains "reports version '$OLD_SHA'"
  teardown
}

test_fails_when_the_old_version_keeps_running() {
  setup
  respond "$(health "$OLD_SHA")" "$(health "$OLD_SHA")" "$(health "$OLD_SHA")"
  check "fails after the last attempt" smoke_test_fails "$URL" "$SHA"
  check "stops after SMOKE_TEST_ATTEMPTS" attempts_were 3
  check "error names the expected SHA" output_contains "never reported $SHA"
  teardown
}

test_fails_when_nothing_answers() {
  setup
  respond "fail" "fail" "fail"
  check "fails when /health never answers" smoke_test_fails "$URL" "$SHA"
  check "logs the failed attempts" output_contains "did not answer with 200"
  teardown
}

test_fails_when_version_is_missing() {
  setup
  respond 'ok {"status":"ok"}' 'ok not json' 'ok {"version":null}'
  check "fails when the body has no usable version" smoke_test_fails "$URL" "$SHA"
  teardown
}

test_trims_the_url() {
  setup
  respond "$(health "$SHA")"
  check "accepts a URL with a trailing slash, spaces and a CR" run_smoke_test $' http://203.0.113.10/ \r' "$SHA"
  check "requests exactly <url>/health" calls_contain " $URL/health"
  teardown
}

test_rejects_bad_arguments() {
  setup
  check "no arguments exit non-zero" smoke_test_fails
  check "a short SHA exits non-zero" smoke_test_fails "$URL" "abc123"
  check "a URL without http(s) exits non-zero" smoke_test_fails "203.0.113.10" "$SHA"
  check "curl is never called for bad arguments" attempts_were 0
  teardown
}

echo "smoke-test.sh"
test_passes_when_health_reports_the_sha
test_retries_until_the_new_version_answers
test_fails_when_the_old_version_keeps_running
test_fails_when_nothing_answers
test_fails_when_version_is_missing
test_trims_the_url
test_rejects_bad_arguments

echo
echo "$passed passed, $failed failed"
[[ "$failed" -eq 0 ]]
