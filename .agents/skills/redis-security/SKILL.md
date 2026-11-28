---
name: redis-security
description: Redis security guidance covering authentication (requirepass and ACL users), TLS, ACL-based least-privilege access control, restricting network exposure via bind and protected-mode, firewall rules, and disabling dangerous commands. Use when deploying Redis to production, defining ACL users for an application, configuring TLS connections, locking down a Redis instance behind a firewall, or auditing a Redis deployment for security hardening.
license: MIT
metadata:
  author: Redis, Inc.
  version: "0.1.0"
---

# Redis Security

Production hardening for Redis: authentication, ACL-based access control, and network exposure. Cover all three together — any one of them on its own leaves an exploitable gap.

## When to apply

- Deploying or reviewing a Redis instance destined for production.
- Setting up application credentials beyond a shared password.
- Auditing a Redis deployment against a security checklist.
- Receiving "Redis exposed to the internet" findings from a scanner.

## 1. Always authenticate (and use TLS)

Never run a production Redis without a password. Pair authentication with TLS so credentials and data aren't sent in clear text.

```
# redis.conf
requirepass your-strong-password
tls-port 6380
tls-cert-file /path/to/redis.crt
tls-key-file  /path/to/redis.key
```

```python
r = redis.Redis(
    host="localhost",
    port=6380,
    password="your-strong-password",
    ssl=True,
    ssl_cert_reqs="required",
)
```

If you can use ACL users (next section) instead of the single `requirepass`, do — `requirepass` is effectively the legacy "default user" shortcut.

See [references/auth.md](references/auth.md).

## 2. ACLs for least-privilege access

The `default` user with a shared password is fine for development. For production, give each application a dedicated ACL user with only the commands and key patterns it actually needs.

```
# Cache-only reader
ACL SETUSER app_readonly on >password ~cache:* +get +mget +scan

# Writer that can't run dangerous ops
ACL SETUSER app_writer   on >password ~*        +@all -@dangerous

# Admin (use sparingly, never for application traffic)
ACL SETUSER admin        on >strong-password ~* +@all
```

Useful command categories:

| Category | What it covers |
|---|---|
| `@read` | Read commands (`GET`, `MGET`, `HGET`, ...) |
| `@write` | Write commands (`SET`, `DEL`, `XADD`, ...) |
| `@dangerous` | `FLUSHALL`, `DEBUG`, `KEYS`, etc. |
| `@admin` | Administrative commands |

If app credentials leak, a tight ACL bounds the blast radius — the attacker can't `FLUSHALL` your DB just because they grabbed a cache reader's password.

See [references/acls.md](references/acls.md).

## 3. Restrict network access

The most common Redis breach is a public-internet Redis with no auth. Avoid that with three layers:

```
# redis.conf — bind to specific interfaces, keep protected-mode on
bind 127.0.0.1 192.168.1.100
protected-mode yes
```

```bash
# Firewall — allow only application subnets
iptables -A INPUT -p tcp --dport 6379 -s 192.168.1.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 6379 -j DROP
```

Anti-pattern: `bind 0.0.0.0` + `protected-mode no` — exposes Redis to the whole network without protection.

Optional but recommended: rename or disable destructive commands so a compromised client can't trash the DB:

```
rename-command FLUSHALL ""
rename-command DEBUG ""
rename-command CONFIG ""
```

See [references/network.md](references/network.md).

## References

- [Redis: Security](https://redis.io/docs/latest/operate/oss_and_stack/management/security/)
- [Redis: ACL](https://redis.io/docs/latest/operate/oss_and_stack/management/security/acl/)
