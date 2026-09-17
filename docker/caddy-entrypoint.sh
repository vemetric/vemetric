#!/bin/sh
# Generates the optional bare domain redirect before starting Caddy.
#
# A Caddyfile cannot express "declare this site only if a variable is set": an empty site
# address is a syntax error, and a ROOT_ORIGIN equal to APP_ORIGIN would declare the same site
# twice, which Caddy rejects as a duplicate. Both cases stop the proxy from starting at all.
#
# So the block is written to a snippet directory that the Caddyfile imports through a glob.
# A glob that matches nothing is not an error in Caddy, which is what makes the redirect
# genuinely optional.
set -eu

SNIPPET_DIR='/etc/caddy/conf.d'
SNIPPET="$SNIPPET_DIR/root-redirect.caddy"

: "${APP_ORIGIN:?APP_ORIGIN is required}"
ROOT_ORIGIN="${ROOT_ORIGIN:-}"

# Both values are written into a Caddyfile, so anything but a bare origin would be read as
# configuration. A hand edited .env containing a brace or a newline could otherwise append
# arbitrary directives to the generated block. Refuse such a value instead of writing it.
assert_origin() {
  local_name="$1"
  local_value="$2"

  # The line count is checked separately because grep matches line by line: a multi line
  # value whose last line looks like an origin would otherwise pass, and every line before it
  # would land in the Caddyfile as configuration.
  if [ "$(printf '%s\n' "$local_value" | wc -l)" -ne 1 ] ||
    ! printf '%s\n' "$local_value" | grep -Eq '^https?://[A-Za-z0-9.-]+(:[0-9]+)?$'; then
    printf 'Error: %s must be a single bare http(s) origin without a path, got "%s".\n' \
      "$local_name" "$local_value" >&2
    exit 1
  fi
}

assert_origin APP_ORIGIN "$APP_ORIGIN"
if [ -n "$ROOT_ORIGIN" ]; then
  assert_origin ROOT_ORIGIN "$ROOT_ORIGIN"
fi

mkdir -p "$SNIPPET_DIR"
# Removed first, so a container restart after ROOT_ORIGIN was cleared does not keep serving
# the old redirect from a snippet left behind by the previous run.
rm -f "$SNIPPET"

if [ -n "$ROOT_ORIGIN" ] && [ "$ROOT_ORIGIN" != "$APP_ORIGIN" ]; then
  # `{uri}` is a Caddy placeholder and has to reach the file literally. It survives the
  # unquoted heredoc because it carries no dollar sign.
  cat >"$SNIPPET" <<CADDY
# Bare domain points at the dashboard. Generated from ROOT_ORIGIN.
$ROOT_ORIGIN {
	redir $APP_ORIGIN{uri} permanent
}
CADDY
fi

exec "$@"
