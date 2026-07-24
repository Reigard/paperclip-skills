---
name: paperclip-dit-monitoring
description: >-
  After a Paperclip site maintenance run, build the maintenance report JSON and
  POST it directly to DIT Monitoring. Use when completing maintenance, syncing
  Paperclip runs to dit-monitoring.designingit.co /maintenance, or when the user
  mentions DIT Monitoring ingest, DIT_MONITORING_ID, or maintenance run handoff.
disable-model-invocation: true
---

# Paperclip → DIT Monitoring maintenance handoff

Push a **single maintenance run summary** as JSON in the ingest POST body. DIT Monitoring shows this data on `/maintenance`. ClickUp remains the source of truth for tasks; this flow is a **convenience layer** — failures here must **not** fail the maintenance run.

Read [schema.md](references/schema.md) for the JSON contract and [examples.md](references/examples.md) for samples.

## When to invoke

Run whenever a maintenance-related run is **complete enough** to build the ingest payload — after the reports and findings you rely on exist on disk or as Paperclip artifacts.

**Do not wait** for the parent issue to be `done` or for `final-report.html` to be attached as a native work product. Ingest is **independent of parent finalization** — a blocked parent, cheap recovery, or missing work-product attach must not block ingest when gates below are met.

### Ingest gates (all required)

