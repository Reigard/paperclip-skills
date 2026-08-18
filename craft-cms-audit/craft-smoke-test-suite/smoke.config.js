/**
 * smoke.config.js - Dynamic CraftQuest Smoke Test Configuration
 */

const fs = require('fs');
const path = require('path');

// 0. Auto-load .env file if present in the suite folder
try {
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
      }
    }
  }
} catch (e) {}

// 1. Dynamic Base URL and Site Name — always set SMOKE_BASE_URL for real runs
const baseUrl = process.env.SMOKE_BASE_URL || process.env.CRAFT_SITE_URL || 'https://example.com';

function getSiteName(url) {
  if (process.env.SMOKE_SITE_NAME) return process.env.SMOKE_SITE_NAME;
  try {
    return new URL(url).hostname;
  } catch (e) {
    return 'Craft CMS Site';
  }
}

// 2. Dynamic Critical Paths (pass via SMOKE_CRITICAL_PATHS="/,/about,/contact")
const envPaths = process.env.SMOKE_CRITICAL_PATHS;
const criticalPaths = envPaths
  ? envPaths.split(',').map(p => p.trim()).filter(Boolean)
  : ['/', '/about', '/contact'];

// 3. Dynamic Templates Check (pass via SMOKE_TEMPLATES_JSON or auto-generate)
let templates = [];
if (process.env.SMOKE_TEMPLATES_JSON) {
  try {
    templates = JSON.parse(process.env.SMOKE_TEMPLATES_JSON);
  } catch (e) {
    console.warn('Failed to parse SMOKE_TEMPLATES_JSON, falling back to default.');
  }
}

if (!templates || templates.length === 0) {
  templates = [
    { name: 'Homepage', path: '/', expect: ['header', 'footer'] },
  ];
}

module.exports = {
  baseUrl,
  siteName: getSiteName(baseUrl),
  criticalPaths,
  errorText: [
    'Whoops, looks like something went wrong',
    'Fatal error',
    'Uncaught Exception',
    'Twig\\Error',
    'yii\\web\\',
    'SQLSTATE',
    'Call to a member function',
  ],
  templates,
  console: {
    paths: criticalPaths,
    ignore: [
      'favicon.ico',
      'Turnstile has already been rendered',
    ],
  },
  links: {
    paths: criticalPaths,
    checkExternal: false,
    ignore: ['mailto:', 'tel:', '#', 'javascript:'],
  },
  seo: {
    paths: criticalPaths,
    requireCanonical: true,
    requireMetaDescription: true,
    robotsPath: '/robots.txt',
    sitemapPath: '/sitemap.xml',
  },
  forms: process.env.SMOKE_FORMS_JSON ? JSON.parse(process.env.SMOKE_FORMS_JSON) : [],
  cp: {
    loginPath: process.env.SMOKE_CP_LOGIN_PATH || '/admin/login',
    dashboardPath: process.env.SMOKE_CP_DASHBOARD_PATH || '/admin/dashboard',
    username: process.env.SMOKE_CP_USERNAME || null,
    password: process.env.SMOKE_CP_PASSWORD || null,
  },
  timeouts: {
    action: 15000,
    test: 30000,
  },
  retries: process.env.CI ? 1 : 0,
};
