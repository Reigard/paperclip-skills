# Trigger: Laravel Forge → GitHub Actions

Forge deploys Craft sites via its **Deploy Script**. Append a dispatch curl to
the end of that script so smoke tests run after each successful deploy.

## 1. GitHub token

Create a token as described in [servd.md](./servd.md) (step 1). Add it to Forge
as a server environment variable. In Forge:

- Site → **Environment** — Forge exposes these to the deploy script's shell.
  Add `SMOKE_DISPATCH_TOKEN=ghp_xxx` and `SMOKE_BASE_URL=https://your-site.com`.

## 2. Append to the deploy script

Site → **Deploy Script**, at the very bottom (after `php artisan`/Craft steps):

```bash
# Kick off external smoke tests — only reached if the deploy above succeeded.
curl -sS -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $SMOKE_DISPATCH_TOKEN" \
  https://api.github.com/repos/YOUR_ORG/craftquest-smoke-suite/dispatches \
  -d "{\"event_type\":\"site-deployed\",\"client_payload\":{\"base_url\":\"$SMOKE_BASE_URL\"}}"
```

Because Forge halts the deploy script on the first failing command, the curl is
only reached when the deploy itself succeeded.

## 3. Verify

Push to your deploy branch (or click **Deploy Now**). Check the repo's Actions
tab for the **Smoke — on deploy** run. If nothing happens, run the curl inside
a Forge **Command** to confirm the token and repo path resolve to a `204`.
