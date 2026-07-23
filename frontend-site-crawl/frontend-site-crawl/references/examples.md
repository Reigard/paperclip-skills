# Frontend Site Crawl — Examples

All manifests use `scope.mode: "flexible"`. Agent setup: [agent-config.md](agent-config.md). MCP providers: [discovery-mcp.md](discovery-mcp.md).

---

## Example 1 — Homepage only (`smoke`)

**Issue:** Run frontend audit on the homepage only.

```json
{
  "crawl_preset": "smoke",
  "scope": {
    "instruction": "Homepage only",
    "rules": [{ "action": "include", "target": "url", "value": "https://example.com/" }]
  },
  "limits": { "max_pages": 1 }
}
```

---

## Example 2 — Explicit page list (no discovery)

**Issue:** Check homepage, /about/, and /services/.

```json
{
  "scope": {
    "instruction": "Homepage, /about/, /services/",
    "rules": [
      { "action": "include", "target": "url", "value": "https://example.com/" },
      { "action": "include", "target": "path", "value": "/about/" },
      { "action": "include", "target": "path", "value": "/services/" }
    ]
  },
  "discovery": { "mcp_server": "http_only", "sources": [] },
  "limits": { "max_pages": 5 }
}
```

---

## Example 3 — Blog index + 2 random posts (`path_sample`)

**Issue:** Check the blog page and a couple of random post pages.

```json
{
  "scope": {
    "instruction": "Blog listing + 2 random posts",
    "rules": [
      {
        "action": "include",
        "target": "path_sample",
        "value": "/blog/",
        "sample": {
          "include_index": true,
          "match_pattern": "/blog/*/",
          "max": 2,
          "strategy": "random",
          "seed": "issue-456"
        }
      }
    ],
    "exclude_patterns": ["/tag/", "/category/", "/author/", "/blog/page/"]
  },
  "discovery": {
    "mcp_server": "chrome-devtools-mcp",
    "sources": ["sitemap"],
    "no_pagination": true
  },
  "limits": { "max_pages": 5, "max_discovery_candidates": 50 }
}
```

**pages[]:** `/blog/` + 2 sampled post URLs — not 1000+ posts from sitemap.

---

## Example 4 — Blog index + 1 post (`first`)

**Issue:** Check /blog/ and one sample post.

```json
{
  "scope": {
    "rules": [
      {
        "action": "include",
        "target": "path_sample",
        "value": "/blog/",
        "sample": {
          "include_index": true,
          "match_pattern": "/blog/*/",
          "max": 1,
          "strategy": "first"
        }
      }
    ]
  }
}
```

---

## Example 5 — Section path tree with cap

**Issue:** All pages under /services/, max 15.

```json
{
  "scope": {
    "instruction": "/services/ tree, max 15 pages",
    "rules": [
      {
        "action": "include",
        "target": "path_tree",
        "value": "/services/",
        "discover_children": true,
        "max_pages": 15,
        "max_depth": 2
      }
    ]
  },
  "discovery": { "mcp_server": "chrome-devtools-mcp", "sources": ["sitemap", "nav_links"] },
  "limits": { "max_pages": 15, "max_depth": 2 }
}
```

---

## Example 6 — Sitemap only, no browser MCP

**Issue:** Discover pages from sitemap only — no Chrome for crawl.

```json
{
  "scope": {
    "instruction": "Up to 10 pages from page sitemap",
    "rules": [
      {
        "action": "include",
        "target": "site_discovery",
        "value": "seed",
        "max_pages": 10,
        "sources": ["sitemap"]
      }
    ],
    "include_patterns": ["/", "/about/", "/services/", "/contact/"]
  },
  "discovery": {
    "mcp_server": "http_only",
    "sources": ["sitemap"],
    "sitemap_filter": "page-sitemap"
  },
  "limits": { "max_pages": 10, "max_discovery_candidates": 100 }
}
```

---

## Example 7 — Primary navigation only

**Issue:** Audit pages linked from the main menu.

