# Frontend Site Crawl — Examples

## Example 1 — Homepage, no crawl instruction → single_page

**Issue text:**
```txt
Target: https://paperclip-test.designingit.co/
Environment: development
Run frontend audit on the homepage.
```

**artifacts/frontend-crawl-manifest.json:**

```json
{
  "check": "frontend-site-crawl",
  "generated_at": "2026-07-21T12:00:00Z",
  "seed_url": "https://paperclip-test.designingit.co/",
  "environment": "development",
  "scope": {
    "mode": "single_page",
    "mode_source": "issue_default",
    "crawl_allowed": false,
    "crawl_instruction": null
  },
  "discovery": {
    "sources_used": [],
    "sitemap_url": null,
    "sitemap_available": false
  },
  "limits": {
    "max_pages": 50,
    "max_depth": 3,
    "same_origin_only": true
  },
  "pages": [
    {
      "url": "https://paperclip-test.designingit.co/",
      "normalized_path": "/",
      "source": "seed",
      "depth": 0,
      "include_reason": "Seed URL only — no crawl instruction in issue"
    }
  ],
  "excluded": [],
  "stats": {
    "discovered": 1,
    "included": 1,
    "excluded": 0
  }
}
```

---

## Example 2 — Homepage + explicit site crawl

**Issue text:**
```txt
Target: https://paperclip-test.designingit.co/
Environment: development
Crawl all internal pages and run frontend audit.
```

**artifacts/frontend-crawl-manifest.json (excerpt):**

```json
{
  "scope": {
    "mode": "site_crawl",
    "mode_source": "issue_explicit",
    "crawl_allowed": true,
    "crawl_instruction": "Crawl all internal pages"
  },
  "discovery": {
    "sources_used": ["sitemap", "nav_links"],
    "sitemap_url": "https://paperclip-test.designingit.co/sitemap.xml",
    "sitemap_available": true
  },
  "pages": [
    {
      "url": "https://paperclip-test.designingit.co/",
      "normalized_path": "/",
      "source": "seed",
      "depth": 0,
      "include_reason": "Seed URL"
    },
    {
      "url": "https://paperclip-test.designingit.co/about/",
      "normalized_path": "/about/",
      "source": "sitemap",
      "depth": 1,
      "include_reason": "Listed in sitemap.xml"
    },
    {
      "url": "https://paperclip-test.designingit.co/contact/",
      "normalized_path": "/contact/",
      "source": "nav",
      "depth": 1,
      "include_reason": "Primary navigation link"
    }
  ],
  "excluded": [
    {
      "url": "https://paperclip-test.designingit.co/wp-admin/",
      "reason": "disallowed_pattern"
    },
    {
      "url": "https://paperclip-test.designingit.co/members/",
      "reason": "auth_required"
    }
  ],
  "stats": {
    "discovered": 8,
    "included": 5,
    "excluded": 3
  }
}
```

---

## Example 3 — Homepage + explicit NO crawl

**Issue text:**
```txt
Target: https://paperclip-test.designingit.co/
Homepage only — do not crawl other pages.
```

Same manifest as Example 1, but:

```json
"scope": {
  "mode": "single_page",
  "mode_source": "issue_explicit",
  "crawl_allowed": false,
  "crawl_instruction": "Homepage only — do not crawl"
}
```

---

## Example 4 — Non-homepage seed + child pages only

**Issue text:**
```txt
Target: https://paperclip-test.designingit.co/services/
Audit this section and all child pages under /services/.
Environment: development
```

**artifacts/frontend-crawl-manifest.json (excerpt):**

```json
{
  "seed_url": "https://paperclip-test.designingit.co/services/",
  "scope": {
    "mode": "child_pages_only",
    "mode_source": "issue_explicit",
    "crawl_allowed": true,
    "crawl_instruction": "child pages under /services/"
  },
  "pages": [
    {
      "url": "https://paperclip-test.designingit.co/services/",
      "normalized_path": "/services/",
      "source": "seed",
      "depth": 0,
      "include_reason": "Seed URL"
    },
    {
      "url": "https://paperclip-test.designingit.co/services/web-design/",
      "normalized_path": "/services/web-design/",
      "source": "internal_link",
      "depth": 1,
      "include_reason": "Path prefix match /services/"
    }
  ],
  "excluded": [
    {
      "url": "https://paperclip-test.designingit.co/about/",
      "reason": "out_of_scope"
    }
  ],
  "stats": {
    "discovered": 4,
    "included": 3,
    "excluded": 1
  }
}
```

---

## Example 5 — Non-homepage seed, no child instruction → single page only

**Issue text:**
```txt
Target: https://paperclip-test.designingit.co/services/web-design/
Check this landing page.
```

```json
{
  "scope": {
    "mode": "single_page",
    "mode_source": "issue_default",
    "crawl_allowed": false,
    "crawl_instruction": null
  },
  "pages": [
    {
      "url": "https://paperclip-test.designingit.co/services/web-design/",
      "normalized_path": "/services/web-design/",
      "source": "seed",
      "depth": 0,
      "include_reason": "Seed URL only — non-homepage without child-pages instruction"
    }
  ]
}
```

---

## Example 6 — BLOCKED ambiguous scope

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
      "evidence": "Issue says 'check the site' but does not specify single page, site crawl, or child pages.",
      "recommendation": "Clarify: homepage only, full crawl, or specific section with child pages.",
      "owner": "agency",
      "follow_up": true,
      "red_flag": false,
      "source": "manual",
      "evidence_type": "http"
    }
  ]
}
```

Do not write manifest when BLOCKED. Orchestrator or parent issue must clarify before `frontend-audit` runs.
