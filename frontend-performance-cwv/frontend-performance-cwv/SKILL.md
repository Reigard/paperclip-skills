---
name: frontend-performance-cwv
description: Capture lab Core Web Vitals (LCP, INP, CLS, TBT) via chrome-devtools-mcp performance_start_trace / performance_analyze_insight, or Lighthouse CLI performance audits when MCP tools are not in session. Sub-skill merged by frontend-audit.
compatibility: "Prefers chrome-devtools-mcp performance tools. Lighthouse CLI lab fallback when MCP tools are not callable."
---

# Frontend Performance & CWV

Sub-skill for **Front-end / Browser Health Agent**. Lab **Core Web Vitals** and performance signals — not field/CrUX unless explicitly configured.

**MCP guide:** follow the chrome-devtools-mcp bootstrap steps in the **frontend-audit** skill (attach both skills to the same agent).

## Output

```txt
<task-folder>/artifacts/frontend-audit/partials/frontend-performance-cwv.json
```

## Procedure

### Lab fallback

When `performance_start_trace` is not callable, extract LCP / CLS / TBT from Lighthouse performance audits in `artifacts/frontend-audit/lighthouse-*.json`. Set `"tool": "lighthouse-cli"`, `core_web_vitals.source: "lighthouse_lab"`, `performance.trace_available: false`. Omit `inp_ms` when LH did not report INP. Finding `source`: `lighthouse`.

If **neither** MCP trace **nor** Lighthouse JSON exist → `{ "blocked": true, "blocked_reason": "mcp_not_in_session" }`, stop.

### 1) Performance trace (preferred)

Ensure page URL is correct, then:

```
performance_start_trace { "reload": true, "autoStop": true }
```

Optional save: `"filePath": "artifacts/frontend-audit/traces/<slug>-<viewport>.json.gz"`

From trace output extract:

| Field | Notes |
| --- | --- |
| `lcp_ms` | Largest Contentful Paint |
| `cls` | Cumulative Layout Shift |
| `inp_ms` | Interaction to Next Paint (when present) |
| `tbt_ms` | Total Blocking Time |
| `long_task_count` | Main-thread long tasks |
| `rating` | Worst bucket: `good`, `needs_improvement`, `poor` |
| `source` | `lab_trace` |

Use `performance_analyze_insight` for `LCPBreakdown`, `DocumentLatency`, etc. when trace flags issues.

### 2) Thresholds (lab)

| Metric | Good | Needs improvement | Poor |
| --- | --- | --- | --- |
| LCP | < 2500 ms | 2500–4000 ms | > 4000 ms |
| CLS | < 0.1 | 0.1–0.25 | > 0.25 |
| INP | < 200 ms | 200–500 ms | > 500 ms |
| TBT | < 200 ms | 200–600 ms | > 600 ms |

Production + poor → `high` finding. Dev/staging → `warning` unless issue excludes performance.

### 3) Build partial

`pages[].data.core_web_vitals` + `pages[].data.performance` (Lighthouse performance score optional from trace insights only — do not confuse with `lighthouse_audit` a11y in accessibility sub-skill).

Findings when `rating` is `poor` or long tasks block main thread on important pages. Use stable `id` (`front.lcp:homepage`), `scope: front`, and put LCP/TBT numbers in `evidence` — not in `title`. `follow_up: true` when poor/needs improvement on production; good CWV is `follow_up: false`.

## Do not

- Report CrUX/field data without explicit CrUX source
- Use MCP `lighthouse_audit` for performance when trace tools work — trace is primary for CWV on the MCP path

On lab fallback, Lighthouse CLI performance audits **are** the CWV source (`lighthouse_lab`).
