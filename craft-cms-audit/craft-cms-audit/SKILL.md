---
name: craft-cms-audit
slug: craft-cms-audit
description: >-
  Use when performing a read-only Craft CMS health audit for a scoped Support
  run: core vs latest, full plugin inventory with license status, queue/cache/log
  samples, production config hygiene, exposed-file checks, and optional
  Playwright smoke. Produces DIT-shaped specialist HTML and JSON for Maintenance
  Orchestrator ingest. Do not use for applying Craft updates, deploying, or
  general CMS setup.
---

# Craft CMS Audit

Shared Support skill for **any** Craft client/project. Do not store a site URL, Craft path, or credentials in this skill folder.

## When to use

Use when the selected check is **`craft-cms-audit`** and you need:

- Craft core current version vs latest available
- Full installed plugin inventory with update status and `license_status` (not updates-only)
- Read-only queue depth (`php craft queue/info`)
- Read-only cache status when a cache plugin is installed (never flush)
- License expiry / mismatch signals (no key dumps)
- Sampled `storage/logs` (same caution as WordPress log sampling)
- Production hygiene (`devMode`, `allowUpdates`, environment mismatch)
- Read-only security surface (public `/.env`, `/composer.json`)
- Optional homepage Playwright smoke when a public site URL is in scope

This skill is **read-only**. It collects evidence; it does not apply updates or modify Craft.

Targets Craft CMS 3.x, 4.x, and 5.x. Requires Craft CLI. Playwright smoke requires Node.js >= 20 when a site URL is provided.

## Who owns what

| Role | Owns |
| --- | --- |
| **Maintenance Orchestrator** (parent) | Scope, child issues, rollup, **`dit-ingest-diff`**, **`al-push-result`**, parent `final-report.html` |
| **Craft CMS Health Audit Agent** (this skill) | Collection, `reports/craft-cms-audit.html`, `findings/craft-cms-audit.json`, child work product |
| **Report / Triage Agent** | Review of specialist + draft rollup; does not rewrite Craft JSON |
| **Access Layer Gateway Orchestrator** | AL bookends only (`al-parse-command` / `al-push-result`). Does **not** attach this skill |

Do **not** attach `al-parse-command`, `al-push-result`, `dit-ingest-diff`, or `paperclip-dit-monitoring` to the Craft specialist. DIT Monitoring is filled by the parent: ingest mapping → **`dit-ingest-diff`** → **`al-push-result`** → Access Layer → DM.

## Inputs required (per run — never from skill `.env`)

Every run must have explicit scope from the parent child issue. If any required field is missing, **block** and ask. Do not guess. Do not fall back to `example.com` or a leftover `.env` in the suite folder.

Required:

- `client_slug`
- `project_slug`
- `environment`: `production`, `staging`, or `development`
- selected check: `craft-cms-audit`
- Craft root path (filesystem or approved SSH target)
- public site URL (for security HTTP checks and smoke)
- Paperclip child issue (`--issue`)
- orchestrator task folder

Optional per-client (1Password / runtime secrets — not files in this skill):

```txt
Item: <client-slug>.<project-slug>.prod.craft
CRAFT_PROD_SITE_URL
CRAFT_PROD_PATH
CRAFT_PROD_SSH_HOST          # when CLI is remote
CRAFT_PROD_CP_USERNAME       # optional CP login smoke
CRAFT_PROD_CP_PASSWORD       # optional CP login smoke
CRAFT_PROD_CP_LOGIN_PATH     # default /admin/login
```

Use `staging` / `dev` prefixes when `environment` is not production. Do not keep a skill-local `.env`.

Optional smoke overrides (process env for **this process only**):

- `SMOKE_BASE_URL` — required to run Playwright; must equal the scoped site URL
- `SMOKE_CRITICAL_PATHS` — default `/` only
- `SMOKE_TEMPLATES_JSON` — skip templates unless set
- `SMOKE_CP_USERNAME` / `SMOKE_CP_PASSWORD` / `SMOKE_CP_LOGIN_PATH`
- `SMOKE_ARTIFACT_DIR` — must be `<task-folder>/artifacts/craft-cms-audit`

Do not run form-submit tests. Do not post Slack from this skill; delivery is Access Layer / parent Slack summary.

## Procedure

### 0 Safety guardrails

1. Confirm `--path` / Craft root matches `client_slug` + `project_slug` + `environment`.
2. Never run `php craft update`, `php craft setup/app-id`, plugin install/uninstall, or any write CLI.
3. Never run `php craft queue/run`, `queue/retry`, `cache/flush`, or any cache-invalidate command.
4. Never `cat` a full `.env`. Never print secret values, license keys, or purchase codes.
5. Never load a `.env` from this skill directory. Site identity comes from the run scope.
6. If Craft CLI is missing, **skip** queue / cache / logs / licenses with `"status": "skipped"` — do not invent counts or license values.

