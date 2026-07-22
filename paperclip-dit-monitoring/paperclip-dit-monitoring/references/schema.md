# Maintenance report JSON schema

Canonical **ingest POST body** for Paperclip → DIT Monitoring. The full JSON is sent inline in the request — no external JSON file hosting. Fields align with **Paperclip run data** shown on `/maintenance`. Do **not** include ClickUp fields (`next_maintenance`, `last_maintenance`, `maintenance_status`, `current_focus`, etc.) — DIT Monitoring loads those from ClickUp sync separately.

Workflow and field mapping from task folder artifacts: [SKILL.md](../SKILL.md).

## Configuration (not in ingest JSON)

These values are resolved at runtime — see [SKILL.md — Configuration](../SKILL.md#configuration). Use **client project** env/secrets on the issue project (e.g. CCJ), company secret `dit_monitoring_ingest_token`, routine payload (URL and id only), and attached skills.

| Variable | Scope | Storage | Purpose |
| -------- | ----- | ------- | ------- |
| `DIT_MONITORING_INGEST_URL` | Client **project on the issue** | Plain env | Ingest POST URL |
| `DIT_MONITORING_INGEST_TOKEN` | Client **project on the issue** | Project secret → company secret `dit_monitoring_ingest_token` | Bearer token for ingest POST |
| `DIT_MONITORING_ID` | Client **project on the issue** | Project secret | DIT Monitoring project UUID |

Optional intake / routine payload keys (non-secret only): `dit_monitoring_id`, `dit_monitoring_ingest_url`, `dit_monitoring.project_id`, `dit_monitoring.ingest_url`. Never put the ingest token in payload or issue text.

## Top-level object

| Field | Type | Required | Maps to UI |
| ----- | ---- | -------- | ---------- |
| `run_id` | string (UUID) | yes | Idempotency |
| `check_type` | enum | yes | Future filter (maintenance / infra / qa) |
| `client` | string | yes | Project name (must match `DIT_MONITORING_ID` project) |
| `site` | string | yes | Project URL / hostname (matching key) |
| `timestamp` | string (ISO 8601) | yes | — |
| `last_run_at` | string (ISO 8601) | yes | **Last run** column |
| `verdict` | enum | yes | **Verdict** column |
| `site_status` | enum | yes | **Site status** column |
| `http_status` | integer \| null | no | Site status detail |
| `response_ms` | integer \| null | no | Site status detail |
| `tls_days_left` | integer \| null | no | **TLS** column |
| `tls_expires` | string (ISO date) \| null | no | **TLS** detail |
| `findings` | array | yes | **Findings** column (may be empty) |
| `wp_version` | string \| null | no | Latest run — **WordPress version** (when CMS is WordPress) |
| `craft_version` | string \| null | no | Latest run — **Craft version** (when CMS is Craft) |
| `ee_version` | string \| null | no | Latest run — **ExpressionEngine version** (when CMS is EE) |
| `plugin_count` | integer \| null | no | Latest run — **Installed plugins** (WordPress; total active plugins detected) |
| `pending_updates` | integer \| null | no | Latest run — **Pending plugin updates** (plugins with available updates not yet applied; separate from installed count) |
| `plugins` | array | no | Maintenance modal — **WordPress inventory** (Plugins tab); see [WordPress inventory](#wordpress-inventory-plugins-themes) |
| `themes` | array | no | Maintenance modal — **WordPress inventory** (Themes tab); see [WordPress inventory](#wordpress-inventory-plugins-themes) |
| `frontend_audit` | object | no | Maintenance modal — **Frontend audit** section; see [Frontend audit](#frontend-audit-object) |
| `red_flags` | string[] | no | Latest run detail |
| `secrets_exposed` | boolean | no | Latest run detail |
| `report_url` | string (URL) \| null | no | HTML report — Paperclip artifact URL |
| `paperclip_issue_id` | string \| null | no | Deep link |
| `report_json_url` | string (URL) | yes | Machine-readable JSON — Paperclip artifact URL (`findings.json` or `dashboard-summary.json`) |
| `_sync` | object | yes | Technical handoff status (not shown in UI) |

## Report URLs

Both URL fields must be **valid absolute URLs**. The ingest API validates with `z.string().url()`.

Use openable Paperclip artifact URLs from `paperclip-publish-artifact`:

```txt
https://paperclip.designingit.co/artifacts/<issue>/<hash>-<filename>
```

| Field | Source file on disk | Notes |
| ----- | ------------------- | ----- |
| `report_url` | `final-report.html` or `reports/<check>.html` | Human-readable report; `null` if none published |
| `report_json_url` | `findings.json` or `dashboard-summary.json` | Required; publish JSON via the same artifact helper |

Do not use `file://` paths, filesystem paths, or placeholder domains in the ingest body.

## Enums

**check_type:** `maintenance` | `infra` | `qa`

**verdict:** `pass` | `warn` | `fail` | `unknown`

**site_status:** `up` | `down` | `degraded` | `unknown`

**findings[].severity:** `critical` | `high` | `medium` | `low` | `info`

## Severity mapping (report-contract → ingest)

`$support-maintenance-orchestration` `references/report-contract.md` finding JSON uses `warning`. Map when building ingest:

| Report contract | Ingest |
| ------- | ------ |
| `critical` | `critical` |
| `high` | `high` |
| `warning` | `medium` |
| `info` | `info` |

## Verdict mapping (orchestration rollup → ingest)

| Rollup overall status | Ingest `verdict` |
| ---------------------- | ---------------- |
| `green` | `pass` |
| `watch` | `warn` |
| `action_needed` | `warn` |
| `critical` | `fail` |

## _sync object

| Field | Type | Description |
| ----- | ---- | ----------- |
| `status` | `pending` \| `success` \| `partial` \| `failed` | Overall handoff outcome |
| `dit_monitoring_project_id` | string (UUID) \| null | Copy of `DIT_MONITORING_ID` from Paperclip project |
| `dit_monitoring_posted` | boolean | Ingest POST succeeded — set **after** POST only |
| `dit_monitoring_posted_at` | string (ISO 8601) \| null | Set only when `dit_monitoring_posted` is true |
| `dit_monitoring_response_status` | integer \| null | HTTP status from ingest |
| `errors` | string[] | Blocking failures (payload build) |
| `warnings` | string[] | Handoff issues only — not run findings |

DIT Monitoring stores `_sync` for ops debugging; the board UI focuses on run fields, not `_sync`.

## Ingest API response

POST `/api/external/v1/paperclip/runs` success body:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `runId` | string | Stored run id |
| `projectId` | string (UUID) | Linked project |
| `matched` | boolean | Project match succeeded |
| `run` | object | Full stored run record |

HTTP **201** on create, **200** on update (same `run_id`). HTTP **422** on validation failure.

## WordPress inventory (`plugins[]`, `themes[]`)

Optional full inventories for the DIT Monitoring maintenance modal (**WordPress inventory** section). Send them **in the ingest POST body** alongside summary fields (`plugin_count`, `pending_updates`, `wp_version`).

**When to include:**

| Situation | Action |
| --------- | ------ |
| Specialist collected full plugin list (e.g. `wp-health-audit`, `wordpress-*`) | Set `plugins[]` with one object per plugin |
| Specialist collected theme list | Set `themes[]` with one object per theme |
| No inventory for plugins or themes | **Omit** that key — do not send an empty array |

`plugin_count` and `pending_updates` remain summary scalars for the table and info grid. When `plugins[]` is present, counts should **match** the array (installed total and plugins with `update: "available"` or non-null `update_version`).

### `plugins[]` item

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `name` | string | yes | Plugin name or slug |
| `version` | string \| null | no | Installed version |
| `status` | string \| null | no | e.g. `active`, `inactive` |
| `update` | string \| null | no | e.g. `available`, `none` |
| `update_version` | string \| null | no | Latest available version when update exists |
| `auto_update` | string \| null | no | e.g. `on`, `off` |
| `last_update_check` | string (ISO 8601) \| null | no | When WordPress last checked for updates |
| `vulnerability_status` | string \| null | no | e.g. `no known issues`, `patches available` |

### `themes[]` item

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `name` | string | yes | Theme slug |
| `title` | string \| null | no | Human-readable name |
| `status` | string \| null | no | e.g. `active`, `inactive`, `child`, `parent` |
| `version` | string \| null | no | Installed version |
| `update` | string \| null | no | e.g. `available`, `none` |
| `update_version` | string \| null | no | Latest available version |
| `auto_update` | string \| null | no | e.g. `on`, `off` |
| `last_update_check` | string (ISO 8601) \| null | no | Optional |
| `parent_theme` | string \| null | no | Parent slug for child themes |
| `author` | string \| null | no | Theme author |
| `update_source` | string \| null | no | e.g. `private` for non-wordpress.org updates |

Shape mirrors WP-CLI / specialist JSON from the run task folder. Extra keys are stored in the payload but ignored by validation unless documented above.

## Frontend audit (`frontend_audit`)

Optional browser QA block from the **`frontend-audit`** specialist check. Send it **in the ingest POST body** when `findings/frontend-audit.json` exists. DIT Monitoring shows it in the maintenance modal under **Frontend audit** (collapsed by default).

**When to include:**

| Situation | Action |
| --------- | ------ |
| Run selected `frontend-audit` and `findings/frontend-audit.json` exists | Set `frontend_audit` from that file + published artifact URLs |
| Check not selected or JSON missing | **Omit** the key — do not send `null` or `{}` |

Rollup `findings[]` remains the cross-check summary (top 3–5). Per-page console/network/CWV/screenshot detail lives in `frontend_audit.pages[]`.

### Top-level `frontend_audit` fields

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `verdict` | string | no | Mapped specialist verdict: `pass`, `fail`, `warn`, `unknown` |
| `generated_at` | string (ISO 8601) | no | From specialist JSON |
| `environment` | string | no | `development`, `staging`, or `production` |
| `seed_url` | string | no | Seed URL from the audit |
| `scope_mode` | string | no | `single_page`, `site_crawl`, or `child_pages_only` |
| `pages_requested` | integer | no | From specialist `scope` |
| `pages_audited` | integer | no | From specialist `scope` |
| `pages_blocked` | integer | no | From specialist `scope` |
| `summary` | object | no | Counts — see below |
| `pages` | array | no | Per-page results — see below |
| `findings` | array | no | Specialist audit findings — see below |
| `human_verification` | array | no | Manual follow-up checklist — see below |
| `tooling` | object | no | Browser/Lighthouse/Figma MCP availability |
| `figma_comparison` | object | no | Optional Figma status |
| `browser_tool` | string | no | From specialist `tooling.browser_tool` |
| `report_url` | string (URL) | no | Published `reports/frontend-audit.html` artifact URL |
| `report_json_url` | string (URL) | no | Published `findings/frontend-audit.json` artifact URL |

### `frontend_audit.summary`

| Field | Type |
| ----- | ---- |
| `console_error_pages` | integer |
| `failed_request_pages` | integer |
| `broken_image_pages` | integer |
| `poor_cwv_pages` | integer |
| `critical_findings` | integer |
| `high_findings` | integer |
| `warning_findings` | integer |
| `red_flags` | integer |

### `frontend_audit.pages[]` item

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `url` | string | yes | Requested page URL |
| `final_url` | string | no | Observed URL after redirects |
| `http_status` | integer | no | HTTP status code |
| `title` | string | no | Document title |
| `status` | string | no | `audited`, `blocked`, or `skipped` |
| `console_error_count` | integer | no | Console errors on the page |
| `failed_request_count` | integer | no | Failed network requests |
| `broken_image_count` | integer | no | Broken images detected |
| `blocked_reason` | string | no | When `status` is `blocked` |
| `console_errors` | array | no | Up to 5 console error objects — see below |
| `failed_requests` | array | no | Up to 5 failed request objects — see below |
| `broken_images` | array | no | Up to 5 broken image objects — see below |
| `core_web_vitals` | object | no | Lab CWV — see below |
| `desktop_screenshot_url` | string (URL) | no | Published desktop screenshot artifact |
| `mobile_screenshot_url` | string (URL) | no | Published mobile screenshot artifact |

### `frontend_audit.pages[].core_web_vitals`

| Field | Type | Notes |
| ----- | ---- | ----- |
| `lcp_ms` | number | Largest Contentful Paint (ms) |
| `cls` | number | Cumulative Layout Shift |
| `inp_ms` | number | Interaction to Next Paint (ms) |
| `source` | string | e.g. `lab_trace`, `lighthouse_lab` |
| `rating` | string | `good`, `needs_improvement`, or `poor` |

### `frontend_audit.pages[].console_errors[]` item

| Field | Type | Notes |
| ----- | ---- | ----- |
| `message` | string | Console error text |
| `source` | string | Optional script/source URL |

String items (message only) are also accepted.

### `frontend_audit.pages[].failed_requests[]` item

| Field | Type | Notes |
| ----- | ---- | ----- |
| `url` | string | Request URL |
| `status` | integer | HTTP status when known |
| `resource_type` | string | e.g. `script`, `stylesheet`, `image` |

### `frontend_audit.pages[].broken_images[]` item

| Field | Type | Notes |
| ----- | ---- | ----- |
| `url` | string | Image URL |
| `alt` | string | Alt text when known |

### `frontend_audit.findings[]` item

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `severity` | string | no | `critical`, `high`, `medium`, `low`, `info`, or specialist `warning` |
| `title` | string | yes | Finding title |
| `detail` | string | no | Optional combined detail (UI fallback) |
| `evidence` | string | no | What was observed |
| `recommendation` | string | no | Suggested action |
| `page_url` | string | no | Page where issue occurred |
| `owner` | string | no | `dev`, `client`, or `agency` |
| `red_flag` | boolean | no | Hard gate marker |

Send up to **20** specialist findings. Map specialist `warning` → `medium`.

### `frontend_audit.human_verification[]` item

| Field | Type | Required |
| ----- | ---- | -------- |
| `item` | string | yes |
| `owner` | string | no |
| `due` | string (ISO 8601) | no |

### `frontend_audit.tooling`

| Field | Type | Notes |
| ----- | ---- | ----- |
| `browser_tool` | string | Tool actually used |
| `browser_tool_available` | boolean | Browser MCP/CLI available |
| `lighthouse_available` | boolean | Lighthouse enrichment available |
| `figma_mcp_available` | boolean | Figma MCP available for comparison |

### `frontend_audit.figma_comparison`

| Field | Type | Notes |
| ----- | ---- | ----- |
| `status` | string | e.g. `completed`, `skipped`, `blocked` |
| `skip_reason` | string | When skipped or blocked |
| `figma_url` | string | Figma design URL when comparison ran or was requested |
| `figma_node_id` | string | Node id when known |
| `mismatch_count` | integer | Length of `mismatches[]` when the array is omitted |
| `mismatches` | array | Optional list — see below |

### `frontend_audit.figma_comparison.mismatches[]` item

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `area` | string | yes | Layout or component area |
| `expected` | string | no | Figma expectation |
| `observed` | string | no | Implementation observation |
| `severity` | string | no | e.g. `warning`, `high`, `critical` |

Screenshot and report URLs must be **published Paperclip artifact URLs** — same rules as [Report URLs](#report-urls).

## CMS summary fields

The ingest schema includes CMS version fields (`wp_version`, `craft_version`, `ee_version`) plus WordPress plugin **counts**. The UI picks the first present version field for the label. Full plugin and theme lists use `plugins[]` and `themes[]` — not `findings[]` alone.

## site normalization

Strip `https://`, `http://`, `www.`, paths, query strings. Example: `https://www.ccjudaism.org/` → `ccjudaism.org`.
