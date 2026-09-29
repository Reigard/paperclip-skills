# SEO contract (dit-ingest-diff)

Refines the universal contract when the ingest includes **`seo`** from **SEO Baseline Agent** (`findings/seo-baseline.json` mapped onto that key).

Do **not** run `dit-ingest-diff` on the SEO child issue. The child only emits stable `seo.*` ids and URL rows.

This is not `frontend_audit`. Do not read `frontend_audit.pages[].seo` or `front.seo:*` / `front.lcp:*` as this collection. Do not diff `artifacts/frontend-crawl-manifest.json`.

## When this contract applies

Current object has an `seo` object. Diff:

- `seo.findings[]` (when the array exists)
- `seo.urls[]` (when the array exists)

Do not use specialist `findings/seo-baseline.json` as previous unless it was already mapped onto ingest `seo` and the caller passed that ingest as previous.

## Finding keys

Prefer specialist `id` values:

- `seo.index:robots-block`
- `seo.index:noindex`
- `seo.canonical:missing`
- `seo.sitemap:missing`
- `seo.title:missing`
- `seo.h1:missing`
- `seo.cwv:lcp`
- `seo.cwv:cls`
- `seo.cwv:inp`
- `seo.inventory:complete`

Reuse the same `id` across runs. Do not put milliseconds or scores in `id` or `title`.

`follow_up: false` (`seo.inventory:complete` and other pass confirmations) gets `unresolved_risk: none`. Specialist `severity: warning` counts as `medium` in the risk table.

## URL keys

Use `urls[].url`. Normalize (trim, strip trailing slash except `/`, lowercase host).

URL `change`: `added` / `removed` / `still`. Do not stamp `weeks_observed`, `runs_observed`, or `unresolved_risk` on URL rows. Optional snapshot fields on `still`: `http_status`, `indexable`.

## CWV source

Do **not** treat a metric as `new` or `resolved` only because `cwv.source` flipped (`field` ↔ `lab`). Same finding `id` → `still` with a `note` that the evidence source changed. CWV numbers are not their own diff collection.

## `diff.seo` shape

```json
{
  "seo": {
    "findings": [
      {
        "key": "seo.index:robots-block",
        "kind": "seo_finding",
        "change": "still",
        "previous": { "severity": "warning", "weeks_observed": 1, "runs_observed": 2, "unresolved_risk": "medium" },
        "current": { "severity": "warning", "weeks_observed": 2, "runs_observed": 3, "unresolved_risk": "medium" }
      }
    ],
    "urls": [
      {
        "key": "https://example.com/",
        "kind": "seo_url",
        "change": "still"
      }
    ]
  }
}
```

Summary counts for SEO findings use `new` / `still` / `resolved` (plus split/merge when used).
