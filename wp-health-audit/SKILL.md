---
name: wp-health-audit
description: "Use when performing a detailed WordPress health audit: structured plugin inventory with version comparison, core update check, theme inventory, inactive plugin warnings, and duplicate plugin detection. Produces a rich HTML report and machine-readable JSON. Read-only — no writes, no updates."
compatibility: "Targets WordPress 6.x (PHP 7.4+). Requires WP-CLI in the execution environment."
---

# WordPress Health Audit

## When to use

Use this skill when the task requires a **detailed, structured WordPress health audit** that goes beyond basic inventory. Specifically when you need:

- A full plugin list with **current version → latest available version** comparison
- **WordPress core** current version vs latest available (is an update pending?)
- **Theme inventory** with current vs latest version, including default themes
- Detection of **duplicate plugins** (same plugin slug, different versions)
- Detection of **inactive plugins** with security risk warnings
- Detection of **inactive themes** that are not the active theme and not required

This skill is read-only. It collects evidence; it does not apply updates, activate/deactivate plugins, or modify WordPress in any way.

## Inputs required

- `--path=<wordpress-root>` — absolute path to the WordPress installation
- `--url=<site-url>` — required for multisite; optional for single-site
- Environment confirmation: `production`, `staging`, or `development`
- The Paperclip child issue identifier (`--issue`)

## Procedure

### 0) Safety guardrails

This skill is **read-only**. Before running any command:

1. Confirm you have `--path` pointing to the correct WordPress installation.
2. Never run `wp plugin update`, `wp core update`, `wp theme update`, or any write operation.
3. Use `--skip-plugins --skip-themes` on all WP-CLI calls to prevent bootstrap warnings from corrupting JSON output.
4. If `WP_ENVIRONMENT_TYPE` reports a non-production source but the task scope says `production`, mark the WP-CLI check as `blocked/partial` and report the mismatch — do not present staging results as production results.

### 1) Verify WP-CLI availability

```bash
wp --info --path=<wordpress-root>
wp core version --path=<wordpress-root> --skip-plugins --skip-themes
```

If WP-CLI is not available, record the check as `blocked` and report the missing tooling. Do not fabricate results.

### 2) Collect core version data

```bash
# Current installed version
wp core version --path=<wordpress-root> --skip-plugins --skip-themes

# Check if a core update is available
wp core check-update --format=json --path=<wordpress-root> --skip-plugins --skip-themes
```

Expected output fields per update record:
- `version` — latest available version
- `update_type` — `major`, `minor`, or `patch`
- `package_url` — download URL (confirms the record is real)

If the array is empty, core is up to date. Record current version and status.

### 2b) Search engine visibility check

```bash
wp option get blog_public --path=<wordpress-root> --skip-plugins --skip-themes
```

Result interpretation:
- `1` = indexing enabled → severity: `info`, status OK
- `0` on production → severity: `critical`, `red_flag: true` (site not indexed by Google)
- `0` on staging/dev → severity: `info` (expected)

HTTP fallback (when WP-CLI unavailable):
```bash
curl -sI <site-url>/ | grep -i x-robots-tag
curl -s <site-url>/ | grep -i 'noindex'
```

### 2c) robots.txt health check

```bash
curl -s -o /tmp/robots.txt -w "%{http_code}" <site-url>/robots.txt
```

Analyze the fetched content:
- HTTP status != 200 → severity: `warning` (robots.txt unavailable)
- `Disallow: /` for `User-agent: *` or `User-agent: Googlebot` → severity: `critical`, `red_flag: true`
- No `Sitemap:` line present → severity: `warning`
- Content contains `<script>`, `eval()`, or `base64` → severity: `critical`, `red_flag: true` (hack indicator)

### 2d) Debug mode check

```bash
wp eval '
  echo "WP_DEBUG=" . (WP_DEBUG ? "true" : "false") . "\n";
  echo "WP_DEBUG_DISPLAY=" . (WP_DEBUG_DISPLAY ? "true" : "false") . "\n";
  echo "WP_DEBUG_LOG=" . (WP_DEBUG_LOG ? "true" : "false") . "\n";
' --path=<wordpress-root> --skip-plugins --skip-themes
```

