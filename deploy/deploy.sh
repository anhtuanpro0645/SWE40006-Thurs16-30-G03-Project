#!/usr/bin/env bash
# Deploys one commit to this server: ./deploy.sh <full commit SHA>
#
# Run by the CI deploy jobs over SSH (issues #11 and #16). It can also be run by hand
# on a server, for example to redeploy a known good commit.
#
# 1. Pull both images for the commit from GHCR (public packages, no login needed)
# 2. Only if the pull worked, save the commit in image.env (the old value is kept in
#    image.env.previous for rollback, issue #13)
# 3. Start the stack and wait until every container reports healthy
#
# If step 1 fails, the running containers are not touched.

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly APP_DIR
readonly COMPOSE_FILE="docker-compose.prod.yml"
readonly WAIT_TIMEOUT_SECONDS=180
# Unused images older than this are removed after a successful deployment.
# Older commits can still be pulled again from GHCR.
readonly KEEP_UNUSED_IMAGES_FOR="168h"

fail() {
  echo "deploy: $*" >&2
  exit 1
}

# compose <image env file name> <compose arguments...>
# Always uses absolute paths, so it works from any working directory.
compose() {
  docker compose --project-directory "$APP_DIR" -f "$APP_DIR/$COMPOSE_FILE" \
    --env-file "$APP_DIR/.env" --env-file "$APP_DIR/$1" "${@:2}"
}

main() {
  local image_tag="${1:-}"
  [[ "$image_tag" =~ ^[0-9a-f]{40}$ ]] || fail "usage: $0 <full 40-character commit SHA>"

  cd "$APP_DIR"
  [[ -f .env ]] || fail "$APP_DIR/.env is missing. Create it first (see docs/CONVENTIONS.md, Deployment)."
  [[ -f "$COMPOSE_FILE" ]] || fail "$APP_DIR/$COMPOSE_FILE is missing."

  echo "deploy: pulling images for $image_tag"
  printf 'IMAGE_TAG=%s\n' "$image_tag" > image.env.next
  if ! compose image.env.next pull --quiet; then
    rm -f image.env.next
    fail "could not pull the images for $image_tag. The running version was not changed."
  fi

  if [[ -f image.env ]] && ! cmp -s image.env image.env.next; then
    cp image.env image.env.previous
  fi
  mv image.env.next image.env

  echo "deploy: starting $image_tag"
  compose image.env up --detach --remove-orphans --wait --wait-timeout "$WAIT_TIMEOUT_SECONDS" \
    || { compose image.env ps; fail "containers did not become healthy within ${WAIT_TIMEOUT_SECONDS}s"; }

  compose image.env ps
  # The new version is already healthy, so a failed cleanup must not fail the deployment
  if ! docker image prune --all --force --filter "until=$KEEP_UNUSED_IMAGES_FOR" > /dev/null; then
    echo "deploy: warning: could not remove old images (the deployment itself succeeded)" >&2
  fi
  echo "deploy: $image_tag is running"
}

main "$@"