```json
{
  "scope": {
    "instruction": "Primary navigation pages",
    "rules": [{ "action": "include", "target": "url", "value": "https://example.com/" }],
    "priority_urls": ["https://example.com/"]
  },
  "discovery": {
    "mcp_server": "chrome-devtools-mcp",
    "sources": ["nav_links"],
    "nav_scope": "primary_only"
  },
  "limits": { "max_pages": 10, "max_depth": 1 }
}
```

Agent loads homepage in Chrome, extracts primary nav hrefs only.

---

## Example 8 — Mixed scope (homepage + services tree + blog sample)

**Issue:** Homepage, all /services/ pages, blog + 2 posts.

```json
{
  "scope": {
    "instruction": "Homepage, /services/*, blog + 2 posts",
    "priority_urls": ["https://example.com/"],
    "rules": [
      { "action": "include", "target": "url", "value": "https://example.com/" },
      {
        "action": "include",
        "target": "path_tree",
        "value": "/services/",
        "discover_children": true,
        "max_pages": 10
      },
      {
        "action": "include",
        "target": "path_sample",
        "value": "/blog/",
        "sample": {
          "include_index": true,
          "match_pattern": "/blog/*/",
          "max": 2,
          "strategy": "random"
        }
      }
    ]
  },
  "limits": { "max_pages": 15 }
}
```

---

## Example 9 — Template caps on products

**Issue:** Product archive + up to 3 product pages.

```json
{
  "scope": {
    "instruction": "Products listing + 3 samples",
    "rules": [
      { "action": "include", "target": "path", "value": "/products/" },
      {
        "action": "include",
        "target": "path_tree",
        "value": "/products/",
        "discover_children": true,
        "sources": ["sitemap"]
      }
    ],
    "template_caps": [
      {
        "pattern": "/products/*/",
        "max": 3,
        "strategy": "spread",
        "always_include": ["/products/"]
      }
    ]
  },
  "limits": { "max_pages": 8 }
}
```

---

## Example 10 — Full site crawl (`full` preset — rare)

**Issue:** Crawl all internal pages (explicit approval required).

```json
{
  "crawl_preset": "full",
  "scope": {
    "instruction": "Full site crawl",
    "rules": [{ "action": "include", "target": "site_discovery", "value": "seed" }]
  },
  "discovery": {
    "mcp_server": "chrome-devtools-mcp",
    "sources": ["sitemap", "nav_links", "same_origin_links"],
    "nav_scope": "all_nav",
    "no_pagination": false
  },
  "limits": { "max_pages": 50, "max_depth": 3, "max_discovery_candidates": 500 }
}
```

---

## Example 11 — Truncation info finding

When discovery finds 45 URLs but `max_pages: 10`:

**findings/frontend-site-crawl.json (excerpt):**

```json
{
  "verdict": "PASS",
  "findings": [
    {
      "severity": "info",
      "title": "URL scope truncated",
      "evidence": "Discovered 45 candidates; included 10 (max_pages). 35 excluded as over_limit.",
      "recommendation": "Raise limits.max_pages or narrow scope rules if more pages are required.",
      "owner": "agency",
      "follow_up": false
    }
  ]
}
```

**stats.excluded_by_reason:** `{ "over_limit": 35 }`

---

## Example 12 — BLOCKED ambiguous scope

**Issue:** Check the site frontend. (no pages, no crawl mode)

→ `verdict: BLOCKED`, no manifest. See [contract.md](contract.md) § Validation.

---

## Example 13 — Different discovery vs audit MCP

**Agent routine:** sitemap crawl without Chrome for discovery; full audit in Chrome.

```json
{
  "mcp": {
    "discovery": "http_only",
    "audit": "chrome-devtools-mcp"
  },
  "scope": {
    "rules": [
      { "action": "include", "target": "site_discovery", "value": "seed", "sources": ["sitemap"], "max_pages": 10 }
    ]
  },
  "discovery": {
    "mcp_server": "http_only",
    "mcp_resolved": "http_only",
    "sources": ["sitemap"]
  }
}
```

`frontend-audit` bootstraps **`chrome-devtools-mcp`** from `mcp.audit` — not used during crawl.

---

## Legacy manifest compat

Manifests with `scope.mode: single_page | site_crawl | child_pages_only` remain readable. Re-run with `flexible` + [agent-config.md](agent-config.md) presets.
