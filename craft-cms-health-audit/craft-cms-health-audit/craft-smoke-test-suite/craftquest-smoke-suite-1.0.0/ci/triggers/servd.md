# Trigger: Servd → GitHub Actions

Fire the smoke suite automatically after a successful Servd deploy.

Servd runs post-deploy commands via the **In-App Commands** / project shell. We
use it to POST a `repository_dispatch` to GitHub, which the
`smoke-on-deploy.yml` workflow listens for.

## 1. Create a GitHub token

Create a fine-grained personal access token (or a GitHub App token) with:

- Repository access: the repo holding this smoke suite
- Permission: **Contents: read** and **Actions: read/write** (dispatch needs
  the `contents:write`-equivalent `repository_dispatch` scope; a classic token
  needs the `repo` scope)

Store it in Servd as an environment variable, e.g. `SMOKE_DISPATCH_TOKEN`.

## 2. Add a post-deploy command

In your Servd project → **Settings → Post-Deploy Commands**, add:

```bash
curl -sS -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $SMOKE_DISPATCH_TOKEN" \
  https://api.github.com/repos/YOUR_ORG/craftquest-smoke-suite/dispatches \
  -d '{"event_type":"site-deployed","client_payload":{"base_url":"https://your-live-site.com"}}'
```

Replace `YOUR_ORG/craftquest-smoke-suite` and `base_url`.

## 3. Verify

Deploy once. Within a few seconds the **Smoke — on deploy** workflow should
appear in the repo's Actions tab. If it does not, check:

- The token has not expired and has the scopes above (a 401/403 is silent here).
- The repo path in the curl URL is exactly `owner/repo`.
- `event_type` matches the `types: [site-deployed]` in the workflow.

> Tip: run the curl locally first with your token to confirm a `204 No Content`
> response before wiring it into Servd.
