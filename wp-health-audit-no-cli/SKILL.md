---
name: wp-health-audit-no-cli
description: "Use when performing a detailed WordPress health audit WITHOUT WP-CLI access. Uses filesystem reads, WordPress.org public API, curl, and optional mysql CLI to collect plugin/theme inventory, core version, and security checks. Produces the same rich HTML report and machine-readable JSON as wp-health-audit. Read-only — no writes, no updates."
compatibility: "Targets WordPress 6.x (PHP 7.4+). Requires filesystem read access to the WordPress root. mysql CLI optional (enables active/inactive plugin detection). curl and openssl required."
---

# WordPress Health Audit (No WP-CLI)

## When to use

Use this skill instead of `wp-health-audit` when **WP-CLI is not available** in the execution environment. All checks are performed using:

- **Filesystem reads** — plugin headers, theme headers, wp-config.php, wp-includes/version.php
- **WordPress.org public REST API** — latest available versions for plugins, themes, and core
- **curl / openssl** — HTTP checks, SSL, robots.txt, sitemap, security exposure
- **mysql CLI** (optional) — active plugin list, `blog_public` option, cron schedule table

This skill is read-only. It collects evidence; it does not apply updates, activate/deactivate plugins, or modify WordPress in any way.

## Inputs required

- `--path=<wordpress-root>` — absolute path to the WordPress installation
- `--url=<site-url>` — required for HTTP-based checks
- Environment confirmation: `production`, `staging`, or `development`
- The Paperclip child issue identifier (`--issue`)

## Pre-flight checks

Before starting, verify the following are available:

```bash
# Required
curl --version
ls <wordpress-root>/wp-includes/version.php

# Optional but strongly recommended (enables active/inactive plugin detection)
mysql --version
```

If `curl` is unavailable, record all HTTP checks as `blocked`.
If the `--path` is wrong or unreadable, record all filesystem checks as `blocked` and do not invent results.

---

## Procedure

### 0) Safety guardrails

This skill is **read-only**. Before running any command:

1. Confirm `--path` points to the correct WordPress root (check for presence of `wp-config.php` and `wp-includes/version.php`).
2. Never write to, delete, or modify any file under `--path`.
3. Never store or print raw database credentials from `wp-config.php`.
4. If the environment says `production` but the URL or path suggests staging, mark the mismatch and do not present staging results as production.

---

### 1) Verify filesystem access and collect environment

```bash
ls <wordpress-root>/wp-config.php
ls <wordpress-root>/wp-includes/version.php
ls <wordpress-root>/wp-content/plugins/
ls <wordpress-root>/wp-content/themes/
```

If any of these are missing or permission-denied, record the relevant checks as `blocked`.

---

### 2) WordPress core version

#### 2a) Installed version (filesystem)

```bash
grep "wp_version\s*=" <wordpress-root>/wp-includes/version.php
```

Expected line: `$wp_version = '6.5.3';`

#### 2a-ii) Latest available version (WordPress.org API)

```bash
curl -s "https://api.wordpress.org/core/version-check/1.7/" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['offers'][0]['version'], d['offers'][0]['response'])"
```

Compare installed vs latest. Determine update type: major / minor / patch / up to date.

---

### 2b) Search engine visibility check

**Primary — MySQL (if available):**
```bash
DB_NAME=$(grep "DB_NAME" <wp-root>/wp-config.php | grep -oP "(?<=')[^']+(?=')" | head -1)
DB_USER=$(grep "DB_USER" <wp-root>/wp-config.php | grep -oP "(?<=')[^']+(?=')" | head -1)
DB_PASS=$(grep "DB_PASSWORD" <wp-root>/wp-config.php | grep -oP "(?<=')[^']+(?=')" | head -1)
DB_HOST=$(grep "DB_HOST" <wp-root>/wp-config.php | grep -oP "(?<=')[^']+(?=')" | head -1)
DB_PREFIX=$(grep "table_prefix" <wp-root>/wp-config.php | grep -oP "(?<=')[^']+(?=')" | head -1)

mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -se \
  "SELECT option_value FROM ${DB_PREFIX}options WHERE option_name='blog_public';"
```

