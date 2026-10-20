#!/usr/bin/env bash
# Tests for deploy/current-sha.sh and deploy/rollback.sh (issue #13).
# Runs in CI and locally: bash deploy/tests/rollback.test.sh
#
# A fake "ssh" command and a fake "smoke-test.sh" are used, so the scripts are tested
# without a server. The fake ssh records every command it receives.

set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly DEPLOY_DIR
readonly SHA_OLD="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
readonly SHA_NEW="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
readonly BASE_URL="http://203.0.113.10"

passed=0
failed=0

# Fresh folder with copies of both scripts, a fake ssh and a fake smoke-test.sh
setup() {
  WORK_DIR="$(mktemp -d)"
  SCRIPTS="$WORK_DIR/scripts"
  mkdir -p "$SCRIPTS" "$WORK_DIR/bin"
  cp "$DEPLOY_DIR/current-sha.sh" "$DEPLOY_DIR/rollback.sh" "$SCRIPTS/"
  SSH_CALLS="$WORK_DIR/ssh-calls.log"
  SMOKE_CALLS="$WORK_DIR/smoke-calls.log"
  SUMMARY="$WORK_DIR/summary.md"
  : > "$SSH_CALLS"
  : > "$SMOKE_CALLS"
  : > "$SUMMARY"

  cat > "$WORK_DIR/bin/ssh" <<'FAKE'
#!/usr/bin/env bash
echo "$*" >> "$FAKE_SSH_CALLS"
[[ "${FAKE_SSH_DOWN:-}" == "1" ]] && exit 255
case "$*" in
  *"cat "*)
    printf '%s' "${FAKE_IMAGE_ENV:-}"
    ;;
  *deploy.sh*)
    [[ "${FAKE_DEPLOY_FAILS:-}" == "1" ]] && exit 1
    ;;
esac
exit 0
FAKE
  chmod +x "$WORK_DIR/bin/ssh"

  cat > "$SCRIPTS/smoke-test.sh" <<'FAKE'
#!/usr/bin/env bash
echo "$*" >> "$FAKE_SMOKE_CALLS"
[[ "${FAKE_SMOKE_FAILS:-}" == "1" ]] && exit 1
exit 0
FAKE
  chmod +x "$SCRIPTS/smoke-test.sh"
}

teardown() {
  rm -rf "$WORK_DIR"
}

# Runs a script from the copy in $SCRIPTS with the fakes first on PATH.
# Optional FAKE_* variables select what the fakes do.
run_script() {
  local script="$1"
  shift
  PATH="$WORK_DIR/bin:$PATH" FAKE_SSH_CALLS="$SSH_CALLS" FAKE_SMOKE_CALLS="$SMOKE_CALLS" \
    FAKE_IMAGE_ENV="${FAKE_IMAGE_ENV:-}" FAKE_SSH_DOWN="${FAKE_SSH_DOWN:-}" \
    FAKE_DEPLOY_FAILS="${FAKE_DEPLOY_FAILS:-}" FAKE_SMOKE_FAILS="${FAKE_SMOKE_FAILS:-}" \
    GITHUB_STEP_SUMMARY="$SUMMARY" \
    bash "$SCRIPTS/$script" "$@" > "$WORK_DIR/out.log" 2>&1
}

script_fails() { ! run_script "$@"; }

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

output_is() { [[ "$(cat "$WORK_DIR/out.log")" == "$1" ]]; }
output_contains() { grep -q -- "$1" "$WORK_DIR/out.log"; }
ssh_contains() { grep -q -- "$1" "$SSH_CALLS"; }
ssh_not_called() { [[ ! -s "$SSH_CALLS" ]]; }
smoke_contains() { grep -q -- "$1" "$SMOKE_CALLS"; }
smoke_not_called() { [[ ! -s "$SMOKE_CALLS" ]]; }
summary_contains() { grep -q -- "$1" "$SUMMARY"; }

# --- current-sha.sh ---------------------------------------------------------

