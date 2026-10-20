#!/usr/bin/env bash
# Puts the previous version back after a failed deployment (issue #13):
# ./rollback.sh <base URL> <previous commit SHA> <failed commit SHA>
#
# Runs on the CI runner after deploy.sh or smoke-test.sh failed, and by the manual
# rollback workflow through the same deploy action. It runs deploy.sh on the server with
# the previous SHA, then smoke-test.sh must see that SHA on /health. The images of the
# previous version are pulled again if they were removed from the server. The deploy job
# saves the compose file that was on the server as docker-compose.prod.yml.previous before
# it copies the new one, and this script puts it back first, so a bad compose change cannot
# also break the rollback.
#
# There is nothing to do (exit 0, with a notice) when no previous version is known,
# which happens on the first deployment to a server, or when the previous version is the
# commit that failed. The exit code is non-zero only if the rollback itself fails.
#
# APP_DIR (default /home/deploy/app) is the folder on the server. The result is also
# written to the run summary when GITHUB_STEP_SUMMARY is set.

set -euo pipefail

readonly APP_DIR="${APP_DIR:-/home/deploy/app}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
readonly COMPOSE_FILE="docker-compose.prod.yml"
readonly SHA_PATTERN='^[0-9a-f]{40}$'

fail() {
  echo "rollback: $*" >&2
  exit 1
}

# summary <markdown line>... Adds lines to the run summary, if there is one.
summary() {
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    printf '%s\n' "$@" >> "$GITHUB_STEP_SUMMARY"
  fi
}

main() {
  local base_url="${1:-}"
  local previous_sha="${2:-}"
  local failed_sha="${3:-}"

  [[ "$base_url" =~ ^https?://[^/]+ ]] \
    || fail "usage: $0 <http(s) base URL> <previous commit SHA or empty> <failed commit SHA>"
  [[ -z "$previous_sha" || "$previous_sha" =~ $SHA_PATTERN ]] \
    || fail "the previous commit SHA must be 40 lower-case hex characters, or empty"
  [[ "$failed_sha" =~ $SHA_PATTERN ]] || fail "the failed commit SHA must be 40 lower-case hex characters"

  if [[ -z "$previous_sha" ]]; then
    echo "rollback: no previous version is known for this server, nothing to roll back to."
    summary "### No rollback" "" "No version was running before \`$failed_sha\`, so there is nothing to go back to."
    return 0
  fi
  if [[ "$previous_sha" == "$failed_sha" ]]; then
    echo "rollback: the previous version is already the commit that was being deployed, nothing to do."
    summary "### No rollback" "" "\`$failed_sha\` was already running before this deployment."
    return 0
  fi

  echo "rollback: $failed_sha failed, putting $previous_sha back ($(date -u +%H:%M:%S) UTC)"
  # shellcheck disable=SC2029 # APP_DIR and the SHA are meant to expand on the runner
  if ! ssh server "if [ -f '$APP_DIR/$COMPOSE_FILE.previous' ]; then cp -f '$APP_DIR/$COMPOSE_FILE.previous' '$APP_DIR/$COMPOSE_FILE'; fi && bash '$APP_DIR/deploy.sh' '$previous_sha'"; then
    summary "### Rollback failed" "" \
      "\`$failed_sha\` failed, and redeploying \`$previous_sha\` failed too. Check the server by hand."
    fail "rollback failed: could not redeploy $previous_sha"
  fi
  if ! bash "$SCRIPT_DIR/smoke-test.sh" "$base_url" "$previous_sha"; then
    summary "### Rollback failed" "" \
      "\`$failed_sha\` failed. \`$previous_sha\` was redeployed but \`/health\` does not report it. Check the server by hand."
    fail "rollback failed: /health does not report $previous_sha"
  fi

  echo "rollback: rolled back to $previous_sha in $SECONDS seconds"
  summary "### Rolled back" "" \
    "\`$failed_sha\` failed its health check, so \`$previous_sha\` was deployed again and \`/health\` reports it. The rollback took $SECONDS seconds."
}

main "$@"