**HTTP fallback (always run):**
```bash
curl -sI <site-url>/ | grep -i x-robots-tag
curl -s <site-url>/ | grep -i 'noindex'
```

- `blog_public=1` -> severity: `info`
- `blog_public=0` on production -> severity: `critical`, `red_flag: true`

---

### 2c) robots.txt health check

```bash
curl -s -o /tmp/robots.txt -w "%{http_code}" <site-url>/robots.txt
cat /tmp/robots.txt
```

- HTTP != 200 -> severity: `warning`
- `Disallow: /` for Googlebot -> severity: `critical`, `red_flag: true`
- No `Sitemap:` line -> severity: `warning`
- Contains `<script>`, `eval()`, `base64` -> severity: `critical`, `red_flag: true`

---

### 2d) Debug mode check

**Primary — read wp-config.php directly:**
```bash
grep -E "WP_DEBUG|WP_DEBUG_DISPLAY|WP_DEBUG_LOG" <wordpress-root>/wp-config.php
```

**HTTP fallback:**
```bash
curl -s "<site-url>/this-page-does-not-exist-12345" | grep -iE "PHP Fatal|PHP Warning|Stack trace"
```

Severity on production:
- `WP_DEBUG_DISPLAY=true` -> severity: `critical`, `red_flag: true`
- `WP_DEBUG=true` -> severity: `high`
- `WP_DEBUG_LOG=true` -> severity: `info`

---

### 2e) Sitemap.xml

```bash
curl -s -o /tmp/sitemap.xml -w "%{http_code}" <site-url>/sitemap.xml
grep -Ei '<script|eval\(|base64_decode' /tmp/sitemap.xml
```

---

### 2f) SSL certificate expiry

```bash
echo | openssl s_client -servername <domain> -connect <domain>:443 2>/dev/null \
  | openssl x509 -noout -dates
```

- Expired -> critical/red_flag
- <14d -> critical | <30d -> high | <60d -> warning | >=60d -> info

---

### 2g) Security exposure

```bash
curl -o /dev/null -s -w "%{http_code}" <site-url>/xmlrpc.php
curl -o /dev/null -s -w "%{http_code}" <site-url>/readme.html
curl -o /dev/null -s -w "%{http_code}" <site-url>/license.txt
curl -o /dev/null -s -w "%{http_code}" <site-url>/wp-content/uploads/
```

---

### 2h) WordPress version disclosure

```bash
curl -s <site-url>/ | grep -i 'meta name="generator"'
```

---

### 2i) wp-config.php permissions

```bash
stat -c "%a" <wordpress-root>/wp-config.php
# macOS/BSD: stat -f "%OLp" <wordpress-root>/wp-config.php
```

- 400/440/600/640 -> info | 644 -> warning | 666/777 -> critical/red_flag

---

### 2j) Cron event backlog

**Primary — MySQL:**
```bash
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -se \
  "SELECT option_value FROM ${DB_PREFIX}options WHERE option_name='cron';" \
  | python3 -c "
import sys, json, time
raw = sys.stdin.read().strip()
cron = json.loads(raw) if raw else {}
now = time.time()
overdue = [(hook, now - float(ts)) for ts, events in cron.items() for hook in events if float(ts) < now]
overdue.sort(key=lambda x: -x[1])
print(f'Overdue events: {len(overdue)}')
for hook, delay in overdue[:5]:
    print(f'  {hook}: {int(delay//3600)}h overdue')
"
```

If MySQL unavailable: record as `blocked/partial`.

- >1h overdue -> warning | >24h overdue -> high | none -> info

---

### 3) Plugin inventory (filesystem + WordPress.org API)

#### 3a) Discover installed plugins

```bash
ls -1d <wordpress-root>/wp-content/plugins/*/
```

