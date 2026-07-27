# Trigger: Buddy → GitHub Actions

Fire the smoke suite from a Buddy pipeline after deployment.

## 1. GitHub token

Create a token as described in [servd.md](./servd.md) (step 1). Add it to Buddy
under **Pipeline → Variables** (or workspace-level) as `SMOKE_DISPATCH_TOKEN`,
marked as encrypted/secret.

## 2. Add a final "Run smoke tests" action

At the end of your deploy pipeline, add a **Run shell command** (Local shell)
action:

```bash
curl -sS -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $SMOKE_DISPATCH_TOKEN" \
  https://api.github.com/repos/YOUR_ORG/craftquest-smoke-suite/dispatches \
  -d '{"event_type":"site-deployed","client_payload":{"base_url":"'"$SMOKE_BASE_URL"'"}}'
```

Set `SMOKE_BASE_URL` as a pipeline variable (e.g. `https://your-live-site.com`)
so the same pipeline can target different environments.

## 3. Run only on success

In the action's **Run** settings, choose **Run this action only if all
previous actions passed** so a failed deploy does not trigger a false smoke run.

## 4. Verify

Trigger the pipeline. The **Smoke — on deploy** workflow should start in
GitHub within a few seconds. A `204` from the curl step means success even
though there is no visible body.
