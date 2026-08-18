---
name: craft-cms-audit
description: description: Use when performing a detailed Craft CMS health audit with plugin inventory, core update check, security, performance, and Playwright smoke tests. Produces HTML and JSON reports. Read-only, no writes or updates. Don't use for applying Craft updates, deploying, or general CMS setup.
slug: craft-cms-audit
---

# Craft CMS Health Audit

## When to use

Use this skill when the task requires a detailed, structured Craft CMS health audit that goes beyond basic inventory. Specifically when you need:

- A full plugin list with current version to latest available version comparison
- Craft core current version vs latest available
- Detection of inactive plugins or outdated licenses
- General health checks (devMode, caching, db backup status)
- Frontend smoke tests (availability, templates, console errors, SEO)
- Optional Slack notification when smoke tests fail

This skill is read-only. It collects evidence; it does not apply updates or modify Craft in any way.

Targets Craft CMS 3.x, 4.x, and 5.x. Requires Craft CLI and Node.js >= 20 in the execution environment.

## Inputs required

- `--path=<craft-root>` — absolute path to the Craft installation
- `<site-url>` — public base URL of the site under audit
- Environment confirmation: `production`, `staging`, or `development`
- The Paperclip child issue identifier (`--issue`)
- Optional: `SMOKE_SLACK_WEBHOOK` — Slack Incoming Webhook URL (never commit this value)

## Procedure

### 0 Safety guardrails

This skill is **read-only**. Before running any command:

1. Confirm you have `--path` pointing to the correct Craft installation.
2. Never run `php craft update all` or any write operation.
3. Only use read-only inspection commands.

### 1 Verify Craft CLI availability

```bash
cd <craft-root>
php craft help
```

If Craft CLI is not available, record the check as `blocked` and report the missing tooling. Do not fabricate results.

### 2 Collect core version and updates data

```bash
cd <craft-root>
php craft update/info --type=composer --format=json
```

Expected output fields per update record in the JSON:
- `name` — package name (e.g. `craftcms/cms` for core)
- `installed` — current version
- `latest` — latest available version
- `status` — whether an update is available

If the core is up to date, record current version and status.

### 2b Debug mode and environment check

```bash
cd <craft-root>
php craft setup/app-id
# Or read from .env if accessible
cat .env | grep -E 'CRAFT_ENVIRONMENT|CRAFT_DEV_MODE|CRAFT_ALLOW_UPDATES'
```

Severity on production:
- `CRAFT_DEV_MODE=true` → severity: `critical`, `red_flag: true`
- `CRAFT_ALLOW_UPDATES=true` → severity: `high` (Updates should be done in dev/staging via Composer)
- `CRAFT_ENVIRONMENT=dev` on a production server → severity: `warning`

### 2c Security exposure check

Check for exposed sensitive files:
```bash
curl -o /dev/null -s -w "%{http_code}" <site-url>/.env
curl -o /dev/null -s -w "%{http_code}" <site-url>/composer.json
curl -o /dev/null -s -w "%{http_code}" <site-url>/vendor/autoload.php
```

Expected results:
- `/.env`: 403 or 404 = OK; 200 = severity: `critical`, `red_flag: true`
- `/composer.json`: 403 or 404 = OK; 200 = severity: `high`

### 3 Collect full plugin inventory

```bash
cd <craft-root>
php craft plugin/list
```

For each plugin, parse the output and record:
- Name
- Handle
- Version
- Status (Enabled/Disabled)

If you have JSON output from `php craft update/info --type=composer --format=json`, map the installed plugins to their update status (current vs latest).

If a plugin is disabled, record with severity `warning` (inactive plugins should generally be uninstalled).

### 4 Smoke test suite Playwright

Run the suite located at `craft-smoke-test-suite/` (or shared server path `/shared/skills/craft-cms-audit/craft-smoke-test-suite/`).

```bash
# Determine suite directory (local skill dir or shared server path):
SUITE_DIR="${SMOKE_SUITE_PATH:-/shared/skills/craft-cms-audit/craft-smoke-test-suite}"
if [ ! -d "$SUITE_DIR" ]; then SUITE_DIR="<skill-dir>/craft-smoke-test-suite"; fi

cd "$SUITE_DIR"

# Install dependencies if missing on execution runner:
if [ ! -d "node_modules" ]; then npm ci && npx playwright install chromium; fi

SMOKE_BASE_URL=<site-url> npm test
```

Optional env overrides (see `.env.example`):
- `SMOKE_CRITICAL_PATHS` — comma-separated paths (default: `/,/about,/contact`)
- `SMOKE_TEMPLATES_JSON` — JSON array of `{ name, path, expect }`
- `SMOKE_CP_USERNAME` / `SMOKE_CP_PASSWORD` — enables CP login check

Capture results from `results.json` (availability, templates, JS errors, SEO gaps).

### 4b Slack notification optional

If `SMOKE_SLACK_WEBHOOK` is set and the smoke run failed, post a short summary. Never commit the webhook URL.

Provide the webhook as a Paperclip/runtime secret (`SMOKE_SLACK_WEBHOOK`). Create it once in Slack: App → Incoming Webhooks → copy URL.

```bash
# After a failed npm test — adjust Passed/Failed from results.json
curl -sS -X POST -H 'Content-type: application/json' \
  --data "{\"text\":\":red_circle: *Smoke suite failure* — <site-name>\\nURL: <site-url>\\nSee results.json for details\"}" \
  "$SMOKE_SLACK_WEBHOOK"
```

Skip this step if the webhook is unset. On HTTP `403`/`404`, the webhook is wrong or revoked.

### 5 Format JSON findings

Combine the evidence into `findings/craft-health-audit.json`:

```json
{
  "system": {
    "core": {
      "version": "4.4.1",
      "latest": "4.5.0",
      "update_available": true
    },
    "environment": "production",
    "devMode": false,
    "allowUpdates": false
  },
  "plugins": [
    {
      "name": "SEOmatic",
      "handle": "seomatic",
      "version": "4.0.0",
      "update_version": "4.0.1",
      "status": "active"
    }
  ],
  "security": [
    {
      "check": "exposed_env",
      "status": "pass",
      "severity": "info"
    }
  ],
  "smoke_test": {
    "availability": "pass",
    "console_errors": 0
  }
}
```

### 6 Write HTML report

Generate a human-readable `reports/craft-health-audit.html` that summarizes:
- **Red flags** (e.g. `CRAFT_DEV_MODE=true` on production, exposed `.env`)
- **Core Status** (Current vs Latest)
- **Plugin Status** (Outdated or Inactive plugins)
- **Security & Config** (AllowUpdates, etc)
- **Smoke test** summary (and whether Slack was notified)

Mark the child issue complete with the path to the report.