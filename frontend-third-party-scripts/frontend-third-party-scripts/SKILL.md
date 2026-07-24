---
name: frontend-third-party-scripts
description: Detect failing or slow third-party scripts (analytics, chat, forms, tag managers) using chrome-devtools-mcp list_network_requests and evaluate_script. Sub-skill merged by frontend-audit.
compatibility: "Requires chrome-devtools-mcp. Run after page load on current viewport."
---

# Frontend Third-Party Scripts

Sub-skill for **Front-end / Browser Health Agent**. Flags **third-party** integrations that fail, block render, or error in console/network.

**MCP guide:** [../../frontend-audit/frontend-audit/references/chrome-devtools-mcp.md](../../frontend-audit/frontend-audit/references/chrome-devtools-mcp.md)

## Output

```txt
<task-folder>/artifacts/frontend-audit/partials/frontend-third-party-scripts.json
```

## Procedure

### 1) Enumerate script hosts

```
evaluate_script {
  "function": "() => { const h=location.hostname.replace(/^www\\\\./,''); return Array.from(document.scripts).map(s=>s.src).filter(Boolean).map(u=>{ try { const x=new URL(u); return { url: u, host: x.hostname, third_party: !x.hostname.endsWith(h) && !x.hostname.endsWith('.'+h) }; } catch { return null; } }).filter(Boolean); }"
}
```

### 2) Cross-check network + console partials

From same page session (or merge in orchestrator):

- Failed requests where `host` is third-party (GTM, GA, Intercom, HubSpot, Facebook Pixel, reCAPTCHA, etc.)
- Console errors referencing third-party URLs
- Long main-thread tasks tied to third-party scripts (from performance partial if available)

```
list_network_requests { "resourceTypes": ["script", "xhr", "fetch"] }
```

### 3) Classify

| Status | Meaning |
| --- | --- |
| `failed` | 4xx/5xx, blocked, CORS failure |
| `slow` | Long task or >3s blocking load (note evidence) |
| `ok` | Loaded without error |

Common vendors to label in `vendor` field: `Google Tag Manager`, `Google Analytics`, `Intercom`, `HubSpot`, `Facebook Pixel`, `reCAPTCHA`, `Marketo`, etc.

### 4) Build partial

`pages[].data.third_party_scripts[]`:

```json
{
  "vendor": "Google Tag Manager",
  "url": "https://www.googletagmanager.com/gtm.js?id=...",
  "status": "failed",
  "detail": "404 / net::ERR_BLOCKED_BY_CLIENT"
}
```

Findings: failed analytics on production → `high` or `warning` depending on client tracking requirements; always set `owner` appropriately (`dev` vs `client`).

`summary.third_party_issue_count`.

## Do not

- Block pass solely because ad-blocker would block tags in agent browser — note as `info` if site code is correct
- Submit forms or trigger chat widgets unless issue scopes interaction