For each `<slug>`, read plugin header:
```bash
grep -m1 "Version:" <wordpress-root>/wp-content/plugins/<slug>/<slug>.php 2>/dev/null \
  || grep -m1 "^Stable tag:" <wordpress-root>/wp-content/plugins/<slug>/readme.txt 2>/dev/null
```

Also read: `Plugin Name:`, `Author:`, `Text Domain:` from the main PHP file header block comment.

#### 3b) Detect active plugins (MySQL required)

```bash
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -se \
  "SELECT option_value FROM ${DB_PREFIX}options WHERE option_name='active_plugins';" \
  | python3 -c "import sys,json; [print(p.split('/')[0]) for p in json.loads(sys.stdin.read().strip())]"
```

If MySQL unavailable: mark all statuses as `unknown`. Note: inactive detection blocked.

#### 3c) Latest versions from WordPress.org API

```bash
curl -s "https://api.wordpress.org/plugins/info/1.2/?action=plugin_information&slug=<slug>&fields=version" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('version','not_found'))"
```

If `not_found`: plugin may be premium/private — mark update as `unknown`.

#### 3d) Detect duplicate plugins

Same slug appearing in multiple directories under wp-content/plugins/ -> severity: `critical`.

#### 3e) Detect inactive plugins

Plugin in 3a but NOT in active list from 3b -> severity: `warning`, recommend remove or activate.
If MySQL unavailable: skip, record as `blocked/partial`.

---

### 4) Theme inventory (filesystem + WordPress.org API)

#### 4a) Discover installed themes

```bash
ls -1d <wordpress-root>/wp-content/themes/*/
```

For each `<slug>`:
```bash
grep -E "^Theme Name:|^Version:|^Template:" <wordpress-root>/wp-content/themes/<slug>/style.css
```

#### 4b) Active theme (MySQL)

```bash
mysql ... -se "SELECT option_value FROM ${DB_PREFIX}options WHERE option_name IN ('stylesheet','template');"
```

#### 4c) Latest versions from WordPress.org API

```bash
curl -s "https://api.wordpress.org/themes/info/1.2/?action=theme_information&slug=<slug>&fields=version" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('version','not_found'))"
```

#### 4d) Default WordPress themes

Flag `twentytwenty*`, `twentynineteen`, `twentyseventeen` etc. If not active or parent theme -> severity: `warning`, recommend remove.

#### 4e) Inactive themes

Not active, not parent theme -> severity: `warning`.

---

### 5) Build the findings JSON

Write `findings/<check>.json`. Each finding:

```json
{
  "severity": "critical | high | warning | info | blocked",
  "category": "wordpress",
  "title": "<short human title>",
  "evidence": "<what you found>",
  "recommendation": "<what to do>",
  "owner": "dev | client | agency",
  "follow_up": true,
  "red_flag": false,
  "source": "filesystem | api | curl | mysql | blocked"
}
```

Always include `source` field — important audit trail when WP-CLI is absent.

---

### 5b) Diff with previous run — use the Shared Diff Engine (do NOT diff manually)

The week-over-week diff is produced ONLY by `/usr/local/bin/shared-diff-engine/diff_engine.py`. Never compare findings yourself, never hand-write a `diff` object, and never hand-write "First run" / "Week-Over-Week" / "Since last week" text in the HTML or JSON.

The engine needs both output files to exist, so it runs in step 6b, **after** `findings/<check>.json` and `reports/<check>.html` are written. In step 5 only make sure that:

- `findings/<check>.json` has top-level `run_metadata` (`client_slug`, `project_slug`, `environment`, `run_type`, `check_type`) and every finding has a stable `id` (e.g. `wp.core:update-available`), never a sentence. The engine matches previous findings by `id`.
- The HTML has an `<h1>` title (the engine injects the diff block right after `</h1>`).

---

### 6) Build the HTML report

Write `reports/<check>.html` as a self-contained HTML file.

