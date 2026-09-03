# WordPress contract (dit-ingest-diff)

Refines the universal contract when the ingest (or mapped WordPress specialist object) includes CMS inventory from **WordPress Agent**.

Do **not** run `dit-ingest-diff` on the WordPress child issue. The child only emits keys this skill can match later.

## When this contract applies

Current object has `plugins[]` and/or `themes[]`, or findings with `scope: "cms"` / `category: "wordpress"` / ids starting with `wp.`.

Typical source after mapping: specialist `findings/wordpress-basic.json` (and siblings) copied into DIT ingest — not the child file as previous.

## Finding keys

Require stable `id` values from WordPress Agent. Examples:

- `wp.security:readme-html`
- `wp.security:license-txt`
- `wp.indexing:blog-public`
- `wp.inventory:complete`

**Forbidden as `id`:** a full sentence or a copy of `title` (`"Security exposure: /readme.html is accessible"`). If ingest still has sentence-ids, compose from path / slug in `evidence` when obvious (`readme.html` → `wp.security:readme-html`); if not obvious, skip title-only match and treat as unmatched (`new` / `resolved`) with a `note`.

Do not treat inventory / pass confirmations as unresolved problems:

- `follow_up: false` → `unresolved_risk` is `none` (streak may still increment).
- Examples: filesystem inventory completed, robots.txt available, sitemap available.

## Inventory keys

| Collection | Key order |
| ---------- | --------- |
| `plugins[]` | `slug` → `wp_cli_slug` → `name` |
| `themes[]` | `slug` → `name` |

Stamp `weeks_observed` / `unresolved_risk` on a plugin or theme row only when it is a problem (`update` is `available` or `update_version` is non-empty). Healthy `update: "none"` rows still appear in `diff.plugins` / `diff.themes` as `unchanged` / `added` / `removed` / `updated` but do not accumulate unresolved risk.

## Do not double-count updates

Pending plugin / theme / core updates live on `plugins[]`, `themes[]`, and version scalars.

If top-level `findings[]` also has rollup titles like "Plugin updates appear available":

- Match that finding by stable id if the specialist emitted one (`wp.updates:plugins`).
- Do **not** invent `resolved` / `new` finding rows for each plugin that already has an inventory `change` of `update-new` / `update-resolved`.
- Prefer inventory `change` as the source of truth for "update still available".

## Split / merge examples

- Previous one finding "readme.html and license.txt publicly accessible" → current two ids `wp.security:readme-html` and `wp.security:license-txt`: `split`, inherit `weeks_observed`, then `+1`. Not `resolved`.
- Reverse: `merged`.
