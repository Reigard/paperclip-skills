# Craft CMS contract (dit-ingest-diff)

Refines the universal contract when the ingest (or mapped Craft specialist object) comes from **`craft-cms-audit`** / **Craft CMS Health Audit Agent**.

Do **not** run `dit-ingest-diff` on the Craft child issue. The child only emits stable finding ids, plugin handles, and status objects so ingest match works later.

Canonical specialist shape: skill **`craft-cms-audit`** §5. After mapping, those keys sit on the DIT ingest object.

## When this contract applies

Any of:

- `cms` / `cms_type` / `platform` contains `craft`
- `craft_version` is present
- findings with `scope: "cms"` / `category: "craft"` / ids starting with `craft.`
- plugins with `handle` (Craft handle) and no `themes[]`

Typical source after mapping: top-level keys copied from `findings/craft-cms-audit.json` — not the child file as previous.

Do **not** emit `diff.themes` for Craft. Do not invent `themes[]`.

## Finding keys

Require stable `id` values from the Craft specialist. Examples:

- `craft.config:devMode`
- `craft.config:allowUpdates`
- `craft.config:environment`
- `craft.security:exposed-env`
- `craft.security:exposed-composer`
- `craft.plugins:inactive`
- `craft.queue:failed`
- `craft.queue:backed-up`
- `craft.cache:invalidation`
- `craft.license:expired`
- `craft.license:missing`
- `craft.license:mismatch`
- `craft.logs:php-fatal`
- `craft.inventory:complete`

**Forbidden as `id`:** a copy of `title`. If ingest still has sentence-ids, compose from the `craft.<area>:<token>` stem when obvious; otherwise treat as unmatched (`new` / `resolved`) with a `note`.

`follow_up: false` (inventory complete, skipped-by-tooling, pass confirmations) → `unresolved_risk` is `none`.

## Plugin keys

| Collection | Key order |
| ---------- | --------- |
| `plugins[]` | `handle` → `slug` → `name` |

`slug` equals `handle` on Craft rows. Do not use `wp_cli_slug`.

Snapshot `previous` / `current` on plugin rows: `name`, `version`, `update`, `update_version`, `license_status`, `status` (active/inactive).

### Updates vs licenses

Stamp `weeks_observed` / `unresolved_risk` on a plugin row when it is a **problem**:

- `update` is `available` or `update_version` is non-empty, **or**
- `license_status` is `expired` or `missing`

Healthy `update: "none"` + `license_status: valid|trial|unknown` rows still appear in `diff.plugins` as `unchanged` / `added` / `removed` / `updated` but do not accumulate unresolved risk. Treat problem rows without finding `severity` as `medium`.

Assign **one** `change` per row, in this order:

1. `added` / `removed`
2. `update-new` / `update-resolved`
3. `license-new` / `license-resolved`
4. `updated` (version or status changed, including `license_status` trial↔unknown with no problem flip)
5. `unchanged`

A license problem flip: previous `license_status` was not `expired`/`missing`, current is → `license-new`. Reverse → `license-resolved`.

If **both** an update-available flip and a license-problem flip happen on the same row, use `update-new` or `update-resolved` and put the license change in `note` (one short sentence). Do not drop the license signal.

## Do not double-count

Pending plugin updates and expired/missing licenses live on `plugins[]`. Queue / cache / log **problems** also have findings (`craft.queue:failed`, `craft.license:expired`, …).

- Do **not** invent one finding `new`/`resolved` per plugin update or per valid license.
- Prefer inventory `change` as the source of truth for “update still available” and “license still expired”.
- Keep the specialist findings (`craft.queue:failed`, `craft.license:expired`) and match them by stable `id` — do not replace those findings with the status-object row.

## Status objects (`queue`, `cache`, `licenses`, `logs`, `smoke_test`)

These are **objects** on ingest (not arrays). Diff each as a **one-row collection** when the object exists on current **or** previous.

| Ingest key | Diff key | Item `key` | `kind` |
| ---------- | -------- | ---------- | ------ |
| `queue` | `diff.queue` | `queue` | `cms_status` |
| `cache` | `diff.cache` | `cache` | `cms_status` |
| `licenses` | `diff.licenses` | `licenses` | `cms_status` |
| `logs` | `diff.logs` | `logs` | `cms_status` |
| `smoke_test` | `diff.smoke_test` | `smoke_test` | `cms_status` |

Write **an array of one item** (omit the key when both sides lack the object).

`change`: `added` / `removed` / `unchanged` / `updated`.

| Object | Unchanged when | Updated when |
| ------ | -------------- | ------------ |
| `queue` | same `status`; if completed, same `waiting` / `failed` (or same top-level `queue_waiting` / `queue_failed`) | status flip, or waiting/failed counts changed |
| `cache` | same `status` and `plugin` | status or plugin handle changed |
| `licenses` | same `status` | skipped ↔ completed (or reason changed). Per-plugin licenses are **not** this object |
| `logs` | same `status` | skipped ↔ completed. Do not diff log file bodies |
| `smoke_test` | same `skipped` / `availability` / `console_errors` | any of those flipped |

Skipped checks: copy `status: "skipped"` and `reason`. **Never invent** `queue_waiting` / `queue_failed` or fake cache/license/log evidence. Previous skipped + current skipped with the same reason → `unchanged`.

Snapshot fields (only those that exist; no secrets):

- all: `status`, `reason` (skipped)
- `queue`: `waiting`, `failed` (integers from the object or top-level scalars)
- `cache`: `plugin`
- `logs`: `sampled_files` as `title` (comma-separated names only)
- `smoke_test`: `availability`, `skipped`, `console_errors` (put a short summary in `title`)

Stamp `weeks_observed` / `unresolved_risk` on a status row **only** when it is a problem:

- `queue`: `failed > 0` (or previous failed > 0 on `removed`)
- `smoke_test`: `skipped !== true` and `availability` is a fail/down value
- `cache` / `licenses` / `logs`: do **not** stamp; findings carry risk (`craft.cache:invalidation`, `craft.logs:…`). `licenses` object is collection hygiene only

Treat stamped status rows without severity as `medium`. `weeks_observed === 0` or skipped → `unresolved_risk: none`.

## Scalars (not collections)

`craft_version`, `plugin_count`, `pending_updates`, `queue_waiting`, `queue_failed` are **not** their own `diff` arrays. Queue counts belong on the `queue` snapshot. Core version changes can be a finding if the specialist emitted one; do not invent `diff.craft_version`.

## Split / merge

Rare for Craft. Example: previous one finding “queue failed and backed up” → current `craft.queue:failed` and `craft.queue:backed-up`: `split`, inherit `weeks_observed`, then `+1`. Not `resolved`.
