# Frontend Audit — Report Contracts

## Output paths

```txt
<task-folder>/reports/frontend-audit.html
<task-folder>/findings/frontend-audit.json
<task-folder>/artifacts/frontend-audit/          ← screenshots, traces (optional)
```

When `frontend-site-crawl` ran first, also read:

```txt
<task-folder>/artifacts/frontend-crawl-manifest.json
```

Do not write rollup files (`findings.json`, `final-report.html`) — those belong to Maintenance Orchestrator.

---

## findings/frontend-audit.json — top-level schema

```json
{
  "check": "frontend-audit",
  "verdict": "PASS | FAIL | BLOCKED | PARTIAL",
  "generated_at": "2026-07-21T13:00:00Z",
  "target": { },
  "scope": { },
  "summary": { },
  "pages": [ ],
  "findings": [ ],
  "figma_comparison": null,
  "tooling": { },
  "human_verification": [ ]
}
```

### target

| Field | Type | Required | Description |
|---|---|---|---|
| `issue` | string | yes | Paperclip child issue id |
| `environment` | string | yes | `development`, `staging`, or `production` |
| `seed_url` | string | yes | URL from the issue |
| `crawl_manifest_path` | string | no | Path to manifest when multi-page |

### scope

| Field | Type | Required | Description |
|---|---|---|---|
| `mode` | string | yes | `single_page`, `site_crawl`, `child_pages_only` |
| `pages_requested` | number | yes | Count from manifest or `1` |
| `pages_audited` | number | yes | Successfully audited |
| `pages_blocked` | number | yes | Could not audit (404, login, timeout) |

### summary

| Field | Type | Description |
|---|---|---|
| `console_error_pages` | number | Pages with ≥1 console error |
| `failed_request_pages` | number | Pages with failed network requests |
| `broken_image_pages` | number | Pages with broken images |
| `poor_cwv_pages` | number | Pages with poor LCP, CLS, or INP (lab) |
| `critical_findings` | number | Count |
| `high_findings` | number | Count |
| `warning_findings` | number | Count |
| `red_flags` | number | Count where `red_flag: true` |

### pages[] — per-page result

| Field | Type | Required |
|---|---|---|
| `url` | string | yes |
| `final_url` | string | yes |
| `http_status` | number | yes |
| `title` | string | no |
| `viewport_results` | array | yes |
| `console_errors` | array | yes |
| `failed_requests` | array | yes |
| `broken_images` | array | yes |
| `core_web_vitals` | object | no |
| `screenshots` | object | no |
| `status` | string | yes — `audited`, `blocked`, `skipped` |

### viewport_results[]

| Field | Type | Description |
|---|---|---|
| `viewport` | string | e.g. `1440x1100`, `390x844` |
| `screenshot` | string | Relative path under artifacts |
| `console_error_count` | number | |
| `failed_request_count` | number | |

### core_web_vitals (lab only)

| Field | Type | Threshold source |
|---|---|---|
| `lcp_ms` | number | Good < 2500 |
| `cls` | number | Good < 0.1 |
| `inp_ms` | number | Good < 200 |
| `source` | string | `lab_trace`, `lighthouse_lab` |
| `rating` | string | `good`, `needs_improvement`, `poor` |

### findings[] — shared finding object

Same shape as `$support-maintenance-orchestration` report contract:

```json
{
  "severity": "critical | high | warning | info",
  "category": "frontend",
  "title": "string",
  "evidence": "string",
  "recommendation": "string",
  "owner": "dev | client | agency",
  "follow_up": true,
  "red_flag": false,
  "page_url": "string | null",
  "source": "playwright | chrome-devtools-mcp | curl | manual",
  "evidence_type": "browser-smoke | screenshot | performance-trace | http"
}
```

### figma_comparison (optional — omit or set null when not run)

```json
{
  "status": "skipped | blocked | completed",
  "skip_reason": "string | null",
  "figma_url": "string | null",
  "figma_node_id": "string | null",
  "tool_available": false,
  "mismatches": [ ]
}
```

Run Figma comparison only when **both** are true:
1. Issue includes a Figma URL + node reference.
2. Figma MCP (or equivalent) is available in the agent session.

Otherwise set `status: "skipped"` and `skip_reason` — do not fail the audit for missing Figma tooling.

### tooling

| Field | Description |
|---|---|
| `browser_tool` | Tool actually used |
| `browser_tool_available` | boolean |
| `lighthouse_available` | boolean |
| `figma_mcp_available` | boolean |

### human_verification[]

```json
{
  "item": "string",
  "owner": "string",
  "due": "string | null"
}
```

---

## Verdict rules

| Verdict | When |
|---|---|
| `PASS` | All audited pages pass hard gates; no `critical`/`high` findings unless scoped out |
| `FAIL` | Reachable pages have material frontend defects |
| `BLOCKED` | Target unreachable, tooling missing for required checks, or >50% pages blocked |
| `PARTIAL` | Issue explicitly requests partial scope, or some pages blocked but others audited |

Hard gates (any failure on an audited page prevents `PASS`):
- Wrong page (404, login gate, password wall)
- `red_flag: true` finding present
- Poor CWV on production scope when performance is in scope

Never use `PASS with gaps` or `probably passed`.
