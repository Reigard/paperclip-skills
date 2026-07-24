# Front-end / Browser Health Agent — Report Contracts

Specialist check id: `frontend-audit` (orchestrator). Audits **live browser behaviour** via real Chrome (chrome-devtools-mcp). Sub-skills write partials under `artifacts/frontend-audit/partials/`; this contract describes the **merged** `findings/frontend-audit.json`. Not HTML-only analysis. **No Figma or design comparison.**

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
  "baseline_comparison": { },
  "tooling": { },
  "human_verification": [ ]
}
```

Do **not** include `figma_comparison` — design comparison is out of scope for this agent.

### target

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `issue` | string | yes | Paperclip child issue id |
| `environment` | string | yes | `development`, `staging`, or `production` |
| `seed_url` | string | yes | URL from the issue |
| `crawl_manifest_path` | string | no | Path to manifest when multi-page |

### scope

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `mode` | string | yes | `flexible` (new runs). Legacy: `single_page`, `site_crawl`, `child_pages_only` |
| `instruction` | string | no | Human summary from crawl manifest `scope.instruction` |
| `rules` | array | no | Copy of manifest `scope.rules[]` when multi-rule scope |
| `pages_requested` | number | yes | Count from manifest or `1` |
| `pages_audited` | number | yes | Successfully audited |
| `pages_blocked` | number | yes | Could not audit (404, login, timeout) |

### summary

| Field | Type | Description |
| --- | --- | --- |
| `console_error_pages` | number | Pages with ≥1 console error |
| `failed_request_pages` | number | Pages with failed network requests |
| `broken_image_pages` | number | Pages with broken images |
| `poor_cwv_pages` | number | Pages with poor LCP, CLS, INP, or TBT (lab) |
| `third_party_issue_pages` | number | Pages with third-party script/network issues |
| `accessibility_issue_pages` | number | Pages with basic a11y issues flagged |
| `regression_count` | number | New issues vs baseline |
| `critical_findings` | number | Count |
| `high_findings` | number | Count |
| `warning_findings` | number | Count |
| `red_flags` | number | Count where `red_flag: true` |

### pages[] — per-page result

| Field | Type | Required |
| --- | --- | --- |
| `url` | string | yes |
| `final_url` | string | yes |
| `http_status` | number | yes |
| `title` | string | no |
| `viewport_results` | array | yes |
| `console_errors` | array | yes |
| `failed_requests` | array | yes |
| `broken_images` | array | yes |
| `core_web_vitals` | object | no |
| `performance` | object | no |
| `third_party_scripts` | array | no |
| `accessibility` | object | no |
| `screenshots` | object | no |
| `status` | string | yes — `audited`, `blocked`, `skipped` |

### viewport_results[]

| Field | Type | Description |
| --- | --- | --- |
| `viewport` | string | e.g. `1440x1100`, `390x844` |
| `screenshot` | string | Relative path under artifacts |
| `console_error_count` | number | |
| `failed_request_count` | number | |

### core_web_vitals (lab only)

| Field | Type | Threshold source |
| --- | --- | --- |
| `lcp_ms` | number | Good < 2500 |
| `cls` | number | Good < 0.1 |
| `inp_ms` | number | Good < 200 |
| `tbt_ms` | number | Good < 200 |
| `source` | string | `lab_trace`, `lighthouse_lab` |
| `rating` | string | `good`, `needs_improvement`, `poor` |

Overall `rating` should reflect the worst of LCP/CLS/INP/TBT when multiple metrics are present.

### performance (optional)

| Field | Type | Description |
| --- | --- | --- |
| `lighthouse_performance_score` | number | 0–100 when Lighthouse ran |
| `long_task_count` | number | Main-thread long tasks from trace |
| `trace_available` | boolean | Performance trace captured |

### third_party_scripts[] (optional)

| Field | Type | Description |
| --- | --- | --- |
| `vendor` | string | e.g. `Google Analytics`, `Intercom` |
| `url` | string | Script URL or domain |
| `status` | string | e.g. `failed`, `slow`, `blocked` |
| `detail` | string | Error or timing evidence |

### accessibility (optional, basic)

| Field | Type | Description |
| --- | --- | --- |
| `lighthouse_accessibility_score` | number | 0–100 when available |
| `issues` | array | Short titles of flagged items (not full WCAG audit) |

### findings[] — shared finding object

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
  "source": "chrome-devtools-mcp | lighthouse | playwright | curl | manual",
  "evidence_type": "browser-smoke | screenshot | performance-trace | http | regression | accessibility"
}
```

**Red flag rule:** set `red_flag: true` when an **important page** (homepage, primary landing, or issue-scoped critical URL) has a JavaScript console error **or** CWV degradation vs baseline (or poor CWV on production when in scope).

### baseline_comparison

Compare against the previous `frontend-audit` for the same site + environment when available.

```json
{
  "available": true,
  "baseline_generated_at": "2026-07-14T10:00:00Z",
  "baseline_source": "artifacts/prior-frontend-audit.json",
  "regressions": [
    {
      "type": "console_errors | network_errors | cwv_degradation",
      "page_url": "https://example.com/",
      "title": "New console error after deploy",
      "evidence": "Uncaught TypeError: app.init is not a function (main.js:88)",
      "red_flag": true
    }
  ]
}
```

When no prior audit exists: `{ "available": false, "regressions": [] }`.

### tooling

| Field | Description |
| --- | --- |
| `browser_tool` | Tool actually used (prefer `chrome-devtools-mcp`) |
| `browser_tool_available` | boolean — real browser required |
| `lighthouse_available` | boolean |

Do **not** include `figma_mcp_available`.

### human_verification[]

```json
{
  "item": "string",
  "owner": "string",
  "due": "string | null"
}
```

No Figma or visual design sign-off items — those belong to `agency-visual-qa`.

---

## Verdict rules

| Verdict | When |
| --- | --- |
| `PASS` | All audited pages pass hard gates; no `critical`/`high` findings unless scoped out |
| `FAIL` | Reachable pages have material browser health defects or regressions |
| `BLOCKED` | Target unreachable, real browser tooling missing, or >50% pages blocked |
| `PARTIAL` | Issue explicitly requests partial scope, or some pages blocked but others audited |

Hard gates (any failure on an audited page prevents `PASS`):

- Wrong page (404, login gate, password wall)
- `red_flag: true` finding present
- Poor CWV on production scope when performance is in scope

Never use `PASS with gaps` or `probably passed`.
