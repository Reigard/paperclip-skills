# Trigger: Any bash deploy → GitHub Actions

If your deploy is "SSH in and run a script", or any platform not covered by the
others, this is all you need. The pattern is identical everywhere: after a
successful deploy, POST a `repository_dispatch` to GitHub.

## The one-liner

```bash
curl -sS -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $SMOKE_DISPATCH_TOKEN" \
  https://api.github.com/repos/YOUR_ORG/craftquest-smoke-suite/dispatches \
  -d '{"event_type":"site-deployed","client_payload":{"base_url":"https://your-live-site.com"}}'
```

- `SMOKE_DISPATCH_TOKEN` — a GitHub token with `repo` scope (classic) or
  Contents+Actions read/write (fine-grained). See
  [servd.md](./servd.md) step 1.
- A successful dispatch returns HTTP **204** with no body.

## Fail fast

Put this at the **end** of your deploy script and use `set -e` so it is only
reached when every prior step succeeded:

```bash
#!/usr/bin/env bash
set -euo pipefail

# ... your existing deploy steps (composer install, craft up, etc.) ...

# Only reached if everything above succeeded:
curl -sS -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $SMOKE_DISPATCH_TOKEN" \
  https://api.github.com/repos/YOUR_ORG/craftquest-smoke-suite/dispatches \
  -d '{"event_type":"site-deployed","client_payload":{"base_url":"https://your-live-site.com"}}'
```

## Passing the environment URL dynamically

If one script deploys multiple environments, pass the URL through:

```bash
BASE_URL="$1"   # e.g. ./deploy.sh https://staging.example.com
curl -sS -X POST \
  -H "Authorization: Bearer $SMOKE_DISPATCH_TOKEN" \
  https://api.github.com/repos/YOUR_ORG/craftquest-smoke-suite/dispatches \
  -d "{\"event_type\":\"site-deployed\",\"client_payload\":{\"base_url\":\"$BASE_URL\"}}"
```

The workflow reads `client_payload.base_url` into `SMOKE_BASE_URL`, overriding
`smoke.config.js`.

## Debugging a dispatch that "does nothing"

1. Run the curl by hand. Anything other than `204` is your problem — the body
   of a `401`/`422` explains it.
2. Confirm `event_type` matches `types: [site-deployed]` in
   `smoke-on-deploy.yml`.
3. `repository_dispatch` only triggers workflows on the repo's **default
   branch**. Make sure the workflow file is merged to `main`.