Severity on production:
- `WP_DEBUG_DISPLAY=true` → severity: `critical`, `red_flag: true`
- `WP_DEBUG=true` → severity: `high`
- `WP_DEBUG_LOG=true` → severity: `info` (acceptable — logs to file only)
- All false → severity: `info`, status OK

HTTP fallback: request a non-existent page and check response for `PHP Fatal error` or stack trace in body.

### 2e) Sitemap.xml availability and injection check

```bash
curl -s -o /tmp/sitemap.xml -w "%{http_code}" <site-url>/sitemap.xml
grep -Ei '<script|eval\(|base64_decode' /tmp/sitemap.xml
```

- HTTP status != 200 → severity: `warning`
- Suspicious content (`<script>`, `eval`, `base64`) → severity: `critical`, `red_flag: true`
- HTTP 200 and clean → severity: `info`

### 2f) SSL certificate expiry check

```bash
curl -vI --silent <site-url> 2>&1 | grep -E 'expire|SSL|certificate'
# Or using openssl:
echo | openssl s_client -servername <domain> -connect <domain>:443 2>/dev/null | openssl x509 -noout -dates
```

Severity:
- Certificate expired → severity: `critical`, `red_flag: true`
- Expires within 14 days → severity: `critical`
- Expires within 30 days → severity: `high`
- Expires within 60 days → severity: `warning`
- More than 60 days remaining → severity: `info`

### 2g) Security exposure check (xmlrpc, readme, license, wp-admin)

```bash
curl -o /dev/null -s -w "%{http_code}" <site-url>/xmlrpc.php
curl -o /dev/null -s -w "%{http_code}" <site-url>/readme.html
curl -o /dev/null -s -w "%{http_code}" <site-url>/license.txt
curl -o /dev/null -s -w "%{http_code}" <site-url>/wp-content/uploads/
```

Expected results:
- `/xmlrpc.php`: 403 or 404 = OK; 200 = severity: `high` (attack surface)
- `/readme.html`: 403 or 404 = OK; 200 = severity: `warning` (version disclosure)
- `/license.txt`: 403 or 404 = OK; 200 = severity: `info`
- `/wp-content/uploads/`: 403 = OK; 200 with directory listing → severity: `high`

### 2h) WordPress version disclosure check

```bash
curl -s <site-url>/ | grep -i 'meta name="generator"'
```

- `<meta name="generator" content="WordPress X.X.X">` found → severity: `warning` (version exposed to attackers)
- Not present → severity: `info`, status OK

### 2i) wp-config.php permissions check

```bash
wp eval 'echo decoct(fileperms(ABSPATH . "wp-config.php") & 0777);' \
  --path=<wordpress-root> --skip-plugins --skip-themes
```

- Permissions 400 or 440 → severity: `info` (recommended)
- Permissions 600 or 640 → severity: `info` (acceptable)
- Permissions 644 → severity: `warning` (world-readable)
- Permissions 666 or 777 → severity: `critical`, `red_flag: true`

### 2j) Cron event backlog check

```bash
wp cron event list --format=json \
  --path=<wordpress-root> --skip-plugins --skip-themes
```

For each event, check `next_run_gmt` vs current time:
- Events overdue by > 1 hour → severity: `warning`
- Events overdue by > 24 hours → severity: `high` (cron is stuck)
- No overdue events → severity: `info`

Note: WP Cron relies on site traffic to trigger. Sites with low traffic may show routine cron lag — note this in evidence.

### 3) Collect full plugin inventory

```bash
# Full plugin list with version and update status
wp plugin list \
  --format=json \
  --fields=name,title,status,version,update,update_version,auto_update \
  --path=<wordpress-root> \
  --skip-plugins --skip-themes
```

For each plugin, record:
- `name` — plugin slug
- `title` — human-readable name
- `status` — `active`, `inactive`, `must-use`, `drop-in`
- `version` — currently installed version
- `update` — `available`, `none`, or `version_higher`
- `update_version` — latest available version (empty if no update)
- `auto_update` — `on` or `off`

#### Detect duplicates

A duplicate exists when the same plugin `name` (slug) appears more than once in the list. This can happen after failed updates or manual uploads. Flag any slug that appears more than once, list all versions found, and mark as `critical` severity.

#### Detect inactive plugins