### 1 Verify Craft CLI

```bash
cd <craft-root>
php craft help
```

If CLI is missing, record the check as `blocked` in findings JSON (`follow_up: true` only if a human must restore access). Do not fabricate inventory.

### 2 Core version and updates

```bash
cd <craft-root>
php craft update/info --type=composer --format=json
```

Record `craftcms/cms` as core: installed, latest, whether an update is available. Also capture PHP / platform constraints from Composer/`php craft php/info` when available so update recommendations are not "update now" on unmet requirements.

### 2b Production config hygiene

Read **only** these keys (from the process environment, `php craft php/info`, or a line-filtered `.env` grep of these names):

- `CRAFT_ENVIRONMENT` / `ENVIRONMENT`
- `CRAFT_DEV_MODE` / `DEV_MODE`
- `CRAFT_ALLOW_UPDATES` / `ALLOW_UPDATES`

On **production**:

- `CRAFT_DEV_MODE=true` → finding `craft.config:devMode`, severity `critical`, `red_flag: true`
- `CRAFT_ALLOW_UPDATES=true` → `craft.config:allowUpdates`, severity `high`
- environment `dev`/`development` on a production target → `craft.config:environment`, severity `warning`

### 2c Security exposure

```bash
curl -o /dev/null -s -w "%{http_code}" <site-url>/.env
curl -o /dev/null -s -w "%{http_code}" <site-url>/composer.json
curl -o /dev/null -s -w "%{http_code}" <site-url>/vendor/autoload.php
```

- `/.env` 200 → `craft.security:exposed-env`, `critical`, `red_flag: true`
- `/composer.json` 200 → `craft.security:exposed-composer`, `high`
- 403 or 404 → pass confirmation, `follow_up: false`

### 3 Full plugin inventory

```bash
cd <craft-root>
php craft plugin/list --json 2>/dev/null || php craft plugin/list
```

Record **every** installed plugin (enabled and disabled), not updates-only. Map update/info rows onto the same handles. Each row must include `handle`, `slug` (= handle), and `license_status`: `valid` | `expired` | `missing` | `trial` | `unknown`.

Disabled plugins: one finding `craft.plugins:inactive` (`warning`) **or** a `recommendation` on each inactive inventory row — do not emit one finding per plugin update.

Do not emit `themes[]` (Craft has no WordPress themes). Leave themes absent.

### 3b Queue (read-only)

```bash
cd <craft-root>
php craft queue/info
```

If the command is missing or errors, set `"queue": { "status": "skipped", "reason": "<exact error>" }` and omit `queue_waiting` / `queue_failed`. Do not guess.

When it succeeds:

- Top-level scalars `queue_waiting` and `queue_failed` (integers)
- Nested `"queue": { "status": "completed", "waiting": <n>, "failed": <n> }`
- Failed jobs → finding `craft.queue:failed` (`high` if any failed; `red_flag: true` when failed ≥ 1 and production)
- Waiting backlog that looks stuck (site-specific; default: waiting ≥ 50 **or** evidence of jobs not draining) → `craft.queue:backed-up` (`warning`)

Never retry or run the queue.

### 3c Cache (read-only)

Do **not** run `php craft cache/flush` or any plugin flush/warm command.

If a cache plugin is installed (for example Blitz), record **status only** (enabled, driver/hint if visible without writes). Nested `"cache": { "status": "completed", "plugin": "<handle>", "note": "Read-only status only; cache was not flushed." }`.

If no cache plugin and no safe read-only status command exists: `"cache": { "status": "skipped", "reason": "no cache plugin or read-only status command" }`.

Stale / misconfigured cache evidence (without flushing) → `craft.cache:invalidation` (`warning`).

### 3d Licenses (no key dumps)

Collect Craft edition / plugin license **status** from CP, `plugin/list`, or Composer extras — **never** print license keys.

- Per plugin: `license_status` as above. `unknown` when the status cannot be read.
- Nested `"licenses": { "status": "completed" }` or `"skipped"` with reason
- Expired → finding `craft.license:expired` (`high`); missing where a paid plugin expects a key → `craft.license:missing` (`high`); edition/plugin mismatch → `craft.license:mismatch` (`warning`)
- Do not emit one finding per valid license. Summarize expired/missing in findings; keep per-plugin status on inventory rows.

### 3e Logs (sample only)

Sample recent lines under `<craft-root>/storage/logs` (typical `web.log` / `phperrors.log`). Same rules as WordPress log sampling:

