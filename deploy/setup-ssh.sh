#!/usr/bin/env bash
# Prepares SSH on a CI runner so that "ssh server" reaches one deployment server.
#
# Reads four environment variables, set by the deploy jobs from the GitHub environment:
#   SSH_HOST      server address (secret)
#   SSH_USER      login user, e.g. "deploy" (environment variable, not a secret)
#   SSH_KEY       private key (secret)
#   KNOWN_HOSTS   the server's host key line from known_hosts (secret)
#
# Writes ~/.ssh/deploy_key, ~/.ssh/known_hosts and ~/.ssh/config with host key checking
# on, so the runner refuses to connect if the server's key ever changes. Values pasted
# on Windows often carry "\r" or stray spaces, so those are removed. Nothing is printed
# that could reveal the key.

set -euo pipefail

fail() {
  echo "setup-ssh: $*" >&2
  exit 1
}

# Removes carriage returns and leading or trailing spaces from every line, and empty lines
clean_lines() {
  printf '%s\n' "$1" | tr -d '\r' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//; /^$/d'
}

# Removes carriage returns and every space (host names and user names never contain any)
clean_word() {
  printf '%s' "$1" | tr -d '\r[:space:]'
}

main() {
  local host user key known_hosts
  host="$(clean_word "${SSH_HOST:-}")"
  user="$(clean_word "${SSH_USER:-}")"
  key="$(clean_lines "${SSH_KEY:-}")"
  known_hosts="$(clean_lines "${KNOWN_HOSTS:-}")"

  [[ -n "$host" ]] || fail "SSH_HOST is empty. Check the *_HOST secret of this environment."
  [[ -n "$user" ]] || fail "SSH_USER is empty. Check the *_USER variable of this environment."
  [[ -n "$key" ]] || fail "SSH_KEY is empty. Check the *_SSH_KEY secret of this environment."
  [[ -n "$known_hosts" ]] || fail "KNOWN_HOSTS is empty. Check the *_KNOWN_HOSTS secret of this environment."
  [[ "$key" == "-----BEGIN OPENSSH PRIVATE KEY-----"* ]] \
    || fail "SSH_KEY is not an OpenSSH private key (it should start with -----BEGIN OPENSSH PRIVATE KEY-----)."

  local ssh_dir="$HOME/.ssh"
  install -m 700 -d "$ssh_dir"
  (
    umask 077
    printf '%s\n' "$key" > "$ssh_dir/deploy_key"
    printf '%s\n' "$known_hosts" > "$ssh_dir/known_hosts"
    cat > "$ssh_dir/config" <<EOF
Host server
  HostName $host
  User $user
  IdentityFile $ssh_dir/deploy_key
  IdentitiesOnly yes
  StrictHostKeyChecking yes
  UserKnownHostsFile $ssh_dir/known_hosts
  BatchMode yes
  ConnectTimeout 15
  ServerAliveInterval 15
EOF
  )
  chmod 600 "$ssh_dir/deploy_key" "$ssh_dir/config"
  echo "setup-ssh: ready to connect to the server as $user"
}

main "$@"