Flag every plugin with `status=inactive`. These are **security risks** because:
- They receive no automatic updates while inactive
- They may contain unpatched vulnerabilities
- Attackers can exploit them even when deactivated if files remain on disk

Mark each inactive plugin with `severity: warning` and recommendation: **remove or activate**.

### 4) Collect theme inventory

```bash
# Full theme list
wp theme list \
  --format=json \
  --fields=name,title,status,version,update,update_version,auto_update \
  --path=<wordpress-root> \
  --skip-plugins --skip-themes
```

For each theme, record the same fields as plugins.

#### Default (bundled) WordPress themes

Identify default WordPress themes by slug prefix (`twentytwenty*`, `twentynineteen`, `twentyseventeen`, etc.). For these:
- If they are not the active theme and not a parent of the active theme, flag as **inactive default theme** with recommendation to remove.
- Default themes that are active or serve as parent: keep, but check for updates.

#### Detect inactive themes

Flag every theme with `status=inactive` that is not a parent theme of the active theme. Inactive themes are a security surface — files remain on disk and may be exploited. Mark as `severity: warning`.

### 5) Build the findings JSON

Write `findings/<check>.json` before writing the HTML report. Each finding must follow this structure:

```json
{
  "severity": "critical | high | warning | info",
  "category": "wordpress",
  "title": "<short human title>",
  "evidence": "<what you found>",
  "recommendation": "<what to do>",
  "owner": "dev | client | agency",
  "follow_up": true,
  "red_flag": false
}
```

Severity guide for this skill:
- `critical` — duplicate plugins detected, or a core update that is a security release
- `high` — major plugin/theme updates available, or core update pending (non-security)
- `warning` — inactive plugins or themes present, minor/patch updates available
- `info` — everything up to date, auto-updates active

Mark `red_flag: true` only for: duplicate plugins detected, or a WordPress core security release that has not been applied.

### 6) Build the HTML report

Write `reports/<check>.html` as a self-contained HTML file. The report must include these sections:

#### Section A — WordPress Core

| Field | Value |
|---|---|
| Installed version | e.g. `6.9.1` |
| Latest available | e.g. `6.9.2` |
| Update type | `major / minor / patch / up to date` |
| Update pending | `Yes / No` |
| Recommendation | e.g. "Apply minor update — low risk" |
| Release notes link | Link to wordpress.org/news when a version is known |

#### Section B — Plugin Inventory Table

Columns:
| Plugin Name | Status | Current Version | Latest Version | Update Type | Category | Auto-Update | Risk | Recommendation |
|---|---|---|---|---|---|---|---|---|

Color-code rows:
- 🔴 Red — `critical` (duplicate, security update)
- 🟠 Orange — `high` (major update)
- 🟡 Yellow — `warning` (inactive, minor/patch update)
- 🟢 Green — up to date and active

#### Section C — Inactive Plugins (Security Alert)

List each inactive plugin in a dedicated alert block:
```
⚠️  INACTIVE PLUGIN: <name> v<version>
Risk: Unpatched vulnerabilities may be exploited even when deactivated.
Recommendation: Remove from server or activate and update.
```

#### Section D — Duplicate Plugins (Critical Alert)

If any duplicates are found:
```
🔴 DUPLICATE PLUGIN DETECTED: <slug>
Versions found: <v1>, <v2>
Risk: Conflicting code, unpredictable behaviour, security exposure.
Recommendation: Immediately remove duplicate — keep only the latest version.
```

#### Section B2 — Search Engine Visibility

| Setting | Value | Status |
|---|---|---|
| `blog_public` | 0 / 1 | OK / CRITICAL |
| X-Robots-Tag header | present / absent | — |
| `noindex` in HTML | found / not found | — |

#### Section B3 — robots.txt Health

| Check | Status |
|---|---|
| HTTP response | 200 OK / ERROR |
| `Disallow: /` for Googlebot | NOT FOUND (OK) / FOUND (CRITICAL) |
| Sitemap reference | Found / Missing |
| Suspicious content | None / DETECTED |

#### Section B4 — Debug Configuration

| Constant | Value | Status on Production |
|---|---|---|
| `WP_DEBUG` | true/false | OK / HIGH |
| `WP_DEBUG_DISPLAY` | true/false | OK / CRITICAL |
| `WP_DEBUG_LOG` | true/false | Acceptable / OK |

