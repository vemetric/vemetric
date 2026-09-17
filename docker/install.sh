#!/usr/bin/env bash
# Vemetric self hosting installer.
#
#   curl -fsSL https://raw.githubusercontent.com/vemetric/vemetric/main/docker/install.sh | bash
#
# Installs a complete Vemetric stack (dashboard, event hub, worker, Postgres, ClickHouse,
# Redis and a Caddy reverse proxy with automatic TLS) into /opt/vemetric, creates the
# administrator account and prints its credentials.
set -euo pipefail

readonly REPO_RAW_URL="${VEMETRIC_REPO_RAW_URL:-https://raw.githubusercontent.com/vemetric/vemetric/main}"
readonly RELEASES_API_URL="${VEMETRIC_RELEASES_API_URL:-https://api.github.com/repos/vemetric/vemetric/releases/latest}"
readonly INSTALL_DIR="${VEMETRIC_DIR:-/opt/vemetric}"
readonly ENV_FILE="$INSTALL_DIR/.env"
readonly COMPOSE_FILE="$INSTALL_DIR/docker-compose.selfhost.yml"
readonly BOOTSTRAP_SCRIPT='apps/app/src/backend/scripts/bootstrap-admin.ts'

readonly DOMAIN_PATTERN='^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$'
readonly EMAIL_PATTERN='^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
readonly PORT_PATTERN='^[0-9]{1,5}$'

info() { printf '\033[0;36m%s\033[0m\n' "$*"; }
success() { printf '\033[0;32m%s\033[0m\n' "$*"; }
warn() { printf '\033[0;33m%s\033[0m\n' "$*"; }
fail() {
  printf '\033[0;31mError: %s\033[0m\n' "$*" >&2
  exit 1
}

# Reads from the terminal instead of stdin, so the script stays interactive when piped into bash.
prompt() {
  local message="$1" default="${2:-}" answer=''

  if [ ! -t 0 ] && [ ! -r /dev/tty ]; then
    fail "No terminal available for input. Set the configuration through environment variables instead."
  fi

  if [ -n "$default" ]; then
    printf '%s [%s]: ' "$message" "$default" >/dev/tty
  else
    printf '%s: ' "$message" >/dev/tty
  fi

  IFS= read -r answer </dev/tty
  printf '%s' "${answer:-$default}"
}

prompt_secret() {
  local message="$1" answer=''
  printf '%s: ' "$message" >/dev/tty
  IFS= read -rs answer </dev/tty
  printf '\n' >/dev/tty
  printf '%s' "$answer"
}

prompt_validated() {
  local message="$1" default="$2" pattern="$3" error="$4" value=''

  while true; do
    value="$(prompt "$message" "$default")"
    if [[ "$value" =~ $pattern ]]; then
      printf '%s' "$value"
      return 0
    fi
    printf '\033[0;31m%s\033[0m\n' "$error" >/dev/tty
  done
}

prompt_yes_no() {
  local message="$1" default="$2" answer=''

  while true; do
    answer="$(prompt "$message" "$default")"
    case "$(printf '%s' "$answer" | tr '[:upper:]' '[:lower:]')" in
      y | yes) return 0 ;;
      n | no) return 1 ;;
      *) printf '\033[0;31mAnswer with y or n.\033[0m\n' >/dev/tty ;;
    esac
  done
}

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
    return 0
  fi
  head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
}

# Password of the generated admin account. The alphabet leaves out characters that are easy to
# confuse when read off a terminal; at 24 characters that costs no entropy worth caring about.
#
# The random source is read in fixed sized chunks instead of piping /dev/urandom into `head`:
# that pipeline makes `tr` die of SIGPIPE, which `set -o pipefail` turns into a failed install.
generate_password() {
  local alphabet='abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  local length=24 pool=''

  while [ "${#pool}" -lt "$length" ]; do
    pool+="$(head -c 256 /dev/urandom | LC_ALL=C tr -dc "$alphabet")"
  done

  printf '%s' "${pool:0:$length}"
}

# Escapes a value for the generated .env file. Docker Compose interpolates variables in env
# files, so a literal dollar sign has to be doubled or everything after it is silently
# replaced with the (usually empty) value of a variable name.
escape_env_value() {
  # Both the pattern and the replacement need a backslash: unescaped, the replacement `$$`
  # would expand to the process id of the shell.
  printf '%s' "${1//\$/\$\$}"
}

# Resolves the version to pin the images to. Without a pin an unattended `pull && up -d`
# would silently jump across releases, including breaking migrations. Falls back to the
# floating `latest` tag when the release cannot be resolved, which is no worse than before.
#
# Release tags are named `vX.Y.Z` while the published image tags drop the leading `v`, so the
# prefix is stripped here.
resolve_version() {
  local response='' tag=''

  if response="$(curl -fsSL --max-time 10 -H 'Accept: application/vnd.github+json' \
    "$RELEASES_API_URL" 2>/dev/null)"; then
    tag="$(printf '%s' "$response" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
  fi

  tag="${tag#v}"

  if [ -n "$tag" ]; then
    printf '%s' "$tag"
  else
    printf 'latest'
  fi
}

