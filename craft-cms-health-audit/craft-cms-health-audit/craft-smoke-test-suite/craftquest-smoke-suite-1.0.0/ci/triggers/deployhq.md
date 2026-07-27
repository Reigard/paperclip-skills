# Trigger: DeployHQ → GitHub Actions

DeployHQ can run **SSH commands** or fire a **webhook** after a successful
deployment. Either approach works; the SSH-command approach mirrors the other
platforms and is shown here.

## Option A — Post-deploy SSH command (recommended)

1. Create a GitHub token as in [servd.md](./servd.md) (step 1).
2. In DeployHQ: **Project → Settings → SSH Commands** and add a command that
   runs **After Changes are Applied**:

```bash
curl -sS -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer YOUR_GITHUB_TOKEN" \
  https://api.github.com/repos/YOUR_ORG/craftquest-smoke-suite/dispatches \
  -d '{"event_type":"site-deployed","client_payload":{"base_url":"https://your-live-site.com"}}'
```

> DeployHQ SSH commands do not expand your server's env vars reliably, so it is
> simplest to inline the token and URL here. Restrict the token's scope
> accordingly, and rotate it if the project is shared.

## Option B — DeployHQ Webhook Notification

DeployHQ's built-in webhook posts DeployHQ's own JSON payload, which the GitHub
`repository_dispatch` API will reject (wrong shape). If you prefer webhooks,
point DeployHQ at a tiny relay (see
[custom-script.md](./custom-script.md)) that reshapes the payload into a
`repository_dispatch` call. For most members, Option A is less moving parts.

## Verify

Deploy, then check the repo's Actions tab for **Smoke — on deploy**. A `204`
from the curl means the dispatch was accepted.