#### Section B5 — Sitemap.xml

| Check | Status |
|---|---|
| HTTP response | 200 OK / ERROR |
| Suspicious content | None / DETECTED |

#### Section B6 — SSL Certificate

| Check | Value |
|---|---|
| Expiry date | YYYY-MM-DD |
| Days remaining | N |
| Status | OK / WARNING / CRITICAL |

#### Section B7 — Security Exposure

| Endpoint | HTTP Status | Risk |
|---|---|---|
| `/xmlrpc.php` | 403 / 200 | OK / HIGH |
| `/readme.html` | 404 / 200 | OK / WARNING |
| `/license.txt` | 404 / 200 | OK / INFO |
| `/wp-content/uploads/` | 403 / 200 | OK / HIGH |
| `<meta generator>` | absent / present | OK / WARNING |

#### Section B8 — wp-config.php Permissions

| Check | Value | Status |
|---|---|---|
| File permissions | e.g. `640` | OK / WARNING / CRITICAL |

#### Section B9 — Cron Event Backlog

| Check | Value | Status |
|---|---|---|
| Overdue events | N | OK / WARNING / HIGH |
| Most overdue event | name + delay | — |

#### Section E — Theme Inventory Table

Same columns as plugins. Highlight active theme and parent theme clearly.

#### Section F — Inactive / Default Themes (Alert)

List each inactive or removable default theme with recommendation.

#### Section G — Update Intelligence Summary

```
Core updates pending:    0 / 1
Plugin updates pending:  X (major: N, minor: N, patch: N)
Theme updates pending:   X
Inactive plugins:        X  ⚠️
Inactive themes:         X  ⚠️
Duplicate plugins:       X  🔴
```

Overall health status: `HEALTHY / NEEDS ATTENTION / CRITICAL`

Expand the summary counters to include new checks:

```
Core updates pending:       0 / 1
Plugin updates pending:     X (major: N, minor: N, patch: N)
Theme updates pending:      X
Inactive plugins:           X  ⚠️
Inactive themes:            X  ⚠️
Duplicate plugins:          X  🔴
Search engine visibility:   OK / CRITICAL
robots.txt:                 OK / WARNING / CRITICAL
Debug mode (production):    OK / HIGH / CRITICAL
Sitemap.xml:                OK / WARNING
SSL certificate:            OK / WARNING / CRITICAL (days remaining: N)
Security exposure:          OK / WARNING / HIGH
wp-config.php permissions:  OK / WARNING / CRITICAL
Cron backlog:               OK / WARNING / HIGH
```

### 7) Publish and close

After writing both files, publish the HTML report using the publish helper:

```bash
/usr/local/bin/paperclip-publish-artifact \
  --issue <child-issue> \
  --file <task-folder>/reports/<check>.html \
  --label "WordPress Health Audit" \
  --summary "<one-line summary: e.g. '21 plugins, 3 updates pending, 2 inactive plugins'>"
```

Do NOT use `paperclip-work-product` with a `file://` URL — use `paperclip-publish-artifact` so the report is accessible as an openable HTTPS link.

After the publish helper returns `ok: true`, mark the child issue done:

```bash
paperclip-update-issue-status --issue <child-issue> --status done
```

The child is not complete until both the published work product and the `done` status exist. A comment alone is not sufficient.

### 8) Slack notification (conditional)

After step 7 completes, check `findings/<check>.json` for notification triggers:

**Send alert when any of the following are true:**
- Any finding with `severity: critical`
- Core update pending (`update_type: major`, `minor`, or `patch`)
- Any plugin or theme update available
- Any `red_flag: true` finding

**Send OK when all checks pass with no pending updates.**

Use `agency-comms` skill or direct webhook:

```bash
paperclip-slack-notify \
  --channel "#maintenance" \
  --message "<assembled message>" \
  --issue <child-issue>
```

If `paperclip-slack-notify` is unavailable, use the webhook directly:

```bash
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"<assembled message>"}' \
  "$SLACK_WEBHOOK_URL"
```

Slack webhook secret reference: `op://Agency/Slack Webhook Maintenance/url`

Message format — clean run:
```
✅ [<project-slug>] Weekly WP audit passed — no updates or issues found.
Report: <artifact-url>
```

