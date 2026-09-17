# Self-Hosting Vemetric

Vemetric runs on your own server as a set of Docker containers: the dashboard, the event hub,
a background worker, Postgres, ClickHouse, Redis and a Caddy reverse proxy that handles TLS.

## Requirements

- A server with Docker and the Docker Compose plugin
- 4 GB RAM minimum, 8 GB recommended (ClickHouse is the hungry part)
- Two DNS records pointing at the server: `app.<your-domain>` and `hub.<your-domain>`
- An SMTP server, optional. Only password reset emails need it. Team invitations are links you
  hand over yourself and send no mail.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/vemetric/vemetric/main/docker/install.sh | bash
```

The installer asks for your domain, an email address for Let's Encrypt, the email address of the
administrator account and optionally your SMTP credentials. It generates every secret itself,
writes `/opt/vemetric/.env`, starts the stack, creates the administrator account and prints its
login and password:

```
  Dashboard:  https://app.example.com

  Login:      admin@example.com
  Password:   <generated-password>
```

The password is shown once and not stored anywhere else. Change it in the dashboard under
Settings after logging in.

Because the account is created directly in the database, it is already verified and works
without a mail server. The signup screen stays closed, see [Registration](#registration).

## Manual install

```bash
git clone https://github.com/vemetric/vemetric.git
cd vemetric
cp .env.selfhost.example .env.selfhost
# edit .env.selfhost, then:
docker compose --env-file .env.selfhost -f docker-compose.selfhost.yml up -d
```

Every secret in `.env.selfhost.example` marked `replace-me` has to be replaced. Generate them
with `openssl rand -hex 32`.

Create the administrator account the same way the installer does. The password is passed
through the environment so it does not end up in the process list:

```bash
VEMETRIC_ADMIN_PASSWORD='your-password' docker compose --env-file .env.selfhost \
  -f docker-compose.selfhost.yml run --rm --no-deps -T -e VEMETRIC_ADMIN_PASSWORD app \
  bun run apps/app/src/backend/scripts/bootstrap-admin.ts --email admin@example.com
```

The script accepts `--name` and `--organization` as well, and refuses to run once the instance
has an account. The account it creates is verified, so it works without a mail server.

Alternatively register the first account through the signup screen, which is open until an
account exists. That path requires a working SMTP server for the verification email on every
non-`.localhost` domain.

## Configuration

### Origins

| Variable | Purpose |
| --- | --- |
| `DOMAIN` | Base domain, used to build links in emails and to scope auth cookies |
| `APP_ORIGIN` | Dashboard origin, for example `https://app.example.com` |
| `HUB_ORIGIN` | Event ingestion origin your SDKs send to |
| `ROOT_ORIGIN` | Bare domain, redirects to the dashboard |
| `BETTER_AUTH_URL` | Has to match `APP_ORIGIN` |

Caddy requests certificates automatically for `https` origins. Use `http` origins only for
local testing on a `.localhost` domain.

`APP_ORIGIN` and `HUB_ORIGIN` have to be absolute `http` or `https` URLs, the app container
refuses to start otherwise.

`ROOT_ORIGIN` is optional in both places that read it, and the two treat it differently. The
app falls back to `APP_ORIGIN` when building links. Caddy serves the bare domain only when the
value is set and differs from `APP_ORIGIN`; an empty or identical value simply leaves the
redirect out. Set it only if the bare domain has a DNS record of its own, otherwise Caddy
keeps retrying a certificate order that cannot succeed. The installer asks about this and
leaves it empty by default.

All three are read at runtime and injected into the served `index.html`, not baked into the
JavaScript bundle at build time. The published image therefore works on any domain and you
never have to build it yourself to change an origin.

Moving the instance to a different domain means editing the env file and restarting, no
rebuild:

```bash
# adjust DOMAIN, APP_ORIGIN, HUB_ORIGIN, ROOT_ORIGIN and BETTER_AUTH_URL in .env, then:
docker compose --env-file .env -f docker-compose.selfhost.yml up -d app caddy
```

Caddy reads the same origins, so it requests the certificate for the new names on the next
start.

### Mail

| Variable | Purpose |
| --- | --- |
| `MAIL_PROVIDER` | `smtp` or `postmark` |
| `MAIL_FROM_ADDRESS` | Sender address for transactional mail. Required as soon as `SMTP_HOST` is set, app and worker refuse to start without it |
| `SMTP_HOST`, `SMTP_PORT` | SMTP server, port defaults to 587 |
| `SMTP_USER`, `SMTP_PASSWORD` | Credentials, leave empty for an unauthenticated relay |
| `SMTP_SECURE` | Implicit TLS, defaults to true on port 465 |
| `SMTP_TLS_REJECT_UNAUTHORIZED` | Set to `false` only for internal relays with self signed certificates |