- Read a **tail** only (last ~200 lines per sampled file). Do not dump the whole file.
- Redact secrets, tokens, emails, and paths that look like credentials.
- Nested `"logs": { "status": "completed", "sampled_files": ["web.log"], "note": "Sampled recent lines only; no secrets dumped." }` or `"skipped"` if the directory is unreadable
- Actionable errors → findings with stable ids `craft.logs:<topic>` (for example `craft.logs:php-fatal`). Pass confirmation uses `follow_up: false`.

### 4 Playwright smoke (optional, multi-site)

Skip smoke when no public site URL is in scope; record `smoke_test.skipped` and `follow_up: false`.

Suite path: this skill’s `craft-smoke-test-suite/` or `/shared/skills/craft-cms-audit/craft-smoke-test-suite/`.

```bash
SUITE_DIR="${SMOKE_SUITE_PATH:-/shared/skills/craft-cms-audit/craft-smoke-test-suite}"
if [ ! -d "$SUITE_DIR" ]; then SUITE_DIR="<skill-dir>/craft-smoke-test-suite"; fi

ARTIFACT_DIR="<task-folder>/artifacts/craft-cms-audit"
mkdir -p "$ARTIFACT_DIR"

cd "$SUITE_DIR"
if [ ! -d "node_modules" ]; then npm ci && npx playwright install chromium; fi

SMOKE_BASE_URL="<site-url>" \
SMOKE_CRITICAL_PATHS="/" \
SMOKE_ARTIFACT_DIR="$ARTIFACT_DIR" \
npm test
```

The suite **fails closed** without `SMOKE_BASE_URL`. It does not read a skill-local `.env`. Write Playwright output only under `SMOKE_ARTIFACT_DIR` so concurrent clients cannot clobber each other.

Default smoke is homepage availability, console errors on `/`, and CP login page. Extra paths, templates, CP credentials, `SMOKE_CHECK_SEO=1`, and `SMOKE_CHECK_LINKS=1` are per-run env from the client project — never hardcoded in this skill. Do not submit forms. Deeper browser QA belongs to **`frontend-audit`**.

Read `SMOKE_ARTIFACT_DIR/results.json` into `smoke_test`.

### 5 Finding JSON (required for DIT)

Write **`<task-folder>/findings/craft-cms-audit.json`** as a **JSON object** (not a bare array). The Maintenance Orchestrator copies **top-level** keys into the ingest for **`al-push-result`**.

| Required top-level key | Rule |
| --- | --- |
| `findings` | Array of finding objects (stable `id`, `scope: cms`, `recommendation`, `follow_up`) |
| `plugins` | **Every installed plugin** — not updates-only, not name-only, not “N plugins” in HTML only |
| `plugin_count` | Integer = `plugins.length` |
| `pending_updates` | Integer = plugins with an available update (when known) |
| `craft_version` | Installed core version string |
| `cms` / `cms_type` | `"craft"` so DIT shows the Craft version label |
| `check` | `craft-cms-audit` |

Optional top-level keys (omit numbers when skipped — do not invent):

| Optional key | Rule |
| --- | --- |
| `queue_waiting` / `queue_failed` | Integers from `php craft queue/info` only |
| `queue` / `cache` / `licenses` / `logs` | Objects with `"status": "completed"` or `"skipped"` (plus `reason` when skipped) |

Each plugin object must use **DIT ingest field names**: `name`, `version`, `status`, `update`, `update_version`, plus Craft `handle`, `slug` (= handle), and `license_status` (`valid` \| `expired` \| `missing` \| `trial` \| `unknown`). Map aliases (`installed` → `version`, `latest` → `update_version`). `update` must be a **string**: `"available"` or `"none"` — never boolean `false`.

On rows with an update or expired/missing license, set `recommendation`. Do not set `scope` on inventory rows. Do not emit one `findings[]` item per plugin update.

HTML alone is **not** enough for DIT inventory.

Finding `id` examples: `craft.config:devMode`, `craft.security:exposed-env`, `craft.queue:failed`, `craft.queue:backed-up`, `craft.cache:invalidation`, `craft.license:expired`, `craft.license:missing`, `craft.license:mismatch`, `craft.logs:php-fatal`, `craft.inventory:complete`. Never copy `title` into `id`. Specialist JSON may use severity `warning`; the **parent** maps ingest `warning` → `medium`.

The Maintenance Orchestrator copies **top-level** `plugins` (including `handle` / `slug` / `license_status`), `craft_version`, `cms` / `cms_type`, `plugin_count`, `pending_updates`, `findings`, and when present `queue_waiting` / `queue_failed`. Nested `queue` / `cache` / `licenses` / `logs` stay in specialist JSON as evidence; DIT inventory uses plugins + findings. Optional nested `system.core` is extra evidence only.