require_dependencies() {
  command -v docker >/dev/null 2>&1 || fail "Docker is not installed. See https://docs.docker.com/engine/install/"
  docker compose version >/dev/null 2>&1 || fail "The Docker Compose plugin is missing. See https://docs.docker.com/compose/install/"
  docker info >/dev/null 2>&1 || fail "Cannot talk to the Docker daemon. Start Docker, or run this script with sudo."
  command -v curl >/dev/null 2>&1 || fail "curl is not installed."
}

download_stack() {
  info "Downloading the stack definition into $INSTALL_DIR..."
  mkdir -p "$INSTALL_DIR/docker" "$INSTALL_DIR/docker/clickhouse/users.d"
  curl -fsSL "$REPO_RAW_URL/docker-compose.selfhost.yml" -o "$COMPOSE_FILE"
  curl -fsSL "$REPO_RAW_URL/docker/Caddyfile" -o "$INSTALL_DIR/docker/Caddyfile"
  curl -fsSL "$REPO_RAW_URL/docker/caddy-entrypoint.sh" -o "$INSTALL_DIR/docker/caddy-entrypoint.sh"
  curl -fsSL "$REPO_RAW_URL/docker/clickhouse/users.d/zz-remove-default-user.xml" \
    -o "$INSTALL_DIR/docker/clickhouse/users.d/zz-remove-default-user.xml"
}

write_env_file() {
  local domain="$1" acme_email="$2" scheme="$3"
  local smtp_host="$4" smtp_port="$5" smtp_user="$6" smtp_password="$7" mail_from="$8"
  local version="$9" root_origin="${10}"

  # Everything the operator typed goes through escape_env_value. Generated secrets are
  # hexadecimal and the admin password uses an alphanumeric alphabet, so neither can contain
  # a dollar sign.
  domain="$(escape_env_value "$domain")"
  acme_email="$(escape_env_value "$acme_email")"
  smtp_host="$(escape_env_value "$smtp_host")"
  smtp_port="$(escape_env_value "$smtp_port")"
  smtp_user="$(escape_env_value "$smtp_user")"
  smtp_password="$(escape_env_value "$smtp_password")"
  mail_from="$(escape_env_value "$mail_from")"
  root_origin="$(escape_env_value "$root_origin")"

  # The env file holds every secret of the installation, so it is created with a strict umask.
  (
    umask 077
    cat >"$ENV_FILE" <<ENVFILE
# Generated by the Vemetric installer on $(date -u '+%Y-%m-%dT%H:%M:%SZ')

# Image tag every service is pinned to. Updating is a deliberate step: raise this value, then
# pull and recreate the stack, so a release with breaking migrations is never crossed by
# accident. See docs/self-hosting.md.
VEMETRIC_VERSION=$version

DOMAIN=$domain
APP_ORIGIN=$scheme://app.$domain
HUB_ORIGIN=$scheme://hub.$domain
# Optional. Empty means the bare domain is not served at all, which is the right setting
# unless it has its own DNS record. A value equal to APP_ORIGIN is ignored, because the same
# site cannot be declared twice.
ROOT_ORIGIN=$root_origin
ACME_EMAIL=$acme_email

BETTER_AUTH_URL=$scheme://app.$domain
BETTER_AUTH_SECRET=$(generate_secret)
EMAIL_TOKEN_SECRET=$(generate_secret)

# Optional social login, see "Social login" in docs/self-hosting.md. A provider is offered only
# when both of its values are set. Setting just one of them makes the app refuse to start.
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# The installer creates the administrator account directly, so the signup screen stays closed.
# Team invitations keep working with this off: anyone holding a valid invitation link can sign
# up, and the link is consumed by that signup. Only "true" and "false" are accepted, anything else makes
# the app refuse to start.
ALLOW_REGISTRATION=false

POSTGRES_USER=vemetric
POSTGRES_PASSWORD=$(generate_secret)
POSTGRES_DB=vemetric

CLICKHOUSE_USER=vemetric
CLICKHOUSE_PASSWORD=$(generate_secret)
CLICKHOUSE_DB=vemetric

REDIS_PASSWORD=$(generate_secret)

# Mail is only needed for password resets. With an empty SMTP_HOST that flow fails; everything
# else works, including the administrator login and team invitations, which are links copied
# from the dashboard rather than mails.
MAIL_PROVIDER=smtp
MAIL_FROM_ADDRESS=$mail_from
SMTP_HOST=$smtp_host
SMTP_PORT=$smtp_port
SMTP_USER=$smtp_user
SMTP_PASSWORD=$smtp_password
SMTP_TLS_REJECT_UNAUTHORIZED=true

BULLBOARD_USERNAME=bullboard
BULLBOARD_PASSWORD=$(generate_secret)
ENVFILE
  )
}