test_current_sha_prints_the_running_commit() {
  setup
  FAKE_IMAGE_ENV="IMAGE_TAG=$SHA_OLD"$'\n' check "script succeeds" run_script current-sha.sh
  FAKE_IMAGE_ENV="IMAGE_TAG=$SHA_OLD"$'\n' run_script current-sha.sh
  check "prints only the SHA" output_is "$SHA_OLD"
  check "reads image.env in the app folder" ssh_contains "/home/deploy/app/image.env"
  teardown
}

test_current_sha_uses_the_app_dir_variable() {
  setup
  APP_DIR=/srv/other FAKE_IMAGE_ENV="IMAGE_TAG=$SHA_OLD" run_script current-sha.sh || true
  check "reads image.env from APP_DIR" ssh_contains "/srv/other/image.env"
  teardown
}

test_current_sha_prints_nothing_on_a_new_server() {
  setup
  check "succeeds when image.env does not exist yet" run_script current-sha.sh
  run_script current-sha.sh
  check "prints nothing" output_is ""
  check "only a missing file is ignored on the server" ssh_contains "|| true"
  teardown
}

test_current_sha_fails_when_ssh_fails() {
  setup
  FAKE_SSH_DOWN=1 check "an SSH failure exits non-zero" script_fails current-sha.sh
  check "error says the server could not be reached" output_contains "could not read"
  teardown
}

test_current_sha_ignores_a_malformed_value() {
  setup
  FAKE_IMAGE_ENV="IMAGE_TAG=not-a-sha" run_script current-sha.sh
  check "prints nothing for a malformed tag" output_is ""
  FAKE_IMAGE_ENV="IMAGE_TAG=$SHA_OLD; rm -rf /" run_script current-sha.sh
  check "prints nothing for a tag with shell characters" output_is ""
  FAKE_IMAGE_ENV="" run_script current-sha.sh
  check "prints nothing for an empty file" output_is ""
  teardown
}

# The action must not hide a failing current-sha.sh: with "set -e", a failing $(...) inside the
# argument of echo does NOT stop the step, so the SHA has to be assigned on its own line first.
test_action_does_not_hide_a_failing_current_sha() {
  setup
  : > "$WORK_DIR/out.log" # check prints this file when a check fails
  local action="$DEPLOY_DIR/../.github/actions/deploy-to-server/action.yml"
  check "the SHA is assigned before it is echoed" \
    grep -qF 'sha="$(bash deploy/current-sha.sh)"' "$action"
  check "echo does not wrap the command substitution" \
    bash -c '! grep -qF "echo \"sha=\$(bash deploy/current-sha.sh)\"" "$1"' _ "$action"
  teardown
}

# --- rollback.sh ------------------------------------------------------------

test_rollback_rejects_bad_arguments() {
  setup
  check "no arguments exits non-zero" script_fails rollback.sh
  check "bad base URL exits non-zero" script_fails rollback.sh "not-a-url" "$SHA_OLD" "$SHA_NEW"
  check "bad previous SHA exits non-zero" script_fails rollback.sh "$BASE_URL" "abc" "$SHA_NEW"
  check "SHA with shell characters exits non-zero" \
    script_fails rollback.sh "$BASE_URL" "$SHA_OLD; rm -rf /" "$SHA_NEW"
  check "bad failed SHA exits non-zero" script_fails rollback.sh "$BASE_URL" "$SHA_OLD" "abc"
  check "ssh is never called for bad arguments" ssh_not_called
  teardown
}

test_rollback_redeploys_the_previous_commit() {
  setup
  check "rollback succeeds" run_script rollback.sh "$BASE_URL" "$SHA_OLD" "$SHA_NEW"
  check "deploy.sh runs on the server with the previous SHA" ssh_contains "deploy.sh' '$SHA_OLD'"
  check "the app folder is the default" ssh_contains "/home/deploy/app/deploy.sh"
  check "smoke test checks the previous SHA" smoke_contains "$BASE_URL $SHA_OLD"
  check "output says which commit is back" output_contains "rolled back"
  check "run summary names both commits" summary_contains "$SHA_NEW"
  check "run summary names the restored commit" summary_contains "$SHA_OLD"
  teardown
}

