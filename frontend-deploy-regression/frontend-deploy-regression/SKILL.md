---
name: frontend-deploy-regression
description: Compare current browser health partials against prior findings/frontend-audit.json baseline — new JS errors, network failures, CWV degradation. Sets red_flag on important pages. Sub-skill merged by frontend-audit.
compatibility: "Runs after other Browser Health partials. Baseline optional — do not fail when missing."
---

# Frontend Deploy Regression

Sub-skill for **Front-end / Browser Health Agent**. Detects **regressions after deploy** by diffing current audit data against the previous baseline.

**Orchestrator:** run **once** after all pages/viewports are audited.

## Output

```txt
<task-folder>/artifacts/frontend-audit/partials/frontend-deploy-regression.json
```

## Baseline sources (first match)

1. Prior task folder `findings/frontend-audit.json` (same site + environment)
2. Published Paperclip artifact linked in issue or project
3. Issue attachment / explicit path in issue JSON

If none → `{ "baseline_comparison": { "available": false, "regressions": [] } }` — **not** a failure.

## Diff rules

Per URL (normalize trailing slashes):

| Type | Regression when |
| --- | --- |
| `console_errors` | New error message not in baseline `pages[].console_errors` |
| `network_errors` | New failed request URL+status not in baseline |
| `cwv_degradation` | LCP/INP/CLS/TBT rating drops (`good`→`needs_improvement`→`poor`) or material numeric regression on production |

Ignore:

- Expected staging-only differences documented in issue
- Third-party blocked by agent environment when baseline had same pattern

## Red flags

Set `red_flag: true` on regression findings when:

- Important page (homepage, primary landing, issue critical URL)
- New JS console error **or** CWV degradation

Matches agent rule from [../../../agents/frontend-browser-health-agent/AGENT.md](../../../agents/frontend-browser-health-agent/AGENT.md).

## Build partial

```json
{
  "skill": "frontend-deploy-regression",
  "baseline_comparison": {
    "available": true,
    "baseline_generated_at": "2026-07-14T10:00:00Z",
    "baseline_source": "artifacts/prior-frontend-audit.json",
    "regressions": [
      {
        "type": "console_errors",
        "page_url": "https://example.com/",
        "title": "New console error after deploy",
        "evidence": "Uncaught TypeError: app.init is not a function",
        "red_flag": true
      }
    ]
  },
  "findings": [ ],
  "summary": { "regression_count": 1 }
}
```

Orchestrator copies `baseline_comparison` to merged `findings/frontend-audit.json` and merges regression findings.

## Inputs

Read current state from:

- `partials/frontend-browser-console.json`
- `partials/frontend-network-health.json`
- `partials/frontend-performance-cwv.json`

Do not re-navigate browser for regression-only diff.
