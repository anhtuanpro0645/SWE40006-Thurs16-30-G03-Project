#!/usr/bin/env bash
# Prints the commit SHA that is running on the server, or nothing if there is none:
# ./current-sha.sh
#
# Runs on the CI runner (issue #13), after setup-ssh.sh, and reads image.env on the server
# over the "server" SSH host. The deploy job calls it before deploying, so that
# rollback.sh knows which version to go back to if the new one fails.
#
# A server that has never been deployed has no image.env. That is not an error: the
# script prints nothing and exits 0. APP_DIR (default /home/deploy/app) is the folder
# on the server.

set -euo pipefail

readonly APP_DIR="${APP_DIR:-/home/deploy/app}"

main() {
  local content tag
  # shellcheck disable=SC2029 # APP_DIR is meant to expand on the runner
  content="$(ssh server "cat '$APP_DIR/image.env'" 2>/dev/null)" || return 0
  tag="$(sed -n 's/^IMAGE_TAG=//p' <<< "$content" | head -n 1 | tr -d '\r')"
  if [[ "$tag" =~ ^[0-9a-f]{40}$ ]]; then
    echo "$tag"
  fi
}

main
