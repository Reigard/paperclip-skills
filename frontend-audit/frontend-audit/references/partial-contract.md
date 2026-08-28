# Sub-skill partial outputs

Each Browser Health **sub-skill** writes one partial file per run (or per page — see skill). The **`frontend-audit`** orchestrator merges these into `findings/frontend-audit.json`.

## Path convention

```txt
<task-folder>/artifacts/frontend-audit/partials/<skill-id>.json
```

Example: `artifacts/frontend-audit/partials/frontend-browser-console.json`

## Partial object shape

```json
{
  "skill": "frontend-browser-console",
  "generated_at": "2026-07-23T10:00:00Z",
  "tool": "chrome-devtools-mcp",
  "blocked": false,
  "blocked_reason": null,
  "pages": [
    {
      "url": "https://example.com/",
      "viewport": "1440x1100",
      "data": { }
    }
  ],
  "findings": [ ],
  "summary": { }
}
```

| Field | Notes |
| --- | --- |
| `tool` | `chrome-devtools-mcp` or `lighthouse-cli` |
| `blocked` | `true` when **neither** MCP nor Lighthouse JSON could run (tool missing, page unreachable). Lab fallback from LH JSON is **not** blocked. |
| `pages[].data` | Skill-specific payload — see each sub-skill |
| `findings[]` | Same finding shape as [contract.md](contract.md) — include `id`, `scope`, `recommendation`, `follow_up`; orchestrator merges and dedupes |
| `summary` | Optional counters for orchestrator `summary` rollup |
| `skipped` | Optional; `true` with reason `mcp_not_in_session` for MCP-only fields the lab path cannot fill |

Orchestrator **must not** invent data for a missing partial — if partial is absent and skill was in scope, treat as `blocked`.
