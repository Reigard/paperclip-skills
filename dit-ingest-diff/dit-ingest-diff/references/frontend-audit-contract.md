# Frontend-audit contract (dit-ingest-diff)

Refines the universal contract when the ingest includes **`frontend_audit`** from **Front-end / Browser Health Agent**.

Do **not** run `dit-ingest-diff` on the frontend child issue. The child only emits stable finding ids and page URLs.

This skill is **not** `frontend-deploy-regression`. That sub-skill writes `frontend_audit.baseline_comparison` (page audit vs prior specialist `findings/frontend-audit.json`). Do not read or rewrite `baseline_comparison` here.

## When this contract applies

Current object has a `frontend_audit` object (mapped from `findings/frontend-audit.json` into ingest). Diff:

- `frontend_audit.findings[]` (required when the array exists)
- `frontend_audit.pages[]` (when the array exists)

Do not use specialist `findings/frontend-audit.json` as previous unless it was already mapped into ingest shape and the caller passed it as previous ingest.

## Finding keys

Prefer specialist `id` values:

- `front.lcp:homepage`
- `front.console:clean` / `front.console:uncaught`
- `front.network:clean`
- `front.a11y:pass`
- `front.seo:crawlable`
- `front.bp:third-party-cookies`
- `front.tooling:mcp-not-in-session`

Reuse the same `id` across weekly runs. Do not put LCP milliseconds or scores in `id` or `title`.

`follow_up: false` pass confirmations (`front.console:clean`, `front.network:clean`) get `unresolved_risk: none`.

## Page keys

Use the page URL: `url`, else `final_url`. Normalize (trim, strip trailing slash except `/`, lowercase host).

Page `change`: `added` / `removed` / `still`. For `still`, add `note` only when HTTP status, block reason, or lab/MCP tooling flipped in a way that would look like a new finding.

Optional page `previous` / `current` snapshot fields: `http_status`, `console_error_count`, `failed_request_count`, LCP from `core_web_vitals.lcp_ms` when present.

## Lab vs MCP

Do **not** treat a metric as `resolved` or `new` solely because one run used Lighthouse CLI lab and the other used `chrome-devtools-mcp`. Same `id` + different `tooling.browser_tool` → `still` (or page `still`) with `note` that evidence source changed.

`frontend_audit.verdict` of `PARTIAL` / ingest `warn` on lab-only runs is expected. That is not a finding key.

## `diff.frontend_audit` shape

```json
{
  "frontend_audit": {
    "findings": [
      {
        "key": "front.lcp:homepage",
        "kind": "frontend_finding",
        "change": "still",
        "previous": { "severity": "high", "weeks_observed": 1, "unresolved_risk": "high" },
        "current": { "severity": "high", "weeks_observed": 2, "unresolved_risk": "high" }
      }
    ],
    "pages": [
      {
        "key": "https://example.com/",
        "kind": "frontend_page",
        "change": "still"
      }
    ]
  }
}
```

Summary counts for frontend findings use `new` / `still` / `resolved` (plus split/merge when used).