test_rollback_restores_the_previous_compose_file() {
  setup
  run_script rollback.sh "$BASE_URL" "$SHA_OLD" "$SHA_NEW"
  check "the saved compose file is copied back" \
    ssh_contains "docker-compose.prod.yml.previous' '/home/deploy/app/docker-compose.prod.yml'"
  check "the copy only happens if a saved file exists" ssh_contains "if \[ -f '/home/deploy/app/docker-compose.prod.yml.previous' \]"
  check "restore and deploy.sh run in one SSH call" ssh_contains "fi && bash '/home/deploy/app/deploy.sh' '$SHA_OLD'"
  teardown
}

test_rollback_reports_how_long_it_took() {
  setup
  run_script rollback.sh "$BASE_URL" "$SHA_OLD" "$SHA_NEW"
  check "output gives the duration" output_contains "rolled back to $SHA_OLD in [0-9]* seconds"
  check "run summary gives the duration" summary_contains "seconds"
  teardown
}

test_rollback_uses_the_app_dir_variable() {
  setup
  APP_DIR=/srv/other run_script rollback.sh "$BASE_URL" "$SHA_OLD" "$SHA_NEW" || true
  check "deploy.sh is taken from APP_DIR" ssh_contains "/srv/other/deploy.sh"
  teardown
}

test_rollback_skips_when_there_is_nothing_to_go_back_to() {
  setup
  check "empty previous SHA is not an error" run_script rollback.sh "$BASE_URL" "" "$SHA_NEW"
  check "ssh is not called" ssh_not_called
  check "smoke test is not called" smoke_not_called
  check "output explains why" output_contains "no previous version"
  teardown
}

test_rollback_skips_when_previous_is_the_failed_commit() {
  setup
  check "same SHA is not an error" run_script rollback.sh "$BASE_URL" "$SHA_NEW" "$SHA_NEW"
  check "ssh is not called" ssh_not_called
  check "output explains why" output_contains "already the commit that was being deployed"
  teardown
}

test_rollback_fails_when_the_redeploy_fails() {
  setup
  FAKE_DEPLOY_FAILS=1 check "failed redeploy exits non-zero" \
    script_fails rollback.sh "$BASE_URL" "$SHA_OLD" "$SHA_NEW"
  check "smoke test is not run after a failed redeploy" smoke_not_called
  check "output says the rollback failed" output_contains "rollback failed"
  check "run summary says the rollback failed" summary_contains "failed"
  teardown
}

test_rollback_fails_when_the_old_version_is_not_healthy() {
  setup
  FAKE_SMOKE_FAILS=1 check "failed smoke test exits non-zero" \
    script_fails rollback.sh "$BASE_URL" "$SHA_OLD" "$SHA_NEW"
  check "output says the rollback failed" output_contains "rollback failed"
  teardown
}

test_rollback_works_without_a_step_summary_file() {
  setup
  check "succeeds when GITHUB_STEP_SUMMARY is unset" \
    env -u GITHUB_STEP_SUMMARY PATH="$WORK_DIR/bin:$PATH" FAKE_SSH_CALLS="$SSH_CALLS" \
    FAKE_SMOKE_CALLS="$SMOKE_CALLS" bash "$SCRIPTS/rollback.sh" "$BASE_URL" "$SHA_OLD" "$SHA_NEW"
  teardown
}

echo "current-sha.sh"
test_current_sha_prints_the_running_commit
test_current_sha_uses_the_app_dir_variable
test_current_sha_prints_nothing_on_a_new_server
test_current_sha_fails_when_ssh_fails
test_current_sha_ignores_a_malformed_value

echo "deploy action"
test_action_does_not_hide_a_failing_current_sha

echo "rollback.sh"
test_rollback_rejects_bad_arguments
test_rollback_redeploys_the_previous_commit
test_rollback_restores_the_previous_compose_file
test_rollback_reports_how_long_it_took
test_rollback_uses_the_app_dir_variable
test_rollback_skips_when_there_is_nothing_to_go_back_to
test_rollback_skips_when_previous_is_the_failed_commit
test_rollback_fails_when_the_redeploy_fails
test_rollback_fails_when_the_old_version_is_not_healthy
test_rollback_works_without_a_step_summary_file

echo
echo "$passed passed, $failed failed"
[[ "$failed" -eq 0 ]]