# Creates the administrator account inside a throwaway app container. The password travels
# through the environment rather than the argument list, which every local user can read.
bootstrap_admin() {
  local admin_email="$1" admin_password="$2" output=''

  if ! output="$(
    VEMETRIC_ADMIN_PASSWORD="$admin_password" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
      run --rm --no-deps -T -e VEMETRIC_ADMIN_PASSWORD app \
      bun run "$BOOTSTRAP_SCRIPT" --email "$admin_email" 2>&1
  )"; then
    printf '%s\n' "$output" >&2
    return 1
  fi

  return 0
}

main() {
  info "Vemetric self hosting installer"
  require_dependencies

  if [ -f "$ENV_FILE" ]; then
    fail "$ENV_FILE already exists. Remove the directory to reinstall, or run 'docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d' to update."
  fi

  local domain acme_email scheme
  domain="$(prompt_validated "Domain (the dashboard runs on app.<domain>)" "" "$DOMAIN_PATTERN" "Enter a valid domain, for example analytics.example.com")"

  if [[ "$domain" == *.localhost ]]; then
    scheme="http"
    acme_email="admin@localhost"
  else
    scheme="https"
    acme_email="$(prompt_validated "Email address for Let's Encrypt" "" "$EMAIL_PATTERN" "Enter a valid email address")"
  fi

  # The bare domain is served only on request. It needs a DNS record of its own, and without
  # one Caddy would keep retrying a certificate order that cannot succeed.
  local root_origin=""
  if prompt_yes_no "Redirect $domain to the dashboard as well? Needs a DNS record for $domain. (y/n)" "n"; then
    root_origin="$scheme://$domain"
  fi

  info ""
  info "Administrator account. The installer creates it directly and prints the password at the end."
  local admin_email admin_password
  admin_email="$(prompt_validated "Admin email address" "$acme_email" "$EMAIL_PATTERN" "Enter a valid email address")"
  admin_password="$(generate_password)"

  info ""
  info "SMTP server. Only needed for password reset emails, so it can be"
  info "skipped and added to $ENV_FILE later."
  local smtp_host="" smtp_port="" smtp_user="" smtp_password="" mail_from=""
  if prompt_yes_no "Configure SMTP now? (y/n)" "n"; then
    smtp_host="$(prompt_validated "SMTP host" "" "^[^[:space:]]+$" "Enter the hostname of your SMTP server")"
    smtp_port="$(prompt_validated "SMTP port" "587" "$PORT_PATTERN" "Enter a port number")"
    smtp_user="$(prompt "SMTP username (leave empty for an unauthenticated relay)" "")"
    if [ -n "$smtp_user" ]; then
      smtp_password="$(prompt_secret "SMTP password")"
      [ -n "$smtp_password" ] || fail "SMTP password must not be empty when a username is set."
    fi
    mail_from="$(prompt_validated "Sender address" "vemetric@$domain" "$EMAIL_PATTERN" "Enter a valid email address")"
  fi

  download_stack

  local version
  version="$(resolve_version)"
  if [ "$version" = "latest" ]; then
    warn "Could not resolve the latest release, falling back to the floating 'latest' image tag."
  else
    info "Pinning the installation to version $version."
  fi

  write_env_file "$domain" "$acme_email" "$scheme" "$smtp_host" "$smtp_port" "$smtp_user" "$smtp_password" "$mail_from" "$version" "$root_origin"

  # Caddy is deliberately left out of this first start. It is the only service bound to the
  # public ports, and until the administrator account exists the signup screen would hand the
  # instance to whoever reaches it first: the registration guard always lets the very first
  # account through, whatever ALLOW_REGISTRATION says.
  info ""
  info "Pulling images and starting the stack. The first start applies all database migrations."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d app hub worker

  info ""
  info "Creating the administrator account..."
  if ! bootstrap_admin "$admin_email" "$admin_password"; then
    warn ""
    warn "The administrator account could not be created, so the stack was left unreachable"
    warn "from the outside: the reverse proxy has not been started."
    warn "Fix the problem, then run the bootstrap again and start the proxy:"
    warn "  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d"
    exit 1
  fi

  info ""
  info "Starting the reverse proxy..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

  success ""
  success "Vemetric is running."
  success ""
  success "  Dashboard:  $scheme://app.$domain"
  success "  Event hub:  $scheme://hub.$domain"
  success ""
  success "  Login:      $admin_email"
  success "  Password:   $admin_password"
  success ""
  success "Store the password now, it is not shown again. You can change it in the dashboard"
  success "under Settings after logging in."
  success ""
  success "Point app.$domain and hub.$domain at this server, then open the dashboard and create"
  success "your first project. Signups stay closed, but invited team members can register with"
  success "their invitation link without any change to the configuration."
  success ""
  success "Configuration: $ENV_FILE"
  success "Version:       $version (raise VEMETRIC_VERSION in $ENV_FILE to update)"
}

main "$@"
