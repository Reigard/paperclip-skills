---
name: frontend-site-crawl
description: Resolve flexible URL scope for the Front-end / Browser Health Agent — composable include rules, discovery limits, explicit MCP server selection for URL search (mcp.discovery vs mcp.audit), sampling, template caps, and agent presets. Writes artifacts/frontend-crawl-manifest.json before frontend-audit.
compatibility: "Requires HTTP access to seed URL. Discovery MCP optional (discovery.mcp_server). Agent setup: references/agent-config.md, references/discovery-mcp.md."
---

# Frontend Site Crawl

Determines **which URLs** the **Front-end / Browser Health Agent** should audit. Does not run console/network/CWV checks — **`frontend-audit`** does that after this manifest exists.

**Configure the agent:** [references/agent-config.md](references/agent-config.md) — presets, routine JSON.

**Discovery MCP providers:** [references/discovery-mcp.md](references/discovery-mcp.md) — which Paperclip MCP server to use for URL search.

**Agent overview:** [../../agents/frontend-browser-health-agent/AGENT.md](../../agents/frontend-browser-health-agent/AGENT.md)

## When to use

- Routine or issue defines multi-page scope, sampling, or discovery limits
- Agent creator specified **`mcp.discovery`** (URL search MCP) in Paperclip routine
- Need manifest before browser audit (`frontend-site-crawl` → `frontend-audit`)

**Skip** when issue scopes exactly one URL with no discovery — `frontend-audit` can build the same manifest internally.

## Core rules

1. Scope is **flexible** — `scope.rules[]` + `discovery` + `limits` + optional `template_caps`
2. **Select discovery MCP explicitly** — `mcp.discovery` / `discovery.mcp_server` must match a server attached to the Paperclip agent
3. **Audit MCP is separate** — `mcp.audit` is used by `frontend-audit`; may differ from discovery MCP
4. **Cap repetitive templates** with `path_sample` or `template_caps`
5. **`same_origin_links` off by default** — enable only for rare full crawls
6. Ambiguous scope → `BLOCKED`. Record excluded URLs and MCP fallback in findings

## Configuration sources (priority)

1. Routine JSON — `mcp`, `scope`, `discovery`, `limits`, `crawl_preset`
2. Issue text — natural language parsed to rules + limits
3. Preset defaults — see [agent-config.md](references/agent-config.md)

## Key parameters (agent creator)

| Area | Fields | Purpose |
|---|---|---|
| **Discovery MCP** | `mcp.discovery`, `discovery.mcp_server` | Which MCP collects nav/links (Paperclip server id) |
| **Audit MCP** | `mcp.audit` | Which MCP runs `frontend-audit` (set on agent routine) |
| **MCP fallback** | `discovery.mcp_required`, `discovery.mcp_fallback` | Block or fall back to `http_only` |
| **What to include** | `scope.rules[]` | `url`, `path`, `path_tree`, `path_sample`, `site_discovery` |
| **Page budget** | `limits.max_pages` | URLs sent to audit |
| **Sources** | `discovery.sources` | `sitemap` (HTTP), `nav_links` (needs browser MCP) |
| **Sampling** | `path_sample`, `template_caps` | Blog + N posts |

Full schema: [references/contract.md](references/contract.md)

## MCP resolution (step 0)

1. If `discovery.mcp_server` is `"auto"` (or `mcp.discovery` is `"auto"`) → walk `discovery.mcp_priority` **cheapest first**, pick first id connected in Paperclip session
2. Else use explicit `discovery.mcp_server` → else `mcp.discovery` → preset default
3. Verify server is connected (skip planned ids not yet attached — try next in chain)
4. If none available and `mcp_required: true` → `BLOCKED`
5. If none and `mcp_required: false` → `mcp_fallback` (usually `http_only`)
6. Echo `mcp_resolved`, `mcp_available`, `mcp_priority_attempted[]` in manifest

Default priority chain: `http_only` → `crawlbase-mcp` → `firecrawl-mcp` → `chrome-devtools-mcp`. Extend registry when new MCPs are added — [discovery-mcp.md](references/discovery-mcp.md).

## Procedure

### 1) Load agent config

Merge preset + routine `mcp`, `scope`, `discovery`, `limits`. Resolve discovery MCP per step 0 above.

### 2) Parse scope

Build `scope.rules[]`, caps, excludes. If `BLOCKED` → stop.

### 3) Execute rules

| Target | Discovery transport |
|---|---|
| `url` / `path` | No MCP — resolve URL |
| `sitemap` source | HTTP/`curl` — any MCP setting |
| `nav_links` / `same_origin_links` | Configured **`discovery.mcp_server`** browser tools |
| `path_sample` | Sitemap or browser MCP per rule `sources` |

Sitemap:

```bash
curl -s -o /tmp/sitemap.xml -w "%{http_code}" <origin>/sitemap.xml
```

Browser nav/links — use tools from resolved discovery MCP (e.g. `chrome-devtools-mcp`: `navigate_page`, `evaluate_script` — see [discovery-mcp.md](references/discovery-mcp.md)).

Do **not** run audit sub-skills during discovery.

### 4) Apply filters and caps → write manifest + findings

### 5) Hand off to `frontend-audit`

Audit uses **`mcp.audit`** only — not discovery MCP.

## Default maintenance values

```json
{
  "mcp": {
    "discovery": "auto",
    "audit": "chrome-devtools-mcp"
  },
  "crawl_preset": "maintenance",
  "discovery": {
    "mcp_server": "auto",
    "mcp_priority": ["http_only", "crawlbase-mcp", "firecrawl-mcp", "chrome-devtools-mcp"],
    "mcp_fallback": "http_only",
    "sources": ["sitemap", "nav_links"]
  },
  "limits": { "max_pages": 10, "max_depth": 2 }
}
```

## Example routine (agent template)

```json
{
  "target_url": "https://example.com/",
  "environment": "development",
  "checks": ["frontend-site-crawl", "frontend-audit"],
  "mcp": {
    "discovery": "chrome-devtools-mcp",
    "audit": "chrome-devtools-mcp"
  },
  "crawl_preset": "maintenance",
  "scope": {
    "instruction": "Homepage, /contact/, blog + 2 random posts",
    "priority_urls": ["https://example.com/"],
    "rules": [
      { "action": "include", "target": "url", "value": "https://example.com/" },
      { "action": "include", "target": "path", "value": "/contact/" },
      {
        "action": "include",
        "target": "path_sample",
        "value": "/blog/",
        "sample": { "include_index": true, "match_pattern": "/blog/*/", "max": 2, "strategy": "random" }
      }
    ]
  },
  "discovery": {
    "mcp_server": "chrome-devtools-mcp",
    "mcp_fallback": "http_only",
    "sources": ["sitemap", "nav_links"]
  },
  "limits": { "max_pages": 10 }
}
```

Sitemap-only discovery (audit still uses Chrome):

```json
"mcp": { "discovery": "http_only", "audit": "chrome-devtools-mcp" },
"discovery": { "mcp_server": "http_only", "sources": ["sitemap"] }
```

## BLOCKED conditions

- Empty or conflicting scope
- `mcp_required: true` and configured discovery MCP not connected
- Unknown `mcp_server` id (not attached to agent)
- Seed unreachable or login-gated without credentials

## Related

- [agent-config.md](references/agent-config.md) — agent creator guide
- [discovery-mcp.md](references/discovery-mcp.md) — MCP provider registry
- [contract.md](references/contract.md) — manifest schema
- [examples.md](references/examples.md) — scenarios
- **`frontend-audit`** — uses `mcp.audit`
