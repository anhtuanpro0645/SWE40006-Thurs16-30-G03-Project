#!/usr/bin/env bash
# Tests for deploy/deploy.sh. Runs in CI and locally: bash deploy/tests/deploy.test.sh
#
# A fake "docker" command is put first on PATH. It records every call and can be told
# to fail the pull or the start, so the script is tested without a server or registry.

set -euo pipefail

SCRIPT_UNDER_TEST="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/deploy.sh"
readonly SCRIPT_UNDER_TEST
readonly SHA_A="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
readonly SHA_B="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

passed=0
failed=0

# Fresh app directory with the script, a compose file, a .env and a fake docker
setup() {
  WORK_DIR="$(mktemp -d)"
  APP="$WORK_DIR/app"
  mkdir -p "$APP" "$WORK_DIR/bin"
  cp "$SCRIPT_UNDER_TEST" "$APP/deploy.sh"
  echo "services: {}" > "$APP/docker-compose.prod.yml"
  echo "POSTGRES_USER=app" > "$APP/.env"
  CALLS="$WORK_DIR/docker-calls.log"
  : > "$CALLS"

  cat > "$WORK_DIR/bin/docker" <<'FAKE'
#!/usr/bin/env bash
echo "$*" >> "$FAKE_DOCKER_CALLS"
case " $* " in
  *" pull "*) [[ "${FAKE_PULL_FAILS:-}" == "1" ]] && exit 1 ;;
  *" up "*)   [[ "${FAKE_UP_FAILS:-}" == "1" ]] && exit 1 ;;
  *" prune "*) [[ "${FAKE_PRUNE_FAILS:-}" == "1" ]] && exit 1 ;;
esac
exit 0
FAKE
  chmod +x "$WORK_DIR/bin/docker"
}

teardown() {
  rm -rf "$WORK_DIR"
}

# Runs deploy.sh with the fake docker. Set FAKE_PULL_FAILS=1, FAKE_UP_FAILS=1 or
# FAKE_PRUNE_FAILS=1 first to make that docker step fail.
run_deploy() {
  PATH="$WORK_DIR/bin:$PATH" FAKE_DOCKER_CALLS="$CALLS" \
    FAKE_PULL_FAILS="${FAKE_PULL_FAILS:-}" FAKE_UP_FAILS="${FAKE_UP_FAILS:-}" \
    FAKE_PRUNE_FAILS="${FAKE_PRUNE_FAILS:-}" \
    bash "$APP/deploy.sh" "$@" > "$WORK_DIR/out.log" 2>&1
}

deploy_fails() { ! run_deploy "$@"; }

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

file_is() { [[ -f "$1" && "$(cat "$1")" == "$2" ]]; }
no_file() { [[ ! -e "$1" ]]; }
calls_contain() { grep -q -- "$1" "$CALLS"; }
calls_lack() { ! grep -q -- "$1" "$CALLS"; }
output_contains() { grep -q -- "$1" "$WORK_DIR/out.log"; }

test_rejects_missing_or_short_sha() {
  setup
  check "no argument exits non-zero" deploy_fails
  check "short SHA exits non-zero" deploy_fails "abc123"
  check "upper-case SHA exits non-zero" deploy_fails "${SHA_A^^}"
  check "SHA with shell characters exits non-zero" deploy_fails "$SHA_A; rm -rf /"
  check "docker is never called for a bad SHA" calls_lack "compose"
  teardown
}

test_fails_without_env_file() {
  setup
  rm "$APP/.env"
  check "missing .env exits non-zero" deploy_fails "$SHA_A"
  check "error names the missing .env" output_contains ".env is missing"
  check "docker is never called without .env" calls_lack "compose"
  teardown
}

test_first_deploy() {
  setup
  check "deploy succeeds" run_deploy "$SHA_A"
  check "image.env holds the deployed SHA" file_is "$APP/image.env" "IMAGE_TAG=$SHA_A"
  check "no image.env.previous on the first deploy" no_file "$APP/image.env.previous"
  check "no image.env.next is left behind" no_file "$APP/image.env.next"
  check "images are pulled" calls_contain " pull "
  check "stack is started and waited on" calls_contain "up --detach --remove-orphans --wait"
  check "both env files are passed to compose" calls_contain "--env-file $APP/.env --env-file $APP/image.env"
  teardown
}

test_second_deploy_keeps_previous_version() {
  setup
  run_deploy "$SHA_A"
  check "second deploy succeeds" run_deploy "$SHA_B"
  check "image.env holds the new SHA" file_is "$APP/image.env" "IMAGE_TAG=$SHA_B"
  check "image.env.previous holds the old SHA" file_is "$APP/image.env.previous" "IMAGE_TAG=$SHA_A"
  teardown
}

test_redeploying_same_sha_keeps_previous_version() {
  setup
  run_deploy "$SHA_A"
  run_deploy "$SHA_B"
  check "redeploy of the same SHA succeeds" run_deploy "$SHA_B"
  check "image.env.previous still holds the older SHA" file_is "$APP/image.env.previous" "IMAGE_TAG=$SHA_A"
  teardown
}

test_failed_pull_leaves_running_version_alone() {
  setup
  run_deploy "$SHA_A"
  : > "$CALLS"
  FAKE_PULL_FAILS=1 check "failed pull exits non-zero" deploy_fails "$SHA_B"
  check "image.env still holds the running SHA" file_is "$APP/image.env" "IMAGE_TAG=$SHA_A"
  check "no image.env.next is left behind" no_file "$APP/image.env.next"
  check "containers are not restarted" calls_lack " up "
  check "error says the running version was not changed" output_contains "was not changed"
  teardown
}

test_unhealthy_start_fails_the_deploy() {
  setup
  FAKE_UP_FAILS=1 check "unhealthy start exits non-zero" deploy_fails "$SHA_A"
  check "error says the containers did not become healthy" output_contains "did not become healthy"
  check "container status is printed for debugging" calls_contain " ps"
  teardown
}

test_failed_cleanup_does_not_fail_a_healthy_deploy() {
  setup
  FAKE_PRUNE_FAILS=1 check "deploy still succeeds when image prune fails" run_deploy "$SHA_A"
  check "image.env holds the deployed SHA" file_is "$APP/image.env" "IMAGE_TAG=$SHA_A"
  check "a warning says the cleanup failed" output_contains "warning: could not remove old images"
  check "old images are pruned on a normal deploy" calls_contain "image prune"
  teardown
}

echo "deploy.sh"
test_rejects_missing_or_short_sha
test_fails_without_env_file
test_first_deploy
test_second_deploy_keeps_previous_version
test_redeploying_same_sha_keeps_previous_version
test_failed_pull_leaves_running_version_alone
test_unhealthy_start_fails_the_deploy
test_failed_cleanup_does_not_fail_a_healthy_deploy

echo
echo "$passed passed, $failed failed"
[[ "$failed" -eq 0 ]]
