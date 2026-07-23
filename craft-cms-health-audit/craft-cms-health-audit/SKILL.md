---
name: craft-cms-health-audit
description: "Use when performing a detailed Craft CMS health and verification audit: runs Playwright smoke tests, verifies frontend templates, contact forms, Control Panel login, check queue health, project-config drift, core/plugin licenses, devMode exposure, web error logs, and asset volume accessibility. Read-only — no writes, no updates."
compatibility: "Targets Craft CMS 3.x, 4.x, and 5.x. Requires Playwright test runner. Craft MCP (stimmt/craft-mcp) is highly recommended for full introspection checks but optional."
---

# Craft CMS Health & Verification Audit

## When to use

Use this skill when you need to perform a **post-deploy or scheduled health audit** on a site running Craft CMS. Specifically when you need to:

- Verify frontend page rendering and console errors via headless browser testing.
- Test form submissions and Control Panel login end-to-end.
- Introspect the internal state of the Craft CMS installation (queue backlog, project-config drift, core/plugin licenses, and error logs) — **requires Craft MCP**.
- Confirm that the production environment is secure (debug/devMode is off, file permissions are correct, dangerous MCP tools are disabled).

This skill is read-only. It collects evidence, reports problems, and opens tickets for human review. It never applies updates, applies project-config changes, clears queues with side effects, or writes to the database.

---

## Inputs required

- `--url=<site-url>` — base URL of the Craft CMS site to check.
- `--mcp-url=<mcp-endpoint>` — **(Optional)** the remote HTTP URL of the stimmtdigital/craft-mcp endpoint. If omitted, internal introspection checks (queue, project config, logs) are skipped.
- `--mcp-token=<bearer-token>` — **(Optional)** the bearer token to authenticate with the remote Craft MCP instance.
- `--environment=<env>` — environment context: `production`, `staging`, or `development`.
- `--issue=<issue-id>` — the Paperclip child issue identifier (e.g., `SUP-306`).
- `--forms-config=<json>` — JSON string specifying form test selectors and input values (for end-to-end form verification).
- `--cp-user=<username>` — username/email for the Control Panel login test.
- `--cp-password=<password>` — password secret reference for the Control Panel login test.

---

## Procedure

### 0) Safety guardrails

This skill operates strictly in **read-only** mode. 

1. **Verify MCP Security Status First (If MCP is configured)**:
   - Query the remote MCP server to list its available tools.
   - If the remote server lists `tinker`, `run_query`, `write_file`, or `execute_command` as available, or if the config reports `enableDangerousTools: true` on a `production` environment, **halt execution**, log a `critical` security finding, and warn the operator.
   - The remote token must be scoped to `readonly`.
2. **No Mutating Operations**:
   - Never run command-line commands like `php craft update`, `php craft project-config/apply`, or `php craft queue/run`.
   - Never trigger MCP actions that write entries, modify fields, or execute database updates.

---

### 1) Verify connection and Tooling availability

Verify that the target website is reachable. If `--mcp-url` and `--mcp-token` are provided, verify the MCP connection.

```bash
# Check website HTTP status
curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 <site-url>
```

If the main website is unreachable (e.g., returns 5xx, timeouts), mark the audit as `failed` and stop.

If MCP is configured, verify the connection using the provided `--mcp-token`:
```bash
# Example HTTP handshake with MCP endpoint
curl -s -X POST -H "Authorization: Bearer <mcp-token>" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"tools/list","params":{}}' \
     <mcp-url>
```

If the MCP handshake fails (e.g., returns `401 Unauthorized` or connection timeouts), log a `warning` and proceed to run **only** the Playwright Smoke Tests (skipping checks 2 to 8). If MCP credentials are not provided at all, gracefully skip checks 2 to 8 and note in the report: *"MCP Introspection skipped (Not configured)"*.

---

### 2) Craft CMS Core & System Checks

Query the Craft MCP server (using the `craft_info` tool or system resource queries) to check:
1. **Installed version vs. Latest version**: Identify if major/minor/patch updates are available for the Craft CMS core.
2. **`devMode` check**: Verify whether `devMode` is active.
   - If `devMode = true` on `production` $\rightarrow$ severity: `critical`, `red_flag: true` (security and performance exposure).
3. **`allowUpdates` check**: Verify whether `allowUpdates` is active in `config/general.php`.
   - If `allowUpdates = true` on `production` $\rightarrow$ severity: `warning` (updating directly on production bypasses project config and git).

---

### 3) Project-Config Status Check

Check if there is pending config drift (meaning the files in `config/project/` differ from the database schema).

*   **Command (via SSH fallback)**: `php craft project-config/status`
*   **MCP query**: Check if the schema or project config state indicates a mismatch.

**Result interpretation:**
- "Project config is in sync" $\rightarrow$ severity: `info`, status OK.
- "Project config is not in sync" (changes pending) $\rightarrow$ severity: `critical`, `red_flag: true` (can break database mappings, forms, or field layouts).

---

### 4) Queue Status Check

Audit the Craft CMS queue to verify that background jobs (e.g. search indexing, asset indexing, email sends) are running successfully.

*   **Command (via SSH fallback)**: `php craft queue/status`
*   **MCP tool**: Query the queue database table or run queue status checks.

**Result interpretation:**
- Overdue or waiting jobs > 50 $\rightarrow$ severity: `warning`.
- Failed jobs > 0 $\rightarrow$ severity: `high` (requires review to find which job failed and why).
- Queue is locked or has been stuck for > 2 hours $\rightarrow$ severity: `critical`.