1. **Review passed** — `report-triage` decision is `pass` or `pass_with_notes` (when triage ran), or no triage was required for this run type.
2. **Rollup artifacts exist** in the task folder: `findings.json`, `final-report.html`, and `findings/<check>.json` for each selected check.
3. **Configuration resolved** — real (non-placeholder) values for ingest URL, token, and `DIT_MONITORING_ID` (see [Configuration](#configuration)).

When gates pass, invoke on the **first orchestrator wake after triage** (or equivalent). Retry on a later wake if a prior attempt skipped or failed — still one POST per `run_id`.

Typical triggers:

- Support System (SUP) multi-agent run: rollup files written and review stage finished (gates above)
- Single-check or specialist-only run: that check’s `findings/<check>.json` (and report) exist
- Manual retry: prior ingest failed but the run itself succeeded
- Operator or automation outside the standard Support System (SUP) loop — same skill, same payload rules

Guidelines:

- **One POST per `run_id`** — retries reuse the same id (server upserts)
- Invoke **in-agent** by following this skill (read task folder → build JSON → HTTP POST). There is **no** required host CLI helper named `paperclip-dit-monitoring`.
- Invoke from whichever agent or workflow **owns the combined evidence** for that run; there is no hard-coded agent name in this skill
- Prefer posting **once** when all selected checks are represented. Partial payloads are OK **only** when a check was **not selected** or its specialist file is genuinely absent — never as a shortcut on cheap/recovery wakes when specialist evidence exists
- Multiple POSTs with the same `run_id` overwrite each other — avoid parallel sends from different contexts
- Ingest failure → warning + `_sync.warnings`; **never** block or re-open the maintenance issue

### Forbidden shortcuts (do not POST these)

These produce a 201 in DIT but an almost-empty maintenance modal. **Never** do them when the corresponding specialist file exists:

| Forbidden | Why |
| --------- | --- |
| Copy rollup `findings.json` → `frontend_audit` compact summary (`core_web_vitals_lab`, top-level `accessibility_score`, finding-count scalars without `pages[]` / `summary{}`) | DIT UI only binds the ingest schema (`pages[]`, nested `summary`, etc.) — compact keys are ignored |
| `jq` / extract only `verdict` + CWV lab from `findings/frontend-audit.json` | Same — drops per-page evidence, findings, screenshots, human verification |
| Hand-build a thin `frontend_audit` with `verdict` alone (or verdict + scores) | Modal shows essentially only the verdict chip |
| Send `plugins[]` / `themes[]` as **name-only** objects when specialist JSON has versions/update fields | Inventory table shows names without versions |
| Omit `wp_version`, `plugin_count`, `pending_updates` when WordPress specialist evidence has them | Info grid hides those vitals |
| Skip full mapping because the wake is cheap, status-only, or recovery | Ingest is independent of parent finalization — still map the full specialist files |

If you cannot map the full object (file unreadable, schema unclear), set `_sync.warnings`, comment on the issue, and **do not** POST a compact stub that pretends the check ran.

## Relationship to Support System (SUP) maintenance orchestration

All Support System (SUP) maintenance agents follow the shared `$support-maintenance-orchestration` skill and `references/report-contract.md`. That contract defines the **task folder** and specialist vs rollup ownership. This skill does **not** replace it — it reads artifacts from the run task folder and maps them to the DIT Monitoring ingest schema.

Do **not** copy `dashboard-summary.json` as-is. Transform it (see [Field mapping](#field-mapping-from-task-folder-artifacts) below).

## Prerequisites

Before POST:

1. Required source artifacts for this run are available (see [Step 1](#step-1--build-the-payload)).
2. HTML report published when you have one (`paperclip-publish-artifact` → openable `https://paperclip.designingit.co/artifacts/...` URL).
3. Machine-readable JSON published when you set `report_json_url` (usually `findings.json` or `dashboard-summary.json` from the task folder).
4. Build payload → POST ingest → update `_sync` → comment on the Paperclip issue.

Skip only when the user explicitly says not to sync to DIT Monitoring.

If configuration cannot be resolved (see [Configuration](#configuration)), record a **warning** on the issue, set `_sync.status = "partial"`, and stop — do not fail the run.

## Configuration

Paperclip company **Support** (issue prefix **SUP**). Store **all three ingest settings on the client Paperclip project** assigned to the maintenance issue (e.g. **CCJ**). The **Support System** project is not used for DIT Monitoring ingest config.

### Where values live

| Variable | Scope | Storage | Purpose |
| -------- | ----- | ------- | ------- |
| `DIT_MONITORING_INGEST_URL` | **Client project** on the issue | Plain project env | Ingest endpoint |
| `DIT_MONITORING_INGEST_TOKEN` | **Client project** on the issue | Project **secret** → company secret `dit_monitoring_ingest_token` | Bearer token for ingest POST |
| `DIT_MONITORING_ID` | **Client project** on the issue | Project **secret** | DIT Monitoring `projects.id` UUID for that client/site |

**Client project** = Properties → Project on the waking maintenance issue (e.g. `CCJ`). One set of ingest settings per client project.

Optional: `DIT_MONITORING_INGEST_TIMEOUT_MS` (default `10000`).

Production default URL when nothing else is set:

```txt
https://dit-monitoring.designingit.co/api/external/v1/paperclip/runs
```

### Placeholder values are invalid

Treat as **unresolved** (do not POST) any value that is empty or looks like a template:

- Angle brackets or words such as `placeholder`, `TBD`, `your-`, `example-`, `uuid for`, `<projects.id`
- Example bad payload value: `"dit_monitoring_id": "<projects.id UUID for paperclip-test dev>"`

Warn in `_sync.warnings` and the issue comment when a key exists but is placeholder-only.

### Resolve before ingest

Do **not** assume shell `env` is populated. **Resolve** each value at runtime using the chains below. Stop at the first **valid** non-empty value. Never invent secrets or UUIDs.

Run resolution **before** building the payload. Record which source supplied each value in the issue comment (names only — never log token values).

### Resolve `DIT_MONITORING_INGEST_URL` (client project)

1. **Issue client project** plain env (`DIT_MONITORING_INGEST_URL`)
2. Agent **wake** injected env (when Paperclip merges project env into the run)
3. **Routine / issue payload** (`dit_monitoring_ingest_url`, or nested `dit_monitoring.ingest_url`) — non-secret only
4. This skill’s production default URL above

### Resolve `DIT_MONITORING_INGEST_TOKEN` (company secret)

The ingest bearer token is a **company secret** named **`dit_monitoring_ingest_token`**. Resolve it through Paperclip secret injection — do **not** read from issue text, routine payload, comments, or ingest JSON.

1. **Company secret** `dit_monitoring_ingest_token` — resolve via native Paperclip secret_ref / secret API / wake-injected `DIT_MONITORING_INGEST_TOKEN` when bound from that company secret
2. **Issue client project** secret env `DIT_MONITORING_INGEST_TOKEN` (when injected into the agent wake)
3. Agent wake injected env under `DIT_MONITORING_INGEST_TOKEN`

**Forbidden token sources (never use for ingest):**

- Issue description, routine payload, comments, or ingest JSON
- Agent host env files (`/etc/paperclip-agents.env`, `/paperclip/.agency.env`, shell `env`) — may hold Paperclip runtime secrets, not DIT ingest
- Paperclip control-plane / work-product API tokens (wrong service; yields 401 on DIT ingest)

If the token does not resolve through the allowed chain above, skip ingest and warn (record the secret **name** checked, e.g. `dit_monitoring_ingest_token`, not any value).

### Resolve `DIT_MONITORING_ID` (client project secret)

Determine the **client Paperclip project** from the **waking issue’s project** (Properties → Project). Do **not** reuse another client project’s binding.

1. **Issue client project** secret env (`DIT_MONITORING_ID`, or `ditMonitoringProjectId`) when injected into the wake
2. **Routine / issue payload** (`dit_monitoring_id`, `DIT_MONITORING_ID`, or `dit_monitoring.project_id`) — UUID only; prefer project secret when both exist
3. **`run.json`** in the task folder (`dit_monitoring_id` or `dit_monitoring.project_id`)
4. **Site lookup** when token is available but UUID is not: `GET {ingest-origin}/api/external/v1/paperclip/projects/by-site/{normalized-site}` — use site from run scope / target URL; accept returned project `id` only when name/site clearly match the client

If `DIT_MONITORING_ID` is still missing, you may still POST without `_sync.dit_monitoring_project_id` only when the API can match by `site` alone — but prefer resolving the UUID and warn when lookup was ambiguous.

### Context to read (in order)

| Source | What to read |
| ------ | ------------ |
| **Waking issue** | Structured JSON in description; labels; `client_slug` / `project_slug`; **project id / name on the issue** |
| **Issue’s client project** | Plain env for URL; secret env for ID and token; company secret `dit_monitoring_ingest_token` binding |
| **Routine** | Payload template (`dit_monitoring_id`, `dit_monitoring_ingest_url` only — no token) |
| **Attached agent skills** | `$support-maintenance-orchestration` scope + this skill for defaults |
| **Task folder** | `run.json` for `client_slug`, `project_slug`, `paperclip_issue`, optional `dit_monitoring_*` keys |

Use native Paperclip API reads (project, issue, routine, company secrets) — do not scrape the UI or write direct SQL for normal operation.

### Optional payload keys (intake / routine)

Routine payload is copied into issue description — **never** put secrets there. Accepted non-secret keys:

```json
{
  "client_slug": "ccj",
  "project_slug": "website",
  "dit_monitoring_id": "9f6f85cb-94ec-465e-9712-c80ae71368d7",
  "dit_monitoring_ingest_url": "https://dit-monitoring.designingit.co/api/external/v1/paperclip/runs",
  "dit_monitoring": {
    "project_id": "9f6f85cb-94ec-465e-9712-c80ae71368d7",
    "ingest_url": "https://dit-monitoring.designingit.co/api/external/v1/paperclip/runs"
  }
}
```

Prefer **client project secrets** for `DIT_MONITORING_ID` and the ingest token over payload copies when both are configured.

## End-to-end workflow

```
0. Resolve ingest URL, token, and DIT_MONITORING_ID (see Configuration)
1. Read task folder rollup + specialist findings → build payload JSON
2. Set _sync.status = "pending", dit_monitoring_project_id = resolved DIT_MONITORING_ID
3. (Optional) GET project from DIT Monitoring — confirm it exists
4. POST full JSON body (direct object, not wrapped)
5. Update _sync from response (posted flags, HTTP status, final status)
6. Comment on the Paperclip issue with handoff result (include config sources, not secrets)
```

**Critical rule:** Ingest failure → **warning on issue, run still succeeds**. Never re-open or fail the maintenance issue because DIT Monitoring was unreachable.

---

## Step 1 — Build the payload

Read artifacts from the run task folder (Support System (SUP) layout):

```txt
/clients/<client-slug>/projects/<project-slug>/ai/tasks/<task-folder>/
  run.json
  findings.json
  findings/<check>.json          ← one per selected check
  dashboard-summary.json         ← input only; do not POST as-is
  final-report.html              ← or published artifact https URL
```

Assemble one JSON object with **Paperclip run fields only**, plus technical `_sync` metadata. Do **not** include ClickUp schedule or task fields — DIT Monitoring merges ClickUp data on its own.

### Field mapping from task folder artifacts

| Ingest field | Primary source | Notes |
| ------------ | -------------- | ----- |
| `run_id` | `run.json` → `run_id` | Use as idempotency key; same run retried → same `run_id` |
| `check_type` | `run.json` → `selected_checks` | See [check_type rules](#check_type-rules) |
| `client` | DIT Monitoring GET project `name` | Must match project for `DIT_MONITORING_ID` |
| `site` | DIT Monitoring project URL or run scope | Normalize hostname (see [schema.md](references/schema.md)) |
| `timestamp` | Run completion time | ISO 8601 UTC |
| `last_run_at` | Same as `timestamp` or `run.json` end time | |
| `verdict` | `findings.json` or `final-report.html` overall status | Map via [verdict transform](#verdict-transform) |
| `site_status` | `findings/server-infra-*.json` or uptime evidence | `up` / `down` / `degraded` / `unknown` |
| `http_status` | Server infra findings evidence | Integer or `null` |
| `response_ms` | Server infra findings evidence | Integer or `null` |
| `tls_days_left` | `findings/server-infra-*.json` or ssl-domain check | Integer or `null` |
| `tls_expires` | Same | ISO date or `null` |
| `findings` | Merge all `findings/<check>.json` → top 3–5 | Map severity; see below |
| `wp_version` | `findings/wordpress-*.json` evidence | `null` when WordPress check not selected |
| `plugin_count` | WordPress specialist evidence | Total installed plugins; should match `plugins[]` length when array is sent |
| `pending_updates` | WordPress specialist evidence | Plugins with available updates; should match filtered `plugins[]` when array is sent |
| `plugins` | `findings/wp-health-audit.json`, `findings/wordpress-*.json`, or equivalent evidence | Full plugin inventory — see [WordPress inventory arrays](#wordpress-inventory-arrays-plugins-themes); omit key if not collected |
| `themes` | Same WordPress / health-audit evidence | Full theme inventory — same section; omit key if not collected |
| `frontend_audit` | `findings/frontend-audit.json` (+ published screenshot/report artifacts) | Merged output from **`frontend-audit` orchestrator** (Browser Health Agent sub-skills) — see [Frontend audit object](#frontend-audit-object); omit key when check did not run |
| `craft_version` / `ee_version` | Relevant CMS check evidence | When applicable |
| `red_flags` | All specialist JSON where `red_flag: true` | Array of short titles |
| `secrets_exposed` | Any specialist or triage finding | Boolean |
| `report_url` | Published `final-report.html` (or primary HTML report) | Openable Paperclip artifact URL, or `null` |
| `paperclip_issue_id` | Issue that owns the run | e.g. `SUP-39` |
| `report_json_url` | Published `findings.json` or `dashboard-summary.json` | Openable Paperclip artifact URL — see [Report URLs](#report-urls) |

Fields for checks **not** in `selected_checks` stay `null` or `"unknown"` — partial runs are valid.

### WordPress inventory arrays (`plugins[]`, `themes[]`)

When the run collected **full plugin or theme inventory** (typical: `wp-health-audit`, `wordpress-*` checks), add the corresponding arrays to the **ingest JSON** you POST to DIT Monitoring. DIT Monitoring shows them in the maintenance project modal under **WordPress inventory** (collapsed by default).

| Rule | Detail |
| ---- | ------ |
| Include `plugins[]` | Only when a per-plugin list exists in specialist evidence (not counts alone) |
| Include `themes[]` | Only when a per-theme list exists in specialist evidence |
| Omit when absent | Do **not** send `"plugins": []` or `"themes": []` — omit the key entirely |
| Required item field | Each object must have `name` (plugin name or theme slug) |
| Full objects required | When specialist JSON has `version` / `status` / `update` / `update_version` (or equivalents), **map them** — name-only `plugins[]` is forbidden |
| Scalars required when known | Set `wp_version`, `plugin_count`, `pending_updates` from the same WordPress evidence; do not leave them null when the specialist file has values |
| Keep scalars in sync | When `plugins[]` is sent, `plugin_count` = array length; `pending_updates` = plugins with update available |
| Do not duplicate | Inventory detail lives in `plugins[]` / `themes[]`; keep rollup highlights in `findings[]` (top 3–5), not full lists |

Build each array from the run task folder — usually `findings/wp-health-audit.json` → `evidence.plugins` / `evidence.themes`, or the equivalent structure in `findings/wordpress-*.json`. Map field names to the ingest schema in [schema.md](references/schema.md#wordpress-inventory-plugins-themes) (snake_case: `update_version`, `auto_update`, `vulnerability_status`, `parent_theme`, etc.).

Example minimal plugin entry:

```json
{
  "name": "Advanced Custom Fields Pro",
  "version": "6.2.5",
  "status": "active",
  "update": "available",
  "update_version": "6.2.7",
  "auto_update": "off",
  "vulnerability_status": "no known issues"
}
```

Full multi-item examples: [examples.md](references/examples.md).

### Frontend audit object (`frontend_audit`)

When the run selected **`frontend-audit`** (Front-end / Browser Health Agent orchestrator — with sub-skills `frontend-browser-console`, `frontend-network-health`, `frontend-performance-cwv`, `frontend-third-party-scripts`, `frontend-accessibility-audit`, `frontend-deploy-regression`), add a **`frontend_audit`** object from merged **`findings/frontend-audit.json`**. See [frontend-browser-health-agent/AGENTS.md](../../../agents/frontend-browser-health-agent/AGENTS.md).

**Hard source rule:** map from the **full specialist file** `findings/frontend-audit.json` only. Do **not** use the compact `frontend_audit` block inside rollup `findings.json` (that stub is for human/rollup summary — wrong field names for DIT).

**Minimum acceptable `frontend_audit` when the specialist file has page evidence:**

- `verdict` (lowercase: `pass` / `warn` / `fail` / `unknown`)
- `summary{}` (object — not top-level score scalars alone)
- `pages[]` with at least one page (CWV under `pages[].core_web_vitals`, not `core_web_vitals_lab`)
- Map `findings[]`, `human_verification[]`, `tooling`, screenshot URLs when present in the specialist file

If the specialist file contains `pages[]` but your payload would omit them → **stop and fix the mapping**; do not POST.

| Rule | Detail |
| ---- | ------ |
| Include `frontend_audit` | Only when `findings/frontend-audit.json` exists in the task folder |
| Omit when absent | Do **not** send `"frontend_audit": null` or `{}` — omit the key entirely |
| Source file | Read `findings/frontend-audit.json` → map `target`, `scope`, `summary`, `pages[]`, `findings[]`, `human_verification[]`, `tooling`, `baseline_comparison` (regression counts → `summary.regression_count` when present) |
| Verdict map | Specialist `PASS` → `pass`, `FAIL` → `fail`, `BLOCKED` → `unknown`, `PARTIAL` → `warn` |
| Screenshot URLs | Publish PNGs from `artifacts/frontend-audit/` via `paperclip-publish-artifact`; set `desktop_screenshot_url` / `mobile_screenshot_url` on each page item as full `https://paperclip.designingit.co/artifacts/...` URLs — never relative paths |
| Specialist reports | Set `frontend_audit.report_url` / `report_json_url` to published `reports/frontend-audit.html` and `findings/frontend-audit.json` artifact URLs when available (separate from rollup `report_url` / `report_json_url`) |
| Page counts | Copy `scope.pages_requested`, `scope.pages_audited`, `scope.pages_blocked`, `scope.mode` → `scope_mode`, and `scope.instruction` → `scope_instruction` when present |
| Per-page counts | Derive `console_error_count`, `failed_request_count`, and `broken_image_count` from page evidence (prefer explicit counts in JSON; else length of arrays) |
| Per-page detail arrays | Map `pages[].console_errors`, `failed_requests`, `broken_images` from specialist JSON — **cap at 5 items per array per page**; omit empty arrays |
| Extended page fields | Map `pages[].core_web_vitals.tbt_ms`, `performance`, `third_party_scripts[]`, `accessibility` when present in merged JSON — omit empty arrays and null-only objects |
| Summary extended counts | Map `summary.third_party_issue_pages`, `accessibility_issue_pages`, `regression_count` when present; else derive from merged pages / `baseline_comparison.regressions[]` |
| Baseline comparison | Map `baseline_comparison` from regression partial when present (`available`, `baseline_generated_at`, `baseline_source`, `regressions[]`); omit key when regression sub-skill skipped |
| Blocked pages | When `status: "blocked"`, include `blocked_reason` from finding evidence when available |
| Specialist findings | Map root `findings[]` → `frontend_audit.findings[]` with `severity`, `title`, `evidence`, `recommendation`, `page_url`, `owner`, `red_flag`; map specialist `warning` → ingest `medium`; send up to **20** items; preserve `red_flag: true` for JS errors and CWV regressions on important pages |
| Human verification | Map `human_verification[]` → same shape (`item`, `owner`, `due`); omit key when empty |
| Tooling | Map `tooling.browser_tool`, `browser_tool_available`, `lighthouse_available` only — **omit `figma_mcp_available`**; also set top-level `browser_tool` for backward compatibility |
| Figma | **Never send** `figma_comparison` — not part of browser health agent |
| Do not duplicate | Rollup `findings[]` stays top 3–5 across all checks; specialist browser health detail lives in `frontend_audit.findings[]` and `frontend_audit.pages[]` |

Example minimal object:

```json
{
  "verdict": "pass",
  "generated_at": "2026-07-21T13:04:12Z",
  "environment": "development",
  "seed_url": "https://example.com/",
  "scope_mode": "flexible",
  "scope_instruction": "Homepage only",
  "pages_requested": 1,
  "pages_audited": 1,
  "pages_blocked": 0,
  "summary": {
    "console_error_pages": 0,
    "failed_request_pages": 0,
    "broken_image_pages": 0,
    "poor_cwv_pages": 0,
    "critical_findings": 0,
    "high_findings": 0,
    "warning_findings": 0,
    "red_flags": 0
  },
  "pages": [
    {
      "url": "https://example.com/",
      "final_url": "https://example.com/",
      "http_status": 200,
      "title": "Example homepage",
      "status": "audited",
      "console_error_count": 0,
      "failed_request_count": 0,
      "broken_image_count": 0,
      "console_errors": [],
      "failed_requests": [],
      "broken_images": [],
      "core_web_vitals": {
        "lcp_ms": 1840,
        "cls": 0.04,
        "inp_ms": null,
        "source": "lab_trace",
        "rating": "good"
      },
      "desktop_screenshot_url": "https://paperclip.designingit.co/artifacts/SUP-123/abc-home-desktop.png",
      "mobile_screenshot_url": "https://paperclip.designingit.co/artifacts/SUP-123/def-home-mobile.png"
    }
  ],
  "findings": [
    {
      "severity": "info",
      "title": "Homepage loaded without console errors",
      "evidence": "Desktop and mobile viewports checked.",
      "recommendation": "No action required.",
      "page_url": "https://example.com/",
      "owner": "agency",
      "red_flag": false
    }
  ],
  "human_verification": [
    {
      "item": "Visual design approved by client?",
      "owner": "client",
      "due": null
    }
  ],
  "tooling": {
    "browser_tool": "chrome-devtools-mcp",
    "browser_tool_available": true,
    "lighthouse_available": false
  },
  "browser_tool": "chrome-devtools-mcp",
  "report_url": "https://paperclip.designingit.co/artifacts/SUP-123/ghi-frontend-audit.html",
  "report_json_url": "https://paperclip.designingit.co/artifacts/SUP-123/jkl-frontend-audit.json"
}
```

Full example with multi-page crawl: [examples.md](references/examples.md).

### check_type rules

| Scenario | `check_type` |
| -------- | ------------ |
| Full maintenance (WP + server ± QA) | `maintenance` |
| Server / infra / SSL / uptime only | `infra` |
| Frontend / performance / flow smoke only | `qa` |
| Mixed maintenance with QA | `maintenance` (preferred default) |

### Verdict transform

Map `$support-maintenance-orchestration` report-contract status to ingest enum:

| Source (`final-report.html` / rollup) | Ingest `verdict` |
| ------------------------------------- | ---------------- |
| `green` | `pass` |
| `watch` | `warn` |
| `action_needed` | `warn` |
| `critical` | `fail` |
| missing / unclear | Derive from highest finding severity, else `unknown` |

### Finding severity transform

Orchestration finding JSON uses `warning`; ingest uses `medium` / `low`:

| Report-contract severity | Ingest severity |
| ---------------- | --------------- |
| `critical` | `critical` |
| `high` | `high` |
| `warning` | `medium` |
| `info` | `info` |

Map each ingest finding item:

```json
{
  "severity": "<mapped>",
  "title": "<finding.title>",
  "detail": "<finding.evidence or finding.recommendation, truncated>"
}
```

Sort by severity (critical first), take top **3–5**.

### `_sync.warnings` vs `findings`

| Field | Purpose | Examples |
| ----- | ------- | -------- |
| `findings[]` | **Run results** shown in `/maintenance` UI | TLS expiry, pending updates, exposed backup |
| `_sync.warnings[]` | **Handoff / ops issues** only | Missing env var, ingest HTTP 503, project 404, `client`/`site` mismatch |

Never put TLS, PageSpeed, or plugin drift into `_sync.warnings` — those belong in `findings[]`.

### Report URLs

DIT Monitoring ingest requires valid absolute URLs (`report_url`, `report_json_url`). Use **Paperclip artifact URLs** from `paperclip-publish-artifact`, not filesystem paths or fake domains.

```bash
/usr/local/bin/paperclip-publish-artifact \
  --issue <paperclip-issue> \
  --file <task-folder>/final-report.html \
  --label "Maintenance final report" \
  --summary "<one line>"
```

Served shape:

```txt
https://paperclip.designingit.co/artifacts/<issue>/<hash>-<filename>
```

| Field | Publish from task folder | Typical filename |
| ----- | ------------------------ | ---------------- |
| `report_url` | Primary human HTML report | `final-report.html` or specialist `reports/<check>.html` |
| `report_json_url` | Combined machine-readable JSON | `findings.json` (preferred) or `dashboard-summary.json` |

Publish JSON the same way as HTML when the file exists on disk but has no artifact URL yet. If only a relative or internal Paperclip path is available, resolve it to the full `https://paperclip.designingit.co/artifacts/...` URL before POST.

Do **not** use placeholder hosts (e.g. `paperclip.invalid`). Do **not** use `file://` paths in the ingest body.

### Technical `_sync` block (required)

**Before POST** — initial state:

```json
{
  "_sync": {
    "status": "pending",
    "dit_monitoring_project_id": "<DIT_MONITORING_ID>",
    "dit_monitoring_posted": false,
    "dit_monitoring_posted_at": null,
    "dit_monitoring_response_status": null,
    "errors": [],
    "warnings": []
  }
}
```

**After POST** — update from HTTP result:

| Outcome | `_sync.status` | `dit_monitoring_posted` | `dit_monitoring_response_status` |
| ------- | -------------- | ------------------------- | ---------------------------------- |
| HTTP 2xx | `success` | `true` | e.g. `201` or `200` |
| HTTP 4xx/5xx/timeout | `partial` | `false` | status code or omit |
| Could not build valid JSON | `failed` | `false` | `null` |

Set `dit_monitoring_posted_at` to ISO 8601 UTC **only when** `dit_monitoring_posted` is `true`.

Do **not** set `dit_monitoring_posted: true` or `status: "success"` before the POST completes.

---

## Step 2 — Confirm project (optional)

Verify the configured project exists:

```http
GET https://dit-monitoring.designingit.co/api/external/v1/paperclip/projects/{DIT_MONITORING_ID}
Authorization: Bearer {DIT_MONITORING_INGEST_TOKEN}
```

Alternatively use `{API_BASE}/api/external/v1/paperclip/projects/{DIT_MONITORING_ID}` where `API_BASE` is `https://dit-monitoring.designingit.co` (derive from `DIT_MONITORING_INGEST_URL` origin if overridden).

On 404, add to `_sync.warnings`, set `_sync.status = "partial"`, and stop ingest. On success, confirm `name` and `url` align with `client` and `site` in the payload.

Staff UI: `https://dit-monitoring.designingit.co/maintenance`

---

## Step 3 — POST to DIT Monitoring

Use env credentials only — **never** the DIT Monitoring admin UI login.

```http
POST https://dit-monitoring.designingit.co/api/external/v1/paperclip/runs
Authorization: Bearer {DIT_MONITORING_INGEST_TOKEN}
Content-Type: application/json
```

Or `POST {DIT_MONITORING_INGEST_URL}` when set to the production URL above.

### Request body format

Send the **run object directly** as the JSON body root. Do **not** wrap it in tool-specific envelopes such as:

```json
{ "body": { ... }, "query": {}, "params": {} }
```

Idempotency: same `run_id` on retry is safe (server upserts by `run_id`).

### Response format

Success (HTTP 201 create or 200 update):

```json
{
  "runId": "7ca841e7-bee1-405d-9db5-d3c7c654e99b",
  "projectId": "9f6f85cb-94ec-465e-9712-c80ae71368d7",
  "matched": true,
  "run": { }
}
```

| Field | Meaning |
| ----- | ------- |
| `runId` | Stored run id (matches payload `run_id`) |
| `projectId` | Linked DIT Monitoring project UUID |
| `matched` | `true` when project linked via `_sync.dit_monitoring_project_id` or `site` |
| `run` | Full stored run record (camelCase fields) |

Validation failure (HTTP 422):

```json
{
  "error": "Validation failed",
  "details": [ ]
}
```

On 422, add validation message to `_sync.warnings`, set `_sync.status = "partial"`, comment on issue — **do not fail the run**.

Example issue comment (success):

> DIT Monitoring: synced run `{run_id}` for project `{DIT_MONITORING_ID}` (HTTP {status}, matched={matched}).

Example issue comment (failure):

> DIT Monitoring sync failed (HTTP 503): maintenance run completed. Retry ingest manually.

---

## Step 4 — Issue comment summary

Always leave a short issue comment summarizing:

- `DIT_MONITORING_ID` and ingest result
- Any `_sync.warnings` or `_sync.errors` (handoff issues only)

---

## Validation checklist

Before finishing the heartbeat:

- [ ] Ingest gates met (triage pass when applicable, rollup files on disk, config resolved — not parent `done`)
- [ ] Ingest URL, token, and `DIT_MONITORING_ID` resolved (or ingest skipped with `_sync.warnings`; no placeholder UUIDs)
- [ ] Config sources noted in issue comment (without token values)
- [ ] All required identity fields present
- [ ] Source artifacts read from the run task folder (or equivalent evidence)
- [ ] `report_url` / `report_json_url` are real Paperclip artifact URLs when set
- [ ] `client` and `site` match the DIT Monitoring project
- [ ] `verdict`, `site_status`, `check_type` use allowed enums
- [ ] Run findings in `findings[]`; handoff issues in `_sync.warnings[]` only
- [ ] `findings` length ≤ 5, severities valid
- [ ] When specialist evidence includes full plugin/theme inventory, ingest JSON includes `plugins[]` and/or `themes[]` with versions/update fields (not name-only); keys omitted when inventory was not collected
- [ ] `wp_version` / `plugin_count` / `pending_updates` set when WordPress specialist evidence has them
- [ ] When `frontend-audit` ran, ingest JSON includes `frontend_audit` built from **full** `findings/frontend-audit.json` (not rollup compact stub); key omitted when the check did not run
- [ ] `frontend_audit` has `pages[]` + `summary{}` when the specialist file has page evidence — never verdict-only / `core_web_vitals_lab`-only
- [ ] `frontend_audit` has **no** `figma_comparison`; tooling omits Figma fields
- [ ] `frontend_audit.findings[]`, `human_verification[]`, and `tooling` included when present in specialist JSON; per-page issue arrays capped at 5 items; empty arrays omitted
- [ ] `frontend_audit.pages[].desktop_screenshot_url` / `mobile_screenshot_url` and specialist report URLs are published Paperclip artifact URLs (not relative paths)
- [ ] `plugin_count` / `pending_updates` consistent with `plugins[]` when the array is present
- [ ] No forbidden shortcut from the table above (compact rollup copy, jq verdict+CWV, cheap-wake thin POST)
- [ ] `_sync` reflects POST outcome (not pre-filled success)
- [ ] Request body is direct JSON (not wrapped)
- [ ] Ingest attempted only when resolved URL and token are present
- [ ] Issue updated; maintenance task status unchanged by sync failures

---

## Security

- Never commit or paste `DIT_MONITORING_INGEST_TOKEN` into issues, JSON, or chat.
- Redact secrets from `findings` before POST.

---

## Related files

- [schema.md](references/schema.md) — field types, enums, response reference
- [examples.md](references/examples.md) — full example payloads, Lime test case, curl
