#!/usr/bin/env node
/**
 * ci/notify.js
 * Posts a smoke-run result to Slack. Called by `npm run notify -- --status failure`
 * from the GitHub Actions workflows. Reads results.json (Playwright JSON reporter)
 * for a short summary, and the webhook URL from smoke.config.js / env.
 *
 * Zero dependencies — uses the built-in fetch (Node 20+).
 */
const fs = require('fs');
const path = require('path');
const smoke = require('../smoke.config');

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function summarize() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'results.json'), 'utf8');
    const data = JSON.parse(raw);
    const stats = data.stats || {};
    return {
      passed: stats.expected ?? 0,
      failed: stats.unexpected ?? 0,
      flaky: stats.flaky ?? 0,
      skipped: stats.skipped ?? 0,
    };
  } catch {
    return null;
  }
}

async function main() {
  const status = arg('status', 'failure');
  const webhook = smoke.notifications.slack.webhookUrl;

  if (!webhook) {
    console.log('notify: no Slack webhook configured, skipping.');
    return;
  }
  if (status !== 'failure' && smoke.notifications.slack.notifyOn === 'failure') {
    console.log('notify: notifyOn=failure and status is not failure, skipping.');
    return;
  }

  const s = summarize();
  const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null;

  const emoji = status === 'failure' ? ':red_circle:' : ':large_green_circle:';
  const lines = [
    `${emoji} *Smoke suite ${status}* — ${smoke.siteName}`,
    `URL: ${smoke.baseUrl}`,
  ];
  if (s) lines.push(`Passed: ${s.passed} · Failed: ${s.failed} · Flaky: ${s.flaky} · Skipped: ${s.skipped}`);
  if (runUrl) lines.push(`<${runUrl}|View run>`);

  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: lines.join('\n') }),
  });

  if (!res.ok) {
    console.error(`notify: Slack returned ${res.status}`);
    process.exit(1);
  }
  console.log('notify: sent.');
}

main().catch((err) => {
  console.error('notify: error', err);
  process.exit(1);
});
