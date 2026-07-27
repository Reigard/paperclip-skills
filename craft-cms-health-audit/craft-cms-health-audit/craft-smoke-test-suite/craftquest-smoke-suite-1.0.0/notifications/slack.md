# Slack notifications

Get pinged in Slack the moment a smoke run fails. This is the setup from the
course, condensed.

> **Prerequisite:** you need permission to create an app in your Slack
> workspace. If your workspace restricts this, ask a workspace admin to either
> grant it or create the webhook and hand you the URL. Incoming Webhooks are a
> free, built-in Slack feature — there is nothing to install or pay for.

## 1. Create an Incoming Webhook

1. Go to <https://api.slack.com/apps> → **Create New App** → **From scratch**.
2. Name it (e.g. "Smoke Suite") and pick your workspace.
3. In the app, open **Incoming Webhooks** → toggle **On**.
4. Click **Add New Webhook to Workspace**, choose the channel (e.g.
   `#deploys`), and **Allow**.
5. Copy the webhook URL. It looks like
   `https://hooks.slack.com/services/T000/B000/XXXX`.

## 2. Store it as a secret

**Never commit the webhook.** Add it to GitHub:

- Repo → **Settings → Secrets and variables → Actions → New repository secret**
- Name: `SMOKE_SLACK_WEBHOOK`
- Value: the webhook URL

Or from the command line (the value is entered interactively, so it never
lands in your shell history):

```bash
gh secret set SMOKE_SLACK_WEBHOOK
```

The workflows already reference `secrets.SMOKE_SLACK_WEBHOOK`, and
`smoke.config.js` reads `process.env.SMOKE_SLACK_WEBHOOK`.

## 3. Choose when to notify

In `smoke.config.js`:

```js
notifications: {
  slack: {
    webhookUrl: process.env.SMOKE_SLACK_WEBHOOK || null,
    notifyOn: 'failure', // 'failure' (default) or 'always'
  },
},
```

- `'failure'` — only ping when the suite goes red (recommended).
- `'always'` — ping on every run, green or red (useful while dialing in).

## 4. Test it locally

```bash
SMOKE_SLACK_WEBHOOK='https://hooks.slack.com/services/...' \
  node ci/notify.js --status failure
```

You should see a message land in your channel. If not:

- A `403`/`404` from Slack means the webhook is wrong or was revoked.
- `notify: no Slack webhook configured, skipping.` means the env var was empty.

## What the message looks like

```
🔴 Smoke suite failure — My CraftQuest Site
URL: https://your-live-site.com
Passed: 6 · Failed: 1 · Flaky: 0 · Skipped: 2
View run
```

The summary line comes from Playwright's `results.json`; the **View run** link
points at the GitHub Actions run when available.
