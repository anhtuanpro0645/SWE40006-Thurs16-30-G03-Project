#!/usr/bin/env bash
# Tests for deploy/setup-ssh.sh. Runs in CI and locally: bash deploy/tests/setup-ssh.test.sh
#
# HOME points at a temporary directory, so the real ~/.ssh is never touched.

set -euo pipefail

SCRIPT_UNDER_TEST="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/setup-ssh.sh"
readonly SCRIPT_UNDER_TEST
readonly KEY=$'-----BEGIN OPENSSH PRIVATE KEY-----\nAAAA\n-----END OPENSSH PRIVATE KEY-----'
readonly HOST_KEY_LINE="203.0.113.10 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIF8RqSkO"

passed=0
failed=0

setup() {
  WORK_DIR="$(mktemp -d)"
}

teardown() {
  rm -rf "$WORK_DIR"
}

# Runs setup-ssh.sh with the given values for SSH_HOST, SSH_USER, SSH_KEY, KNOWN_HOSTS
run_setup() {
  HOME="$WORK_DIR" SSH_HOST="$1" SSH_USER="$2" SSH_KEY="$3" KNOWN_HOSTS="$4" \
    bash "$SCRIPT_UNDER_TEST" > "$WORK_DIR/out.log" 2>&1
}

setup_fails() { ! run_setup "$@"; }

check() {
  local description="$1"
  shift
  if "$@"; then
    passed=$((passed + 1))
    echo "  ok   $description"
  else
    failed=$((failed + 1))
    echo "  FAIL $description"
    sed 's/^/       | /' "$WORK_DIR/out.log" 2> /dev/null || true
  fi
}

ssh_dir() { echo "$WORK_DIR/.ssh"; }
mode_is() { [[ "$(stat -c '%a' "$1")" == "$2" ]]; }
file_has_line() { grep -qxF -- "$2" "$1"; }
file_lacks_cr() { ! grep -q $'\r' "$1"; }
no_file() { [[ ! -e "$1" ]]; }
output_contains() { grep -q -- "$1" "$WORK_DIR/out.log"; }

test_writes_key_known_hosts_and_config() {
  setup
  check "succeeds with clean values" run_setup "203.0.113.10" "deploy" "$KEY" "$HOST_KEY_LINE"
  check "the .ssh folder is 700" mode_is "$(ssh_dir)" 700
  check "deploy_key is 600" mode_is "$(ssh_dir)/deploy_key" 600
  check "config is 600" mode_is "$(ssh_dir)/config" 600
  check "deploy_key ends with the END line" file_has_line "$(ssh_dir)/deploy_key" "-----END OPENSSH PRIVATE KEY-----"
  check "known_hosts holds the host key line" file_has_line "$(ssh_dir)/known_hosts" "$HOST_KEY_LINE"
  check "config names the host" file_has_line "$(ssh_dir)/config" "  HostName 203.0.113.10"
  check "config names the user" file_has_line "$(ssh_dir)/config" "  User deploy"
  check "config keeps strict host key checking on" file_has_line "$(ssh_dir)/config" "  StrictHostKeyChecking yes"
  check "config never prompts" file_has_line "$(ssh_dir)/config" "  BatchMode yes"
  check "config only uses the deploy key" file_has_line "$(ssh_dir)/config" "  IdentitiesOnly yes"
  teardown
}

test_cleans_values_pasted_on_windows() {
  setup
  check "succeeds with CR and spaces in every value" \
    run_setup $' 203.0.113.10\r\n' $'deploy\r\n' "${KEY//$'\n'/$'\r\n'}"$'\r\n' $'  '"$HOST_KEY_LINE"$'  \r\n\r\n'
  check "deploy_key has no CR" file_lacks_cr "$(ssh_dir)/deploy_key"
  check "known_hosts has no CR" file_lacks_cr "$(ssh_dir)/known_hosts"
  check "known_hosts line is trimmed" file_has_line "$(ssh_dir)/known_hosts" "$HOST_KEY_LINE"
  check "config host is trimmed" file_has_line "$(ssh_dir)/config" "  HostName 203.0.113.10"
  check "config user is trimmed" file_has_line "$(ssh_dir)/config" "  User deploy"
  teardown
}

test_refuses_missing_values() {
  setup
  check "empty host fails" setup_fails "" "deploy" "$KEY" "$HOST_KEY_LINE"
  check "error names the missing host" output_contains "SSH_HOST is empty"
  check "empty user fails" setup_fails "203.0.113.10" "" "$KEY" "$HOST_KEY_LINE"
  check "error names the missing user" output_contains "SSH_USER is empty"
  check "empty key fails" setup_fails "203.0.113.10" "deploy" "" "$HOST_KEY_LINE"
  check "empty known_hosts fails" setup_fails "203.0.113.10" "deploy" "$KEY" "   "
  check "error names the missing known_hosts" output_contains "KNOWN_HOSTS is empty"
  check "no key file is written when a value is missing" no_file "$(ssh_dir)/deploy_key"
  teardown
}

test_refuses_a_value_that_is_not_a_private_key() {
  setup
  check "a public key instead of the private key fails" \
    setup_fails "203.0.113.10" "deploy" "ssh-ed25519 AAAAC3Nza deploy" "$HOST_KEY_LINE"
  check "error says it is not a private key" output_contains "not an OpenSSH private key"
  teardown
}

test_never_prints_the_key() {
  setup
  run_setup "203.0.113.10" "deploy" "$KEY" "$HOST_KEY_LINE" || true
  check "the key is not in the output" bash -c "! grep -q 'AAAA' '$WORK_DIR/out.log'"
  teardown
}

echo "setup-ssh.sh"
test_writes_key_known_hosts_and_config
test_cleans_values_pasted_on_windows
test_refuses_missing_values
test_refuses_a_value_that_is_not_a_private_key
test_never_prints_the_key

echo
echo "$passed passed, $failed failed"
[[ "$failed" -eq 0 ]]
