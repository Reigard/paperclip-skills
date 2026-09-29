# SEO baseline contract

Specialist check id: `seo-baseline`. Ingest collection key: **`seo`** (the whole object below). Basic baseline only.

## Output paths

```txt
<task-folder>/reports/seo-baseline.html
<task-folder>/findings/seo-baseline.json
<task-folder>/artifacts/seo-baseline/
```

The parent copies this JSON onto ingest `seo`. It does not merge `findings[]` into the top-level ingest `findings[]` (those ids would diff twice). `frontend_audit.pages[].seo` is a Lighthouse category on the browser check. It is not this collection.

## findings/seo-baseline.json

```json
{
  "check": "seo-baseline",
  "status": "completed",
  "verdict": "warn",
  "generated_at": "2026-09-25T12:00:00Z",
  "environment": "production",
  "site_url": "https://example.com/",
  "scope_source": "seo_scope",
  "summary": {
    "urls_audited": 1,
    "warn_count": 1,
    "fail_count": 0
  },
  "cwv": {
    "source": "field",
    "lcp_ms": 2900,
    "cls": 0.02,
    "inp_ms": 180
  },
  "urls": [
    {
      "url": "https://example.com/",
      "http_status": 200,
      "indexable": false,
      "canonical": "https://example.com/",
      "title": "Example Site"
    }
  ],
  "findings": [
    {
      "id": "seo.index:robots-block",
      "severity": "warning",
      "scope": "front",
      "category": "seo",
      "title": "Production robots.txt blocks indexing",
      "evidence": "Disallow: / on https://example.com/robots.txt",
      "detail": "Disallow: / on https://example.com/robots.txt",
      "recommendation": "Allow indexing on the production host.",
      "follow_up": true,
      "red_flag": false
    }
  ],
  "report_url": "https://example.com/artifacts/seo-baseline.html",
  "report_json_url": "https://example.com/artifacts/seo-baseline.json"
}
```

| Key | Rule |
| --- | --- |
| `check` | `seo-baseline`, or `seo-baseline-no-cwv` / `seo-baseline-cwv-only` when the child asked for that depth |
| `verdict` | `pass` \| `warn` \| `fail` \| `unknown`. Runner WARN → `warn` |
| `scope_source` | `seo_scope` \| `site_pages` \| `main_url` |
| `cwv` | Omit when the run skipped CWV. Numbers stay here, not in `id` or `title` |
| `urls` | Only URLs this check resolved. Facts, not findings |
| `findings[].id` | Stable `seo.<area>:<token>`. Never copy `title`. Never use `front.*` |
| `findings[].severity` | `critical` \| `high` \| `warning` \| `info`. Parent leaves these inside `seo` (`warning` is allowed here) |
| `detail` | Same text as `evidence` |

`scope_source` values:

| Value | Which list was used |
| --- | --- |
| `seo_scope` | Routine/child `seo.scope` (including a capped sitemap sample) |
| `site_pages` | Routine multi-page scope (more than one URL), not the browser one-URL block |
| `main_url` | Routine production URL only |

Finding id examples: `seo.index:robots-block`, `seo.index:noindex`, `seo.canonical:missing`, `seo.sitemap:missing`, `seo.title:missing`, `seo.h1:missing`, `seo.cwv:lcp`, `seo.cwv:cls`, `seo.cwv:inp`, `seo.inventory:complete` (`follow_up: false`).

Do not stamp `weeks_observed`, `runs_observed`, or `unresolved_risk`. **`dit-ingest-diff`** does that on `seo.findings` after mapping.