Add a visible banner at the top:
```
i  This report was generated WITHOUT WP-CLI access.
   Data sources: filesystem reads, WordPress.org API, curl, openssl.
   Plugin/theme status (active/inactive) requires MySQL — see Section H for data availability.
```

**IMPORTANT:** Do not write any diff/comparison section yourself. The Diff Engine injects it right after the `</h1>` title in step 6b.

#### Section A — WordPress Core

| Installed version | Latest available | Update type | Update pending | Source |
|---|---|---|---|---|
| 6.5.3 | 6.5.4 | patch | Yes | filesystem + api.wordpress.org |

#### Section B — Plugin Inventory Table

| Plugin Name | Slug | Installed Version | Latest Version | Update Available | Status | Source | Risk | Recommendation |

Row colors: Red=critical, Orange=high, Yellow=warning, Green=ok, Grey=unknown (premium plugin)

#### Section C — Inactive Plugins

If MySQL available and inactive plugins found: show alert per plugin.
If MySQL unavailable: show one banner "Inactive plugin detection BLOCKED — MySQL required".

#### Section D — Duplicate Plugins

Same as wp-health-audit. Critical alert per duplicate found.

#### Section B2–B9 — All security/config checks

Same layout as wp-health-audit (SEO visibility, robots.txt, debug, sitemap, SSL, security exposure, wp-config permissions, cron).

#### Section E — Theme Inventory Table

Same columns as plugins. Mark active theme (blue) and parent theme.

#### Section F — Inactive / Default Themes

Alert per removable theme.

#### Section G — Update Intelligence Summary

```
WordPress core:              <current> -> <latest> (<type>)
Plugin updates pending:      X (major: N, minor: N, patch: N)
Theme updates pending:       X
Inactive plugins:            X / UNKNOWN (MySQL unavailable)
Inactive themes:             X / UNKNOWN (MySQL unavailable)
Duplicate plugins:           X
Search engine visibility:    OK / CRITICAL / PARTIAL
robots.txt:                  OK / WARNING / CRITICAL
Debug mode:                  OK / HIGH / CRITICAL
Sitemap.xml:                 OK / WARNING
SSL certificate:             OK / WARNING / CRITICAL (N days)
Security exposure:           OK / WARNING / HIGH
wp-config.php permissions:   OK / WARNING / CRITICAL
Cron backlog:                OK / WARNING / HIGH / BLOCKED
MySQL access:                Available / Unavailable

Overall health:              HEALTHY / NEEDS ATTENTION / CRITICAL
Collection method:           No WP-CLI — filesystem + WordPress.org API + curl
```

#### Section H — Data Source Transparency

| Check | Method | Status |
|---|---|---|
| Core version (installed) | wp-includes/version.php | OK / blocked |
| Core version (latest) | api.wordpress.org | OK / blocked |
| Plugin versions (installed) | Plugin file headers | OK / blocked |
| Plugin versions (latest) | api.wordpress.org | OK / blocked |
| Active plugin list | MySQL active_plugins | OK / blocked |
| Theme versions (installed) | style.css headers | OK / blocked |
| Theme versions (latest) | api.wordpress.org | OK / blocked |
| Active theme | MySQL stylesheet option | OK / blocked |
| blog_public | MySQL + HTTP fallback | OK / partial / blocked |
| WP_DEBUG | wp-config.php grep | OK / blocked |
| wp-config.php permissions | stat | OK / blocked |
| Cron backlog | MySQL cron option | OK / blocked |
| robots.txt | curl | OK |
| SSL certificate | openssl | OK |
| Security exposure | curl | OK |

---

### 6b) Run the Shared Diff Engine (REQUIRED)

After both files are written:

```bash
python /usr/local/bin/shared-diff-engine/diff_engine.py \
  --current-json <task-folder>/findings/<check>.json \
  --html-report <task-folder>/reports/<check>.html \
  --check-type <check> \
  --project-tasks-dir /clients/<client-slug>/projects/<project-slug>/ai/tasks/ \
  --current-issue "<paperclip-issue>"
```