Canonical specialist output (placeholders only). Copy this **shape** — never reuse these client/plugin names as if they were a real site:

```json
{
  "check": "craft-cms-audit",
  "status": "completed",
  "client_slug": "example-client",
  "project_slug": "example-site",
  "environment": "production",
  "cms": "craft",
  "cms_type": "craft",
  "craft_version": "5.7.5",
  "plugin_count": 3,
  "pending_updates": 1,
  "queue_waiting": 2,
  "queue_failed": 1,
  "plugins": [
    {
      "name": "SEOmatic",
      "handle": "seomatic",
      "slug": "seomatic",
      "version": "5.1.0",
      "status": "active",
      "update": "available",
      "update_version": "5.1.2",
      "license_status": "valid",
      "recommendation": "Test SEO templates on staging before updating."
    },
    {
      "name": "Blitz",
      "handle": "blitz",
      "slug": "blitz",
      "version": "5.9.0",
      "status": "active",
      "update": "none",
      "update_version": null,
      "license_status": "valid"
    },
    {
      "name": "Example Expired Plugin",
      "handle": "example-expired",
      "slug": "example-expired",
      "version": "2.0.0",
      "status": "inactive",
      "update": "none",
      "update_version": null,
      "license_status": "expired",
      "recommendation": "Renew the plugin license or uninstall if unused."
    }
  ],
  "queue": {
    "status": "completed",
    "waiting": 2,
    "failed": 1
  },
  "cache": {
    "status": "completed",
    "plugin": "blitz",
    "note": "Read-only status only; cache was not flushed."
  },
  "licenses": {
    "status": "completed"
  },
  "logs": {
    "status": "completed",
    "sampled_files": ["web.log"],
    "note": "Sampled recent lines only; no secrets dumped."
  },
  "findings": [
    {
      "id": "craft.inventory:complete",
      "severity": "info",
      "scope": "cms",
      "category": "craft",
      "title": "Craft CMS inventory completed",
      "evidence": "Core 5.7.5; plugins: 3; pending updates: 1.",
      "recommendation": "No action required.",
      "owner": "Craft CMS Health Audit Agent",
      "follow_up": false,
      "red_flag": false
    },
    {
      "id": "craft.queue:failed",
      "severity": "high",
      "scope": "cms",
      "category": "craft",
      "title": "Craft queue has failed jobs",
      "evidence": "php craft queue/info: waiting 2, failed 1.",
      "recommendation": "Inspect failed jobs in the control panel; fix the cause before retrying.",
      "owner": "Craft CMS Health Audit Agent",
      "follow_up": true,
      "red_flag": true
    },
    {
      "id": "craft.license:expired",
      "severity": "high",
      "scope": "cms",
      "category": "craft",
      "title": "Plugin license expired",
      "evidence": "example-expired license_status=expired.",
      "recommendation": "Renew the license or remove the plugin if it is unused.",
      "owner": "Craft CMS Health Audit Agent",
      "follow_up": true,
      "red_flag": false
    }
  ],
  "smoke_test": {
    "availability": "pass",
    "console_errors": 0,
    "skipped": false
  }
}
```

When a read-only check cannot run, use skipped status **without** fake numbers:

```json
{
  "queue": { "status": "skipped", "reason": "php craft queue/info unavailable" },
  "cache": { "status": "skipped", "reason": "no cache plugin or read-only status command" },
  "logs": { "status": "skipped", "reason": "storage/logs not readable" }
}
```

Do not set `queue_waiting` / `queue_failed` on skipped queue checks.

### 6 HTML report

Write `<task-folder>/reports/craft-cms-audit.html` with:

- Red flags first
- Core status (current vs latest, platform requirements)
- **Installed plugins** table (full list, including handle and license status) and a separate **Updates pending** section
- Queue (or skipped)
- Cache status (or skipped) — never claim a flush was run
- Licenses (expired/missing only in detail; no keys)
- Log sample summary (or skipped)
- Security and config
- Smoke summary (or skipped)
- Blocked access named explicitly

## Native work product

After both files exist:

```bash
/usr/local/bin/paperclip-publish-artifact \
  --issue <child-paperclip-issue> \
  --file <task-folder>/reports/craft-cms-audit.html \
  --label "Craft CMS audit report" \
  --summary "<one sentence: core version + plugin/update summary>"
```

Then `paperclip-update-issue-status --issue <child> --status done` and **stop**. Do not mention Maintenance Orchestrator with `[@Agent](agent://...)`. Do not run `dit-ingest-diff` or `al-push-result`.
