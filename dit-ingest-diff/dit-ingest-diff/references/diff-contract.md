# DIT ingest diff contract

Universal match, entity stamps, and `diff` JSON. WordPress and frontend-audit key rules are in sibling files; they refine this contract, they do not replace the gate.

## Unwrap

If the object has `body.result` or `requestBody.result` and that nested object has `run_id` / `check_type` / collections, use the nested object. Do not diff the AL wrapper (`query`, `params`, `notify`, `deliveries`).

## Collections

| Path on ingest | Kind | Diff only if present |
| -------------- | ---- | -------------------- |
| `findings` | array of findings | yes |
| `plugins` | array of inventory rows | yes |
| `themes` | array of inventory rows | yes |
| `frontend_audit.findings` | array of findings | yes, when `frontend_audit` is an object |
| `frontend_audit.pages` | array of pages | yes, when using the frontend-audit contract |

Do not recurse into other nested `findings` arrays.

## Keys

Normalize keys: trim, lowercase. Empty key → skip the item (do not invent a title key).

### Findings (`findings[]` and `frontend_audit.findings[]`)

1. Prefer stable `id` when it is **not** a copy of `title` (examples: `wp.security:readme-html`, `front.lcp:homepage`).
2. Else compose `scope` + `category` + a non-title entity token from `id` / path / check slug when one exists.
3. **Never** use normalized `title` as the only key.

If two current items share a key after compose, keep both and mark `note` that the key collided.

### Plugins

`slug` → `wp_cli_slug` → `name` (first non-empty).

### Themes

`slug` → `name` (first non-empty).

### Frontend pages

Canonical page URL (`url` or `final_url`). See `frontend-audit-contract.md`.

## Change values

### Finding lists

| `change` | Meaning |
| -------- | ------- |
| `new` | Current key with no previous match and not a split/merge child |
| `still` | Same key in previous and current |
| `resolved` | Previous key missing in current, and not explained by split/merge |
| `split` | One previous key became two or more current keys (`related_keys`) |
| `merged` | Two or more previous keys became one current key (`related_keys`) |

`split` and `merged` are **never** `resolved`.

Detect split/merge only when evidence is strong (same path/slug/id stem, or explicit related ids). If unsure, treat as `new` / `resolved` and add a short `note`.

### Inventory (`plugins[]`, `themes[]`)

| `change` | Meaning |
| -------- | ------- |
| `added` | Row in current only |
| `removed` | Row in previous only |
| `unchanged` | Same key; version and update state unchanged |
| `updated` | Version changed (not an update-available flip) |
| `update-new` | Previous had no pending update; current `update` is `available` (or has `update_version`) |
| `update-resolved` | Previous had a pending update; current does not |

A row is "has update" when `update` is `available` or `update_version` is a non-empty string.

## Entity stamps (on current ingest rows)

Write these on the **current** finding (and `frontend_audit` findings). Write them on plugin/theme rows only when the row is a problem (`update` available / `update-new` / `still` with update).

### `weeks_observed` (integer ≥ 0)

```
if previous.weeks_observed is a number
  current.weeks_observed = previous.weeks_observed + 1
else
  current.weeks_observed = 0
```

- No previous match → `0`.
- Previous match but field missing → `0`.
- Missed a weekly cycle (no match last ingest) → reset to `0`, do not continue a lifetime count.
- Increment is **+1 per previous ingest of the same `check_type`**, not calendar-week math.
- Split: children inherit the parent's `weeks_observed`, then apply `+1`.
- Merge: `max(...)` of related previous values, then `+1`.
- Resolved items are not on the current array; do not increment. `diff` may show `previous.weeks_observed` only.

### `unresolved_risk`

Enum: `none` \| `low` \| `medium` \| `high` \| `critical`.

This is **not** `severity`. It is the cost of leaving the item open (severity × streak).

Force `none` when any of:

- `weeks_observed === 0` (first appearance this cycle);
- `follow_up === false`;
- finding `severity` is `info` (inventory / pass confirmation).

Otherwise use this table (`warning` on `frontend_audit.findings` counts as `medium`):

| severity \ weeks | 1 | 2–3 | 4–7 | 8+ |
| ---------------- | - | --- | --- | -- |
| low | low | low | medium | medium |
| medium | medium | medium | high | high |
| high | high | high | critical | critical |
| critical | high | critical | critical | critical |

For plugin/theme problem rows without `severity`, treat as `medium`.

Compute deterministically. Free-text explanation belongs in `diff[].note`, not in `unresolved_risk`.

## `diff` object

Append at the **end** of the business object (before `_al` if present):

```json
{
  "diff": {
    "against": {
      "run_id": "<previous run_id>",
      "last_run_at": "<previous last_run_at or timestamp>"
    },
    "summary": {
      "findings": { "new": 0, "still": 0, "resolved": 0, "split": 0, "merged": 0 },
      "plugins": { "added": 0, "removed": 0, "unchanged": 0, "updated": 0, "update-new": 0, "update-resolved": 0 },
      "themes": { "added": 0, "removed": 0, "unchanged": 0, "updated": 0, "update-new": 0, "update-resolved": 0 },
      "frontend_audit": { "new": 0, "still": 0, "resolved": 0 }
    },
    "findings": [
      {
        "key": "wp.security:readme-html",
        "kind": "finding",
        "change": "still",
        "related_keys": [],
        "previous": {
          "title": "…",
          "severity": "medium",
          "weeks_observed": 2,
          "unresolved_risk": "medium"
        },
        "current": {
          "title": "…",
          "severity": "medium",
          "weeks_observed": 3,
          "unresolved_risk": "medium"
        },
        "note": "Same path; title wording changed."
      }
    ],
    "plugins": [],
    "themes": [],
    "frontend_audit": {
      "findings": [],
      "pages": []
    }
  }
}
```

Rules:

- Omit a collection key when that collection was not on current **and** not on previous (nothing to compare).
- Omit empty arrays.
- Omit `summary` sub-objects for omitted collections.
- `note` is optional. Use it for split/merge, title rewrite of the same key, or lab-vs-MCP caveat. One short sentence. No secrets.
- `kind`: `finding` \| `plugin` \| `theme` \| `frontend_finding` \| `frontend_page`.

Do not write `diff` when previous was not found or the identity gate failed.
