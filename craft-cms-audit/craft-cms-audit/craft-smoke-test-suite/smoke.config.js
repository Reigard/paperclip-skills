/**
 * Per-run Craft smoke configuration.
 * Site identity must come from process env for this run — never a skill-local .env.
 */
const baseUrl = process.env.SMOKE_BASE_URL || process.env.CRAFT_SITE_URL || '';

if (!baseUrl) {
  throw new Error(
    'SMOKE_BASE_URL is required. This suite is shared across clients; do not use a skill-folder .env.',
  );
}

function getSiteName(url) {
  if (process.env.SMOKE_SITE_NAME) return process.env.SMOKE_SITE_NAME;
  try {
    return new URL(url).hostname;
  } catch (e) {
    return 'Craft CMS Site';
  }
}

const envPaths = process.env.SMOKE_CRITICAL_PATHS;
const criticalPaths = envPaths
  ? envPaths.split(',').map((p) => p.trim()).filter(Boolean)
  : ['/'];

let templates = [];
if (process.env.SMOKE_TEMPLATES_JSON) {
  try {
    templates = JSON.parse(process.env.SMOKE_TEMPLATES_JSON);
  } catch (e) {
    console.warn('Failed to parse SMOKE_TEMPLATES_JSON; skipping template checks.');
  }
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
    enabled: process.env.SMOKE_CHECK_LINKS === '1',
    paths: criticalPaths,
    checkExternal: false,
    ignore: ['mailto:', 'tel:', '#', 'javascript:'],
  },
  seo: {
    enabled: process.env.SMOKE_CHECK_SEO === '1',
    paths: criticalPaths,
    requireCanonical: process.env.SMOKE_SEO_STRICT === '1',
    requireMetaDescription: process.env.SMOKE_SEO_STRICT === '1',
    robotsPath: '/robots.txt',
    sitemapPath: '/sitemap.xml',
  },
  forms: [],
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