---

### 5) License Status Check

Query the licensing status of the Craft CMS core and all installed plugins.

*   **MCP tool**: Read plugin/license manager data.

**Severity on Production:**
- "License is invalid" or "License is expired" for Core $\rightarrow$ severity: `critical`, `red_flag: true` (disables client-facing features or displays public warning banners).
- "License is invalid" for commercial plugins $\rightarrow$ severity: `high`.
- All licenses valid/active $\rightarrow$ severity: `info`.

---

### 6) Asset Volumes Check

Verify that all defined asset volumes (local folders, Amazon S3, Google Cloud Storage, etc.) are reachable and properly configured.

*   **MCP check**: Introspect defined volumes and run checks on connection handles or directory permissions.

**Severity:**
- Volume directory not writable (local) $\rightarrow$ severity: `critical`.
- S3 / remote bucket credentials invalid $\rightarrow$ severity: `critical`.

---

### 7) Plugin Inventory & Updates

Fetch the list of installed plugins, their current versions, and whether updates are available.

*   **Command (via SSH)**: `php craft plugin/list`
*   **MCP tool**: Query plugin schema data.

For each plugin, check:
- Is it active?
- Is an update available?
- Are there known CVEs (Cross-reference with Craft security advisories database)? $\rightarrow$ severity: `critical` if vulnerable.

---

### 8) Error Log Audit

Scan the tail of `storage/logs/web.log` and `storage/logs/queue.log` for PHP Fatals, Database exceptions, or runtime warnings.

*   **MCP tool**: Read/fetch recent logs.

**Severity:**
- `PHP Fatal Error` or `DbException` within the last 24 hours $\rightarrow$ severity: `high` or `critical` (depending on frequency).
- `Exception` or `yii\base\ErrorException` $\rightarrow$ severity: `warning`.

---

### 9) Playwright Smoke Tests (Verification Layer)

Using the **CraftQuest Smoke Test Suite** wrapped inside a Playwright runner:

Configure `smoke.config.js` pointing to `<site-url>` and execute the test runner:

#### Test A: Availability
- Requests key pages: Home, Contact, Blog list, dynamically configured paths.
- Verifies HTTP status is `200` (rejects 5xx / 4xx errors).

#### Test B: Templates
- Checks that key layout elements are rendered (e.g. `<header>`, `<footer>`, Main nav).
- Verifies that page content is not blank (minimum page length > 1000 characters).

#### Test C: Console Audit
- Monitors the browser's console object during navigation.
- If a `SyntaxError`, `TypeError`, or unhandled promise rejection is thrown $\rightarrow$ severity: `high`.

#### Test D: Link Crawler
- Crawls internal links found on the main layout.
- Flags any broken internal links (404/500 responses).

#### Test E: SEO Metadata
- Verifies the presence of `<title>`, `<meta name="description">`, `og:image`, and `<link rel="canonical">`.
- Compares sitemap.xml urls to ensure they return `200`.

#### Test F: Forms E2E Check
- Navigates to the contact/submission forms (using `--forms-config` selectors).
- Fills in test inputs and clicks submit.
- Verifies success message or DOM changes post-submit.
- If submission fails $\rightarrow$ severity: `critical`, `red_flag: true`.

#### Test G: Control Panel Accessibility
- Navigates to `<site-url>/admin` (or the custom CP trigger path).
- Enters `--cp-user` and `--cp-password` into the login form.
- Verifies the login completes successfully and the admin dashboard (`#nav-dashboard` or similar) is visible.
- If CP login fails $\rightarrow$ severity: `critical` (site administrators locked out).

---

## 5) Build the findings JSON

Write a consolidated `findings.json` (and individual files in `findings/<check>.json`) following the Paperclip findings contract:

```json
{
  "severity": "critical | high | warning | info",
  "category": "craftcms",
  "title": "<short human title>",
  "evidence": "<detailed log output, error details, or failed url>",
  "recommendation": "<steps for a developer to fix the issue>",
  "owner": "dev | client | agency",
  "follow_up": true,
  "red_flag": false
}
```

### Severity Guide
- `critical`: CP login failed, forms broken, project-config drift, invalid core license, `devMode = true` in prod, or S3 asset volumes disconnected.
- `high`: Stuck queue tasks, failed queue jobs, plugin vulnerabilities, console exceptions on critical pages.
- `warning`: Pending minor core/plugin updates, expired plugin licenses, `allowUpdates = true` in prod.
- `info`: Everything fully operational, minor non-critical notifications.

---

## 6) Build the HTML report

Generate `reports/craft-health-report.html` as a self-contained, beautifully styled HTML document. Include:

1. **Dashboard Summary**:
   - Overall Status: `HEALTHY`, `NEEDS ATTENTION`, or `CRITICAL`.
   - Core version, PHP version, and Database status.
2. **Introspection Section**:
   - Project-Config Sync status (Sync/Drift).
   - Queue Status (Total pending, failed count).
   - Core & Plugin Licenses status.
   - Active plugin list and update warnings.
3. **Verification Section (Playwright Results)**:
   - Page checklist with response times.
   - Console logs (highlighting errors).
   - Form submission result with screenshot thumbnail.
   - Control Panel login status.
4. **Log Review**:
   - Display the last 15 critical errors or exceptions caught in the logs.

Once built, publish the HTML report using `paperclip-publish-artifact` to generate the URL (e.g., `https://paperclip.designingit.co/artifacts/...`) and attach it to the parent ClickUp task/Paperclip issue comment.