Message format — updates or warnings:
```
⚠️ [<project-slug>] WP audit — <N> issues found

WordPress core: <current> → <latest> (<update_type>)
Plugins with updates: N
Critical findings: N

Report: <artifact-url>
Ticket: <issue-id>
```

Message format — critical / red flag:
```
🔴 [<project-slug>] CRITICAL — <finding title>
Immediate action required. See report: <artifact-url>
```

Only send one Slack message per run. Skip the notification step (not the run itself) if `$SLACK_WEBHOOK_URL` is not set and `paperclip-slack-notify` is unavailable — record the skip in the report.

## Schedule / Routine trigger

This skill is compatible with Paperclip Routines for automated weekly execution.

Expected routine payload:

```json
{
  "client_slug": "<client>",
  "project_slug": "<project>",
  "environment": "production",
  "checks": ["wp-health-audit"],
  "notify_slack": true,
  "slack_channel": "#maintenance"
}
```

Supported parameters:
- `--notify-slack <true|false>` — send Slack notification after audit (default: `true` for production, `false` for development)
- `--slack-channel <#channel>` — override default channel (default: `#maintenance`)

When triggered by a Routine, the Maintenance Orchestrator creates the parent issue and child. The WordPress Agent runs this skill as the child task. On completion, Slack notification fires before the child is marked `done`.

## Output contract

```txt
<task-folder>/reports/<check>.html     ← rich HTML report (published via paperclip-publish-artifact)
<task-folder>/findings/<check>.json    ← machine-readable findings array
```

### Human Verification Checklist

Every run appends a `## ⚠️ Human Verification Required` section at the bottom of the HTML report listing items the agent cannot verify automatically. This section is **mandatory** — no checklist item silently drops. Items include (but are not limited to):

- Backup: restore test completed in isolated environment?
- Content: texts, prices, contacts are current?
- Forms: submissions received correctly (CRM/email verified)?
- Checkout/payment flow: test transaction completed?
- Plugin/theme vendors: trusted and actively maintained?
- GDPR: cookie consent works for jurisdiction?
- Analytics: GA4/GTM data collecting correctly?
- User roles: minimum privilege principle applied?
- Client sign-off: visual result approved?

The section must include `Owner:` and `Due:` fields so it is assignable and trackable.

Do not write or modify combined rollup files (`findings.json`, `final-report.html`, `orchestrator-summary.html`, `dashboard-summary.json`, `slack-summary.txt`). Those are owned by Maintenance Orchestrator.

## Severity guide (full)

| Severity | When to use |
|---|---|
| `critical` | Duplicate plugins; core security release not applied; `WP_DEBUG_DISPLAY=true` on prod; `blog_public=0` on prod; SSL expired or < 14 days; robots.txt blocks Googlebot; suspicious injection in robots.txt/sitemap; `wp-config.php` permissions 666/777 |
| `high` | Major plugin/theme updates; core update pending (non-security); `WP_DEBUG=true` on prod; `xmlrpc.php` returns 200; SSL expires within 30 days; cron backlog > 24 hours |
| `warning` | Inactive plugins or themes; minor/patch updates; no Sitemap in robots.txt; sitemap.xml HTTP != 200; SSL expires within 60 days; `readme.html` returns 200; `<meta generator>` present; `wp-config.php` world-readable; cron backlog > 1 hour |
| `info` | Everything up to date; expected staging behaviour; `WP_DEBUG_LOG=true` only; all security checks pass |

Mark `red_flag: true` only for: duplicate plugins; core security release not applied; `WP_DEBUG_DISPLAY=true` on production; `blog_public=0` on production; SSL certificate expired; injection detected in robots.txt or sitemap.xml; `wp-config.php` permissions 666 or 777.

## Safety rules

- Do not apply updates.
- Do not activate or deactivate plugins or themes.
- Do not modify `wp-config.php` or any WordPress file.
- Do not delete users, posts, or any content.
- Do not print or store raw secret values.
- Do not send Slack notifications if `$SLACK_WEBHOOK_URL` is unset and `paperclip-slack-notify` is unavailable — skip and log.
- If a remediation is needed, recommend a follow-up issue for human approval — do not execute it.
- If WP-CLI is not available or `--path` is wrong, record the check as `blocked` and do not invent results.
