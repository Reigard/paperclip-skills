---
name: frontend-network-health
description: Audit network requests on a loaded page via chrome-devtools-mcp — 404/500, CORS, mixed content, failed scripts/styles/images, broken images (evaluate_script). Lighthouse CLI network-requests when MCP tools are not in session. Sub-skill merged by frontend-audit.
compatibility: "Prefers chrome-devtools-mcp after orchestrator navigation. Lighthouse CLI lab fallback when MCP tools are not callable."
---

# Frontend Network Health

Sub-skill for **Front-end / Browser Health Agent**. Checks **network failures** and **broken resources** — not WordPress/server infra.

**MCP guide:** follow the chrome-devtools-mcp bootstrap steps in the **frontend-audit** skill (attach both skills to the same agent).

## Output

```txt
<task-folder>/artifacts/frontend-audit/partials/frontend-network-health.json
```

## Procedure

### Lab fallback

When `list_network_requests` is not callable, map failed/blocked items from Lighthouse `network-requests` (and related audits) in `artifacts/frontend-audit/lighthouse-*.json`. Set `"tool": "lighthouse-cli"`. Broken-image DOM check (`evaluate_script`) is skipped (`skipped: true`, reason `mcp_not_in_session`) unless LH already lists failed images. Finding `source`: `lighthouse`.

If **neither** MCP **nor** Lighthouse JSON exist → `{ "blocked": true, "blocked_reason": "mcp_not_in_session" }`, stop.

### 1) List requests

```
list_network_requests {
  "resourceTypes": ["document", "script", "stylesheet", "image", "font", "xhr", "fetch"]
}
```

Flag entries where:

- HTTP status ≥ 400
- Status text indicates failure / `(failed)`
- CORS error in failure reason
- Mixed content (HTTPS page loading active HTTP subresources)
- Blocked by client / extension (note but usually lower severity)

For ambiguous rows:

```
get_network_request { "reqid": <n> }
```

### 2) Broken images

```
evaluate_script {
  "function": "() => Array.from(document.images).filter(img => !img.complete || img.naturalWidth === 0).map(img => ({ url: img.currentSrc || img.src, alt: img.alt || '' }))"
}
```

Merge with failed `image` requests from step 1 (dedupe by URL).

### 3) Build partial

`pages[].data`:

```json
{
  "failed_requests": [
    { "url": "...", "status": 404, "resource_type": "script", "failure_reason": "..." }
  ],
  "broken_images": [
    { "url": "...", "alt": "..." }
  ]
}
```

Findings for critical document/script 404 on important pages → `high`. Secondary asset 404 → `warning`. Each finding needs stable `id` (`front.network:failed-request`), `scope: front`, `recommendation`, and `follow_up: true` for real failures. Clean pass (`No failed network requests`) uses `follow_up: false`.

`summary.failed_request_count`, `summary.broken_image_count`.

## Do not

- Replace server-side curl/TLS checks
- Treat CDN geo-blocks as site-down without context
