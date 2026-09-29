# DIT ingest diff contract

Universal match, entity stamps, and `diff` JSON. WordPress, Craft, and frontend-audit key rules are in sibling files; they refine this contract, they do not replace the gate.

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
| `seo.findings` | array of findings | yes, when `seo` is an object |
| `seo.urls` | array of URLs | yes, when using the SEO contract |
| `queue` | status object | yes, when using the Craft contract (one-row `diff.queue`) |
| `cache` | status object | yes, Craft contract |
| `licenses` | status object | yes, Craft contract (collection hygiene; per-plugin licenses live on `plugins[]`) |
| `logs` | status object | yes, Craft contract |
| `smoke_test` | status object | yes, Craft contract |

Do not recurse into other nested `findings` arrays. Do not invent `themes[]` when the ingest is Craft.

## Keys

Normalize keys: trim, lowercase. Empty key → skip the item (do not invent a title key).

### Findings (`findings[]` and `frontend_audit.findings[]`)

1. Prefer stable `id` when it is **not** a copy of `title` (examples: `wp.security:readme-html`, `craft.queue:failed`, `front.lcp:homepage`, `seo.index:robots-block`).
2. Else compose `scope` + `category` + a non-title entity token from `id` / path / check slug when one exists.
3. **Never** use normalized `title` as the only key.

If two current items share a key after compose, keep both and mark `note` that the key collided.

### Plugins

`handle` → `slug` → `wp_cli_slug` → `name` (first non-empty). Craft uses `handle` / `slug`; WordPress uses `slug` / `wp_cli_slug`.

### Themes

`slug` → `name` (first non-empty). Omit `diff.themes` when the ingest has no `themes[]` (Craft).

### Status objects (`queue`, `cache`, `licenses`, `logs`, `smoke_test`)

Single synthetic key equal to the collection name (`queue`, `cache`, …). See `craft-contract.md`.

### Frontend pages

Canonical page URL (`url` or `final_url`). See `frontend-audit-contract.md`.

### SEO findings and URLs

Stable `seo.*` id. URL key is `urls[].url`. See `seo-contract.md`. Do not match these rows against `frontend_audit` ids.

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
| `unchanged` | Same key; version, update state, and license problem state unchanged |
| `updated` | Version or non-problem license/status changed (not an update-available or license-problem flip) |
| `update-new` | Previous had no pending update; current `update` is `available` (or has `update_version`) |
| `update-resolved` | Previous had a pending update; current does not |
| `license-new` | Previous license was not a problem; current `license_status` is `expired` or `missing` (Craft) |
| `license-resolved` | Previous license was `expired`/`missing`; current is not |

A row is "has update" when `update` is `available` or `update_version` is a non-empty string.
A row is "license problem" when `license_status` is `expired` or `missing`.

If update-available and license-problem both flip on the same row, prefer `update-new` / `update-resolved` and put the license flip in `note`.

### Status objects

| `change` | Meaning |
| -------- | ------- |
| `added` | Object on current only |
| `removed` | Object on previous only |
| `unchanged` | Same status and comparable scalars |
| `updated` | Status or comparable scalars changed (including skipped ↔ completed) |

## Entity stamps (on current ingest rows)

Write `weeks_observed`, `runs_observed`, and `unresolved_risk` on the same rows, using the same week math in every collection below. Do not limit the streak to `findings[]`.

| Collection | Stamp when |
| ---------- | ---------- |
| `findings[]` | The key is on the current array |
| `frontend_audit.findings[]` | The key is on the current array |
| `seo.findings[]` | The key is on the current array. Specialist `warning` counts as `medium` |
| `plugins[]` / `themes[]` | The row is still a problem (`update` available / `update-new` / license problem / `still` with update or expired license) |
| `queue` | The status row is still a problem (see `craft-contract.md`) |
| `smoke_test` | The status row is still failing (see `craft-contract.md`) |

Do not stamp `cache`, `licenses`, `logs`, `frontend_audit.pages[]`, or `seo.urls[]`. Per-plugin license problems stay on `plugins[]`. Do not stamp `seo.cwv` scalars.

Never copy a previous key onto the current collection. Resolved findings, removed inventory rows, and rows that are no longer a problem stay out of the stamp. `diff` may show `previous.weeks_observed` / `previous.runs_observed` only. If that key is emitted again on a later ingest, both counters start at `0`.

### Elapsed weeks

Use each ingest's `last_run_at`, else `timestamp`. Interpret both as UTC. A week starts Monday 00:00 UTC.

`weekIndex` is the UTC Monday of that instant, as a continuous index (do not subtract week-of-year numbers; week 1 minus week 52 is wrong). `elapsed = weekIndex(current) - weekIndex(previous)`. If that is negative, use `0`.

One `elapsed` for the whole ingest. Apply it to every matched key in every stamped collection.

### `weeks_observed` (integer ≥ 0)

Whole UTC weeks since this key was first stamped. A missing ingest week still counts. A rerun in the same UTC week does not.

- No previous match → `0`.
- Previous match but `weeks_observed` missing → treat the previous value as `0`, then add `elapsed`.
- `elapsed === 0` (same UTC week, including several runs the same day) → copy `previous.weeks_observed` when it is a number, otherwise `0`. Do not add 1.
- `elapsed >= 1` → `previous.weeks_observed + elapsed`. Two missing weeks between ingests add `2`, not `1`.
- Split: each child inherits the parent's `weeks_observed`, then add `elapsed` (not `+1` per run).
- Merge: `max(...)` of related previous values, then add `elapsed`.