`<check>` is the exact file name stem (e.g. `wp-health-audit`). Paste the script's stdout into your issue comment, including the line `Diff engine: searched ... -> N file(s) found`.

- Success: the HTML contains `<div class='diff-summary'>` and the JSON has the engine's `diff` object. "First run" is valid ONLY when the engine itself wrote it.
- Failure (script missing, error, no access): insert `<div class='diff-summary'><strong>⚠️ Diff engine failed: <exact error></strong></div>` after the `</h1>` and set `"diff": {"error": "<reason>"}`. Never substitute a hand-written "First run".

---

### 7) Publish and close

```bash
/usr/local/bin/paperclip-publish-artifact \
  --issue <child-issue> \
  --file <task-folder>/reports/<check>.html \
  --label "WordPress Health Audit (No WP-CLI)" \
  --summary "<summary e.g. '21 plugins found, 3 updates pending — filesystem mode'>"
```

```bash
paperclip-update-issue-status --issue <child-issue> --status done
```

---

### 8) Slack notification (conditional)

Same triggers as `wp-health-audit`. If MySQL was unavailable, append to message:
```
Note: active/inactive plugin status could not be determined (MySQL unavailable).
```

Message format — updates or warnings:
```
[<project>] WP audit — <N> issues found (no WP-CLI mode)
WordPress core: <current> -> <latest> (<type>)
Plugins with updates: N | Critical: N
MySQL: unavailable — inactive plugin detection skipped
Report: <url> | Ticket: <id>
```

Slack webhook secret: `op://Agency/Slack Webhook Maintenance/url`

---

## Output contract

```
<task-folder>/reports/<check>.html     <- HTML report (published via paperclip-publish-artifact)
<task-folder>/findings/<check>.json    <- machine-readable findings array
```

---

## Human Verification Checklist (mandatory — appended to every HTML report)

- WP-CLI unavailable — has someone verified plugin active/inactive status in WP Admin?
- MySQL unavailable — has someone verified cron and blog_public in WP Admin?
- Premium plugins not on WordPress.org — are they up to date?
- Backup: restore test completed in isolated environment?
- Content: texts, prices, contacts are current?
- Forms: submissions received correctly?
- Checkout/payment flow: test transaction completed?
- GDPR: cookie consent works for jurisdiction?
- Analytics: GA4/GTM data collecting correctly?
- User roles: minimum privilege principle applied?
- Client sign-off: visual result approved?

Each item must include `Owner:` and `Due:` fields.

Do NOT write combined rollup files (findings.json, final-report.html, orchestrator-summary.html). Those are owned by Maintenance Orchestrator.

---

## Severity guide

| Severity | When to use |
|---|---|
| `critical` | Duplicate plugins; core security release not applied; WP_DEBUG_DISPLAY=true on prod; blog_public=0 on prod; SSL expired or <14 days; Googlebot blocked in robots.txt; injection in robots.txt/sitemap; wp-config.php 666/777 |
| `high` | Major plugin/theme updates; core update pending (non-security); WP_DEBUG=true on prod; xmlrpc.php 200; SSL <30 days; cron backlog >24h |
| `warning` | Inactive plugins/themes (if detectable); minor/patch updates; no Sitemap in robots.txt; sitemap 404; SSL <60 days; readme.html 200; meta generator present; wp-config.php world-readable; cron backlog >1h |
| `info` | Everything up to date; expected staging behavior; all checks pass |
| `blocked` | Check could not be performed — missing tooling, unreadable file, no network |

---

## Safety rules

- Do not apply updates.
- Do not activate or deactivate plugins or themes.
- Do not modify wp-config.php or any WordPress file.
- Do not delete users, posts, or any content.
- Do not print or store raw DB credentials from wp-config.php.
- Do not fabricate plugin versions — if header unreadable and API not_found, record as `unknown`.
- For premium plugins not on WordPress.org API, always mark update as `unknown` — never assume up to date.
- If WordPress root is unreadable, record all filesystem checks as `blocked` — do not invent results.