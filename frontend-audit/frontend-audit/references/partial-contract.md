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
| `blocked` | `true` when MCP step could not run (tool missing, page unreachable) |
| `pages[].data` | Skill-specific payload — see each sub-skill |
| `findings[]` | Same finding shape as [contract.md](contract.md) — orchestrator merges and dedupes |
| `summary` | Optional counters for orchestrator `summary` rollup |

Orchestrator **must not** invent data for a missing partial — if partial is absent and skill was in scope, treat as `blocked`.