### `runs_observed` (integer ≥ 0)

How many later ingests have still stamped this key. This is the old per-ingest counter. DIT Monitoring does not render it; it must still be on the entity and on `diff` snapshots.

- No previous match → `0`.
- Previous match → `(previous.runs_observed if it is a number, else 0) + 1`, even when `elapsed === 0`.
- Split: each child inherits the parent's `runs_observed` (or `0`), then `+1`.
- Merge: `max(...)` of related previous values, then `+1`.

### `unresolved_risk`

Enum: `none` \| `low` \| `medium` \| `high` \| `critical`.

This is **not** `severity`. It is the cost of leaving the item open (severity × streak).

Force `none` when any of:

- `weeks_observed === 0` (first appearance this cycle);
- `follow_up === false`;
- finding `severity` is `info` (inventory / pass confirmation).

Otherwise use this table (`warning` on `frontend_audit.findings` or `seo.findings` counts as `medium`):

| severity \ weeks | 1 | 2–3 | 4–7 | 8+ |
| ---------------- | - | --- | --- | -- |
| low | low | low | medium | medium |
| medium | medium | medium | high | high |
| high | high | high | critical | critical |
| critical | high | critical | critical | critical |

For plugin/theme problem rows without `severity`, treat as `medium`. Same for a problem `queue` or failing `smoke_test` status row.

When `elapsed === 0` and the previous stamp has `unresolved_risk`, copy that value. Do not recompute the table because severity wording changed on a same-week rerun. Still force `none` when the current row is `follow_up: false`, severity `info`, or a skipped status.

When the key is new, or `elapsed >= 1`, compute `unresolved_risk` from the table above using the new `weeks_observed`.

Compute deterministically. Free-text explanation belongs in `diff[].note`, not in `unresolved_risk`.

## `diff` object

Append at the **end** of the business object (before `_al` if present):

```json
{
  "diff": {
    "against": {
      "run_id": "<immediate previous run_id>",
      "last_run_at": "<immediate previous last_run_at or timestamp>"
    },
    "baselines": {
      "frontend_audit": {
        "run_id": "<latest earlier ingest that contained frontend_audit>",
        "last_run_at": "<that ingest last_run_at or timestamp>"
      },
      "seo": {
        "run_id": "<latest earlier ingest that contained seo>",
        "last_run_at": "<that ingest last_run_at or timestamp>"
      }
    },
    "summary": {
      "findings": { "new": 0, "still": 0, "resolved": 0, "split": 0, "merged": 0 },
      "plugins": { "added": 0, "removed": 0, "unchanged": 0, "updated": 0, "update-new": 0, "update-resolved": 0, "license-new": 0, "license-resolved": 0 },
      "themes": { "added": 0, "removed": 0, "unchanged": 0, "updated": 0, "update-new": 0, "update-resolved": 0 },
      "frontend_audit": { "new": 0, "still": 0, "resolved": 0 },
      "seo": { "new": 0, "still": 0, "resolved": 0 },
      "queue": { "added": 0, "removed": 0, "unchanged": 0, "updated": 0 },
      "cache": { "added": 0, "removed": 0, "unchanged": 0, "updated": 0 },
      "licenses": { "added": 0, "removed": 0, "unchanged": 0, "updated": 0 },
      "logs": { "added": 0, "removed": 0, "unchanged": 0, "updated": 0 },
      "smoke_test": { "added": 0, "removed": 0, "unchanged": 0, "updated": 0 }
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
          "runs_observed": 5,
          "unresolved_risk": "medium"
        },
        "current": {
          "title": "…",
          "severity": "medium",
          "weeks_observed": 3,
          "runs_observed": 6,
          "unresolved_risk": "medium"
        },
        "note": "Same path; title wording changed."
      }
    ],
    "plugins": [],
    "themes": [],
    "queue": [],
    "cache": [],
    "licenses": [],
    "logs": [],
    "smoke_test": [],
    "frontend_audit": {
      "findings": [],
      "pages": []
    },
    "seo": {
      "findings": [],
      "urls": []
    }
  }
}
```

Rules:

- `against` is the immediate previous ingest (same project, same `check_type`).
- `baselines` names an older ingest per collection when that collection was absent from `against`. Keys: `findings`, `plugins`, `themes`, `frontend_audit`, `seo`, `queue`, `cache`, `licenses`, `logs`, `smoke_test`. Omit a key when that baseline is `against`. Omit `baselines` entirely when every collection uses `against`.
- Match and stamp each collection from its baseline, not from a neighbor that skipped the check.
- Omit a collection key when that collection was not on current **and** not on its baseline (nothing to compare). Do not emit `resolved` rows for a check the current run did not include.
- Omit empty arrays.
- Omit `summary` sub-objects for omitted collections.
- `note` is optional. Use it for split/merge, title rewrite of the same key, lab-vs-MCP caveat, or a secondary license flip on an `update-new` row. One short sentence. No secrets, no license keys.
- `kind`: `finding` \| `plugin` \| `theme` \| `frontend_finding` \| `frontend_page` \| `seo_finding` \| `seo_url` \| `cms_status`.

Do not write `diff` when previous was not found or the identity gate failed.
