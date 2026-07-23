# Frontend Site Crawl — Examples

All new manifests use `scope.mode: "flexible"` with composable `scope.rules[]`.

---

## Example 1 — Homepage only (safe default)

**Issue text:**
```txt
Target: https://paperclip-test.designingit.co/
Environment: development
Run frontend audit on the homepage.
```

**scope (excerpt):**
```json
{
  "mode": "flexible",
  "mode_source": "issue_default",
  "instruction": "Homepage only",
  "rules": [
    { "action": "include", "target": "url", "value": "https://paperclip-test.designingit.co/" }
  ],
  "exclude_patterns": ["/wp-admin/", "/cart/"]
}
```

**pages[]:** seed URL only.

---

## Example 2 — Full site crawl

**Issue text:**
```txt
Target: https://paperclip-test.designingit.co/
Environment: development
Crawl all internal pages and run frontend audit.
```

**scope (excerpt):**
```json
{
  "mode": "flexible",
  "mode_source": "issue_explicit",
  "instruction": "Crawl all internal pages",
  "rules": [
    { "action": "include", "target": "site_discovery", "value": "seed" }
  ]
}
```

**pages[] (excerpt):** seed + discovered `/about/`, `/contact/`, etc. from sitemap/nav.

---

## Example 3 — Homepage + explicit named pages

**Issue text:**
```txt
Target: https://example.com/
Check the homepage, /about/, and /services/.
Environment: production
```

**scope (excerpt):**
```json
{
  "mode": "flexible",
  "mode_source": "issue_explicit",
  "instruction": "Homepage, /about/, /services/",
  "rules": [
    { "action": "include", "target": "url", "value": "https://example.com/" },
    { "action": "include", "target": "path", "value": "/about/" },
    { "action": "include", "target": "path", "value": "/services/" }
  ]
}
```

**pages[]:** exactly three URLs — no site-wide discovery.

---

## Example 4 — Section path tree (child pages)

**Issue text:**
```txt
Target: https://example.com/services/
Audit this page and all child pages under /services/.
Environment: development
```

**scope (excerpt):**
```json
{
  "mode": "flexible",
  "mode_source": "issue_explicit",
  "instruction": "/services/ and all child pages under /services/",
  "rules": [
    {
      "action": "include",
      "target": "path_tree",
      "value": "/services/",
      "discover_children": true
    }
  ]
}
```

**pages[] (excerpt):**
```json
[
  {
    "url": "https://example.com/services/",
    "include_reason": "Path tree root /services/",
    "matched_rule_index": 0
  },
  {
    "url": "https://example.com/services/web-design/",
    "include_reason": "Discovered under /services/",
    "matched_rule_index": 0
  }
]
```

`/about/` excluded as `out_of_scope`.

---

## Example 5 — Explicit URL list (unrelated paths)

**Issue text:**
```txt
Target: https://example.com/
Check /about/, /contact/, /blog/, and /news/.
```

**scope (excerpt):**
```json
{
  "mode": "flexible",
  "mode_source": "issue_explicit",
  "instruction": "/about/, /contact/, /blog/, /news/",
  "rules": [
    { "action": "include", "target": "path", "value": "/about/" },
    { "action": "include", "target": "path", "value": "/contact/" },
    { "action": "include", "target": "path", "value": "/blog/" },
    { "action": "include", "target": "path", "value": "/news/" }
  ]
}
```

**pages[]:** four paths only — no discovery beyond explicit rules.

---

## Example 6 — Mixed scope (homepage + section tree)

**Issue text:**
```txt
Target: https://example.com/
Check homepage and all pages under /services/ after deploy.
```

**scope (excerpt):**
```json
{
  "mode": "flexible",
  "mode_source": "issue_explicit",
  "instruction": "Homepage and all pages under /services/",
  "rules": [
    { "action": "include", "target": "url", "value": "https://example.com/" },
    {
      "action": "include",
      "target": "path_tree",
      "value": "/services/",
      "discover_children": true
    }
  ]
}
```

Union of homepage + `/services/*` descendants.

---

## Example 7 — Single landing page (inner seed)

**Issue text:**
```txt
Target: https://paperclip-test.designingit.co/services/web-design/
Check this landing page.
```

**scope (excerpt):**
```json
{
  "mode": "flexible",
  "mode_source": "issue_default",
  "instruction": "Single page — /services/web-design/",
  "rules": [
    {
      "action": "include",
      "target": "url",
      "value": "https://paperclip-test.designingit.co/services/web-design/"
    }
  ]
}
```

---

## Example 8 — Routine payload with structured scope

**Routine JSON:**
```json
{
  "target_url": "https://example.com/",
  "environment": "staging",
  "checks": ["frontend-site-crawl", "frontend-audit"],
  "scope": {
    "instruction": "Homepage, /about/, and all under /services/",
    "rules": [
      { "action": "include", "target": "url", "value": "https://example.com/" },
      { "action": "include", "target": "path", "value": "/about/" },
      {
        "action": "include",
        "target": "path_tree",
        "value": "/services/",
        "discover_children": true
      }
    ],
    "exclude_patterns": ["/wp-admin/", "/cart/"]
  }
}
```

`mode_source: "routine"` in manifest.

---

## Example 9 — BLOCKED ambiguous scope

**Issue text:**
```txt
Target: https://paperclip-test.designingit.co/
Check the site frontend.
```

**findings/frontend-site-crawl.json:**
```json
{
  "check": "frontend-site-crawl",
  "verdict": "BLOCKED",
  "generated_at": "2026-07-21T12:00:00Z",
  "manifest_path": null,
  "findings": [
    {
      "severity": "high",
      "category": "frontend",
      "title": "Ambiguous crawl scope",
      "evidence": "Issue says 'check the site' but does not list pages, path trees, or site crawl.",
      "recommendation": "Clarify scope: list URLs/paths, request path tree (e.g. all under /services/), or request full site crawl.",
      "owner": "agency",
      "follow_up": true,
      "red_flag": false,
      "source": "manual",
      "evidence_type": "http"
    }
  ]
}
```

Do not write manifest when BLOCKED.

---

## Legacy manifest compat

Old manifests with `scope.mode: "single_page" | "site_crawl" | "child_pages_only"` remain valid for `frontend-audit` step 0. Convert to equivalent `flexible` rules per [contract.md](contract.md) § Legacy preset mapping when re-running.