### Registration

`ALLOW_REGISTRATION=false` (the installer default) allows exactly one account to be created
through the signup screen and rejects every later signup, with one exception: a signup that
carries a valid invitation link is always let through. On an instance set up by the installer
that first account already exists, so the signup screen is closed to everyone without a link.

`ALLOW_REGISTRATION` and `SELF_HOSTED` are parsed strictly: only `true` and `false` are
accepted. Any other value, including `1`, `yes` or `True`, makes the container refuse to
start with an explicit error instead of silently falling back to a default.

### Social login

Signing in with GitHub or Google is optional. Without any configuration the instance offers
email and password only, and the login screen, the signup screen and the account settings show
no social login at all.

| Variable | Purpose |
| --- | --- |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | OAuth app credentials for GitHub |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth client credentials for Google |

Each provider needs both of its values. A provider with both values set is enabled and its
button appears, a provider with neither is hidden. Setting only one of the two is treated as a
configuration error and the app container refuses to start.

Register these callback URLs with the provider, using the host of `APP_ORIGIN`:

- GitHub: `https://<APP_ORIGIN host>/_api/auth/callback/github`
- Google: `https://<APP_ORIGIN host>/_api/auth/callback/google`

The [registration](#registration) rules apply to social signups exactly as to email signups:
with `ALLOW_REGISTRATION=false`, signing in with a provider cannot create a new account unless
it comes through a valid invitation link.

Removing a provider later locks out every account that signed up through it and never set a
password. Before disabling a provider, have those users set a password under Settings, or reset
it for them with the bootstrap script.

After changing the variables, recreate the app container:

```bash
docker compose --env-file .env -f docker-compose.selfhost.yml up -d app
```

### Inviting team members

Leave `ALLOW_REGISTRATION=false`. Invite the person under Settings, in the members section of
your organization. Creating the invitation copies a link to your clipboard, and handing that
link over is up to you. No mail is sent, so this works on an instance without SMTP.

The link itself is the permission: whoever opens it can register through the normal signup
screen, closed registration or not. It is not tied to any email address, because the
invitation stores none. Treat it as a credential and send it over a channel you trust.

Two properties are worth knowing before you hand one out:

- An invitation expires 7 days after it was created. After that the link is refused and you
  create a new one.
- The link is consumed the moment a signup uses it, before the account is actually created.
  If that signup then fails, the link is spent and the account does not exist. Invite the
  person again, or create the account another way and add it under Settings.

Opening registration for everyone is therefore never necessary to onboard a teammate. Set
`ALLOW_REGISTRATION=true` only if you actually want anyone who reaches the instance to be
able to create an account, and restart the app container afterwards:

```bash
docker compose --env-file .env -f docker-compose.selfhost.yml up -d app
```

### Databases

Postgres, ClickHouse and Redis are reachable only from the compose network, never from the
host. ClickHouse additionally drops its built in `default` user, which ships without a
password, through `docker/clickhouse/users.d/zz-remove-default-user.xml`. The stack
authenticates as `CLICKHOUSE_USER`, so that file has to stay mounted.

### Optional

- `VEMETRIC_VERSION`: image tag every service is pinned to, see [Updating](#updating).
- `VEMETRIC_TOKEN`: reports usage of your instance into a Vemetric project. Leave it unset and
  no telemetry is sent.
- `GEO_API`: base URL of a geolocation service, called as `GET <GEO_API>/<ip>` and expected to
  answer with `{ country, city, latitude, longitude }`. Without it every visitor stays without
  a country and the globe stays empty.
- `VITE_MAP_TOPOJSON_URL`: build time URL of the TopoJSON world atlas used by the country map.
  See [External services](#external-services).
- Avatar uploads need an S3 compatible bucket, see the `AWS_*` variables in `.env.example`.

## Plans, billing and limits

Self hosted instances run without billing. `SELF_HOSTED=true` (set by the compose file) makes
the backend report every organization as being on an active subscription, which removes every
plan based restriction at its source:

| Restriction in the hosted version | Self hosted |
| --- | --- |
| Pricing step during onboarding | skipped |
| Organizations per account, members per organization, projects per organization | unlimited |
| Timespans beyond 31 days, custom date ranges, data retention | unlimited |
| Event limit banners and past due notices | never shown |
| Billing tab, pricing dialog, usage cycles | hidden |
| Paddle webhook | not registered |

The frontend counterpart is the `VITE_SELF_HOSTED` build argument, which removes the billing
UI from the bundle. Both are set for you when you use `docker-compose.selfhost.yml`.

## External services

The dashboard exists as two images. `ghcr.io/vemetric/app` is the hosted build behind
vemetric.com. `ghcr.io/vemetric/app-selfhost` is the same code built with
`VITE_SELF_HOSTED=true`, which compiles out everything that would otherwise talk to Vemetric's
own infrastructure. `docker-compose.selfhost.yml` uses `app-selfhost`; the other services
(`hub`, `worker`, `bullboard`, `migrate`) have a single image each.

What the self hosted build leaves out:

| Service | Behaviour when self hosted |
| --- | --- |
| Product analytics (`cdn.vemetric.com`) | Script is not loaded |
| Support chat (`client.crisp.chat`) | Chat button and script are removed |
| Favicon service (`favicon.vemetric.com`) | Referrer icons fall back to a generic icon |
| Billing (`cdn.paddle.com`) | Paddle is only initialized when `VITE_PADDLE_TOKEN` is set |
| Community counters (`api.github.com`, `discord.com`) | GitHub and Discord buttons are hidden |

One external asset remains: the country map loads a TopoJSON world atlas from
`assets.vemetric.com`, which does not send CORS headers, so the map stays empty on any other
domain. Host your own copy and point `VITE_MAP_TOPOJSON_URL` at it when building the image.

## Tracking your own sites

The installation guides linked from the dashboard describe the hosted setup: they load the
tracking script from Vemetric's CDN and send events to Vemetric's servers. On a self hosted
instance you have to point both at your own installation, otherwise your visitors' events end
up in the hosted service instead of your database.

Serve the tracking script from a host you control and set the `data-host` attribute to your
event hub:

```html
<script
  src="https://your-cdn.example.com/main.js"
  data-token="<project-token>"
  data-host="https://hub.example.com"
  defer
></script>
```

The SDKs take the same values as options, for example `host` in the JavaScript and React SDKs.
The project token is shown under Settings.

## Operating the instance

```bash
# logs
docker compose --env-file .env -f docker-compose.selfhost.yml logs -f app

# queue dashboard on http://127.0.0.1:4121
docker compose --env-file .env -f docker-compose.selfhost.yml --profile debug up -d bullboard
```

### Updating

The installer pins the installation to a release by writing `VEMETRIC_VERSION` into the env
file, and every image reference in the compose file uses it. Updating is a deliberate step:
read the release notes, raise the value, then pull and recreate.

```bash
# check what the current release is
curl -fsSL https://api.github.com/repos/vemetric/vemetric/releases/latest | grep tag_name

# set VEMETRIC_VERSION in .env to that version without the leading "v", then:
docker compose --env-file .env -f docker-compose.selfhost.yml pull
docker compose --env-file .env -f docker-compose.selfhost.yml up -d
```

Migrations run automatically in a `migrate` container before the application containers start
and they are not reversible, so back up the volumes before a major upgrade.

Leaving `VEMETRIC_VERSION` unset makes every service follow the floating `latest` tag. An
unattended `pull && up -d` then crosses releases without warning, breaking migrations
included. Only do that on an instance you are willing to restore from backup.

### Backups

The state lives in the `postgres_data` and `clickhouse_data` volumes. Postgres holds accounts,
organizations and projects, ClickHouse holds the analytics data.

```bash
docker compose --env-file .env -f docker-compose.selfhost.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > vemetric-postgres.sql.gz
```

## Troubleshooting

**Mails do not arrive.** Check the worker logs for transport errors and confirm that
`MAIL_FROM_ADDRESS` uses a domain your SMTP server is allowed to send for. With an empty
`SMTP_HOST` no mail is sent at all. The administrator login and team invitations still work,
only password resets and the signup verification mail need a mail server.

**The password from the installer is lost.** Without SMTP there is no reset mail. Set a new one
directly:

```bash
VEMETRIC_ADMIN_PASSWORD='new-password' docker compose --env-file /opt/vemetric/.env \
  -f /opt/vemetric/docker-compose.selfhost.yml run --rm --no-deps -T -e VEMETRIC_ADMIN_PASSWORD app \
  bun run apps/app/src/backend/scripts/bootstrap-admin.ts --email admin@example.com --reset-password
```

**"Registration is disabled on this instance."** Expected once the first account exists and
the signup carries no invitation link. The same message also appears with a link that is no
longer good: invitations expire after 7 days, and a link is spent as soon as one signup has
used it, including a signup that failed afterwards. Create a fresh invitation in that case.
See [Inviting team members](#inviting-team-members).

**Certificates are not issued.** Caddy needs ports 80 and 443 reachable from the internet and
DNS records that already point at the server.
