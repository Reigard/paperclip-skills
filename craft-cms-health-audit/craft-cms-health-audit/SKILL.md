---
name: craft-health-audit
description: "Use when performing a detailed Craft CMS health audit: structured plugin inventory with version comparison, core update check, security, and performance check. Produces a rich HTML report and machine-readable JSON. Read-only — no writes, no updates."
compatibility: "Targets Craft CMS 3.x, 4.x, and 5.x. Requires Craft CLI in the execution environment."
---

# Craft CMS Health Audit

## When to use

Use this skill when the task requires a **detailed, structured Craft CMS health audit** that goes beyond basic inventory. Specifically when you need:

- A full plugin list with **current version → latest available version** comparison
- **Craft core** current version vs latest available (is an update pending?)
- Detection of **inactive plugins** or outdated licenses
- General health checks (devMode, caching, db backup status)

This skill is read-only. It collects evidence; it does not apply updates or modify Craft in any way.

## Inputs required

- `--path=<craft-root>` — absolute path to the Craft installation
- Environment confirmation: `production`, `staging`, or `development`
- The Paperclip child issue identifier (`--issue`)

## Procedure

### 0) Safety guardrails

This skill is **read-only**. Before running any command:

1. Confirm you have `--path` pointing to the correct Craft installation.
2. Never run `php craft update all` or any write operation.
3. Only use read-only inspection commands.

### 1) Verify Craft CLI availability

```bash
cd <craft-root>
php craft help
```

If Craft CLI is not available, record the check as `blocked` and report the missing tooling. Do not fabricate results.

### 2) Collect core version and updates data

```bash
cd <craft-root>
# Check if a core/plugin update is available
php craft update/info --type=composer --format=json
```

Expected output fields per update record in the JSON:
- `name` — package name (e.g. `craftcms/cms` for core)
- `installed` — current version
- `latest` — latest available version
- `status` — whether an update is available

If the core is up to date, record current version and status.

### 2b) Debug mode / Environment check

```bash
cd <craft-root>
php craft setup/app-id
# (Or read from .env if accessible)
cat .env | grep -E 'CRAFT_ENVIRONMENT|CRAFT_DEV_MODE|CRAFT_ALLOW_UPDATES'
```

Severity on production:
- `CRAFT_DEV_MODE=true` → severity: `critical`, `red_flag: true`
- `CRAFT_ALLOW_UPDATES=true` → severity: `high` (Updates should be done in dev/staging via Composer)
- `CRAFT_ENVIRONMENT=dev` (on a production server) → severity: `warning`

### 2c) Security exposure check

Check for exposed sensitive files:
```bash
curl -o /dev/null -s -w "%{http_code}" <site-url>/.env
curl -o /dev/null -s -w "%{http_code}" <site-url>/composer.json
curl -o /dev/null -s -w "%{http_code}" <site-url>/vendor/autoload.php
```

Expected results:
- `/.env`: 403 or 404 = OK; 200 = severity: `critical`, `red_flag: true`
- `/composer.json`: 403 or 404 = OK; 200 = severity: `high`

### 3) Collect full plugin inventory

```bash
cd <craft-root>
# Full plugin list
php craft plugin/list
```

For each plugin, parse the output and record:
- Name
- Handle
- Version
- Status (Enabled/Disabled)

If you have JSON output from `php craft update/info --type=composer --format=json`, map the installed plugins to their update status (current vs latest).

If a plugin is disabled, record with severity `warning` (inactive plugins should generally be uninstalled).

### 4) CraftQuest Smoke Test Suite

Run frontend health smoke tests using Playwright. 

1. **Bundled Suite (Skill directory):**
   If `craft-smoke-test-suite/craftquest-smoke-suite-1.0.0` is present inside the skill directory:
   ```bash
   cd <skill-dir>/craft-smoke-test-suite/craftquest-smoke-suite-1.0.0
   # Set target URL and execute tests
   SMOKE_BASE_URL=<site-url> npm test
   ```
2. **Project-level Suite:**
   If the suite is installed directly in `<craft-root>`:
   ```bash
   cd <craft-root>
   npm run test
   ```

(Capture the Playwright smoke test results for availability, templates, JS errors, and SEO gaps from `results.json`).

### 5) Format JSON findings

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

### 6) Write HTML Report

Generate a human-readable `reports/craft-health-audit.html` that summarizes:
- **Red flags** (e.g. `CRAFT_DEV_MODE=true` on production, exposed `.env`)
- **Core Status** (Current vs Latest)
- **Plugin Status** (Outdated or Inactive plugins)
- **Security & Config** (AllowUpdates, etc)

Mark the child issue complete with the path to the report.
