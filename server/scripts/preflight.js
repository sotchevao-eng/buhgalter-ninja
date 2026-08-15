'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SERVER_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');
const EXPECTED_VERSION = '0.9.2';
const SECRET_NAMES = ['VK_APP_SECRET', 'SESSION_SECRET', 'DATABASE_URL'];

const FRONTEND_FILES = [
  'index.html',
  'privacy.html',
  'terms.html',
  'css/style.css',
  'js/config.js',
  'js/runtime-config.js',
  'js/storage.js',
  'js/playerData.js',
  'js/api.js',
  'js/analytics.js',
  'js/leaderboard.js',
  'js/vk.js',
  'js/vendor/vk-bridge.min.js',
  'js/audio.js',
  'js/sprites.js',
  'js/player.js',
  'js/objects.js',
  'js/achievements.js',
  'js/daily.js',
  'js/sync.js',
  'js/rewards.js',
  'js/events.js',
  'js/resultCard.js',
  'js/ui.js',
  'js/game.js'
];

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function exists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch (err) {
    return false;
  }
}

function parseEnvFile(filePath) {
  const out = {};
  if (!exists(filePath)) return out;
  const lines = read(filePath).split(/\r?\n/);
  lines.forEach(function (line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.charAt(0) === '#') return;
    const eq = trimmed.indexOf('=');
    if (eq < 1) return;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    out[key] = value;
  });
  return out;
}

function statusOf(value) {
  return value ? 'SET' : 'MISSING';
}

function scanSecrets(dir) {
  const hits = [];
  const names = ['index.html', 'privacy.html', 'terms.html'];
  names.forEach(function (name) {
    scanFile(path.join(dir, name), hits);
  });
  scanDir(path.join(dir, 'js'), hits);
  scanDir(path.join(dir, 'css'), hits);
  return hits;
}

function scanDir(dir, hits) {
  if (!exists(dir)) return;
  fs.readdirSync(dir).forEach(function (name) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      scanDir(full, hits);
      return;
    }
    if (!/\.(js|css|html)$/i.test(name)) return;
    scanFile(full, hits);
  });
}

function scanFile(filePath, hits) {
  if (!exists(filePath)) return;
  const text = read(filePath);
  SECRET_NAMES.forEach(function (name) {
    const re = new RegExp(name + '\\s*[:=]\\s*[\'"]?([^\\s\'"]+)');
    const match = text.match(re);
    if (!match) return;
    const value = String(match[1] || '').replace(/['",;]+$/, '');
    if (!value || value === 'undefined' || /secret|example|placeholder/i.test(value)) return;
    if (/не вписывайте|не храните|только на сервере/i.test(text)) return;
    hits.push(path.relative(PROJECT_ROOT, filePath) + ':' + name);
  });
}

function checkCacheBust(html, version) {
  const re = /\?v=([0-9.]+)/g;
  let match;
  const bad = [];
  while ((match = re.exec(html))) {
    if (match[1] !== version) bad.push(match[1]);
  }
  return bad;
}

const lines = [];
function line(text) {
  lines.push(text);
}

line('Accountant Ninja Production Preflight');
line('');

const configJs = read(path.join(PROJECT_ROOT, 'js', 'config.js'));
const versionMatch = configJs.match(/const APP_VERSION = '([^']+)'/);
const appVersion = versionMatch ? versionMatch[1] : '';
const debugOn = /const DEBUG = true/.test(configJs);
const playtestOn = /const PLAYTEST_MODE = true/.test(configJs);
const storageVersion = (configJs.match(/const STORAGE_VERSION = (\d+)/) || [])[1] || '';
const mockNull = /mockVKUser:\s*null/.test(configJs);

line('APP_VERSION: ' + (appVersion === EXPECTED_VERSION ? 'PASS (' + appVersion + ')' : 'FAIL (' + (appVersion || 'missing') + ')'));
line('DEBUG: ' + (debugOn ? 'FAIL (true)' : 'PASS (false)'));
line('PLAYTEST_MODE: ' + (playtestOn ? 'FAIL (true)' : 'PASS (false)'));
line('mockVKUser: ' + (mockNull ? 'PASS (null)' : 'FAIL (not disabled)'));
line('STORAGE_VERSION: ' + (storageVersion === '2' ? 'PASS (2, no bump)' : 'WARN (' + storageVersion + ')'));

const indexHtml = read(path.join(PROJECT_ROOT, 'index.html'));
const cacheBad = checkCacheBust(indexHtml, EXPECTED_VERSION);
line('Cache bust ?v=' + EXPECTED_VERSION + ': ' + (cacheBad.length ? 'FAIL (' + cacheBad.join(', ') + ')' : 'PASS'));
const headHtml = indexHtml.slice(0, Math.max(0, indexHtml.indexOf('</head>')));
const vkInitEarly = headHtml.indexOf('VKWebAppInit') >= 0 && headHtml.indexOf('vk-bridge.min.js') >= 0;
line('VKWebAppInit in <head>: ' + (vkInitEarly ? 'PASS' : 'FAIL'));

const runtime = read(path.join(PROJECT_ROOT, 'js', 'runtime-config.js'));
const publicEmpty =
  /apiBaseUrl:\s*''/.test(runtime) &&
  /vkAppId:\s*''/.test(runtime) &&
  /communityUrl:\s*''/.test(runtime) &&
  /appLaunchUrl:\s*''/.test(runtime);
line('Public runtime placeholders: ' + (publicEmpty ? 'PASS (empty, not invented)' : 'WARN (some public values are filled)'));

let missingFiles = [];
FRONTEND_FILES.forEach(function (rel) {
  if (!exists(path.join(PROJECT_ROOT, rel))) missingFiles.push(rel);
});
line('Frontend files: ' + (missingFiles.length ? 'FAIL missing ' + missingFiles.join(', ') : 'PASS'));
line('Frontend build: SKIP (static HTML/CSS/JS, bundler not used)');

const htmlRefs = [];
const srcRe = /(?:src|href)="\.\/([^"?]+)/g;
let srcMatch;
while ((srcMatch = srcRe.exec(indexHtml))) {
  htmlRefs.push(srcMatch[1].replace(/\//g, path.sep));
}
const missingRefs = htmlRefs.filter(function (rel) {
  return !exists(path.join(PROJECT_ROOT, rel));
});
line('index.html paths: ' + (missingRefs.length ? 'FAIL ' + missingRefs.join(', ') : 'PASS'));

const secretHits = scanSecrets(PROJECT_ROOT);
line('Frontend secrets scan: ' + (secretHits.length ? 'FAIL ' + secretHits.join(', ') : 'PASS'));

const pkg = JSON.parse(read(path.join(SERVER_ROOT, 'package.json')));
line('Backend package version: ' + (pkg.version === EXPECTED_VERSION ? 'PASS (' + pkg.version + ')' : 'FAIL (' + pkg.version + ')'));

const envPath = path.join(SERVER_ROOT, '.env');
const envExample = path.join(SERVER_ROOT, '.env.example');
line('.env.example: ' + (exists(envExample) ? 'PASS' : 'FAIL'));
const env = parseEnvFile(envPath);
const nodeEnv = process.env.NODE_ENV || env.NODE_ENV || 'development';
const production = nodeEnv === 'production';
line('NODE_ENV: ' + nodeEnv + (exists(envPath) ? '' : ' (no server/.env file)'));

function envStatus(name) {
  return statusOf(process.env[name] || env[name]);
}

line('DATABASE_URL: ' + envStatus('DATABASE_URL'));
line('CORS_ORIGIN: ' + envStatus('CORS_ORIGIN'));
line('SESSION_SECRET: ' + envStatus('SESSION_SECRET'));
line('FRONTEND_URL: ' + envStatus('FRONTEND_URL'));
line('API_PUBLIC_URL: ' + envStatus('API_PUBLIC_URL'));
line('VK_APP_ID: ' + envStatus('VK_APP_ID'));
line('VK_GROUP_ID: ' + envStatus('VK_GROUP_ID'));
line('VK_APP_SECRET: ' + envStatus('VK_APP_SECRET'));
line('VK_COMMUNITY_URL: ' + envStatus('VK_COMMUNITY_URL'));

if (!production) {
  line('Local note: empty VK/URL values are allowed; browser Guest/Local mode still works.');
}

const tests = spawnSync(process.execPath, ['--test', './tests/vkSign.test.js', './tests/scoreRules.test.js', './tests/xp.test.js', './tests/vkBridgeHtml.test.js'], {
  cwd: SERVER_ROOT,
  encoding: 'utf8'
});
const testsPass = tests.status === 0;
line('Backend tests: ' + (testsPass ? 'PASS' : 'FAIL'));
if (!testsPass && tests.stderr) {
  line(String(tests.stderr).trim().split(/\r?\n/).slice(-8).join('\n'));
}

const audit = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['audit', '--omit=dev'], {
  cwd: SERVER_ROOT,
  encoding: 'utf8',
  shell: true
});
const auditOut = String(audit.stdout || '') + String(audit.stderr || '');
const auditPass = /found 0 vulnerabilities/i.test(auditOut) || audit.status === 0 && /0 vulnerabilities/i.test(auditOut);
line('npm audit: ' + (auditPass ? 'PASS' : 'WARN (see npm audit)'));

const blockers = [];
if (appVersion !== EXPECTED_VERSION) blockers.push('APP_VERSION');
if (debugOn) blockers.push('DEBUG');
if (playtestOn) blockers.push('PLAYTEST_MODE');
if (!mockNull) blockers.push('mockVKUser');
if (cacheBad.length) blockers.push('cache-bust');
if (!vkInitEarly) blockers.push('vk-init-head');
if (missingFiles.length) blockers.push('frontend-files');
if (missingRefs.length) blockers.push('html-paths');
if (secretHits.length) blockers.push('frontend-secrets');
if (pkg.version !== EXPECTED_VERSION) blockers.push('server-version');
if (!testsPass) blockers.push('backend-tests');
if (production) {
  ['DATABASE_URL', 'CORS_ORIGIN', 'SESSION_SECRET', 'FRONTEND_URL', 'API_PUBLIC_URL', 'VK_APP_ID', 'VK_GROUP_ID', 'VK_APP_SECRET'].forEach(function (name) {
    if (envStatus(name) === 'MISSING') blockers.push(name);
  });
}

const productionReady = blockers.length === 0 &&
  envStatus('VK_APP_ID') === 'SET' &&
  envStatus('FRONTEND_URL') === 'SET' &&
  envStatus('API_PUBLIC_URL') === 'SET' &&
  envStatus('VK_APP_SECRET') === 'SET';

const codeFail = blockers.filter(function (item) {
  return ['APP_VERSION', 'DEBUG', 'PLAYTEST_MODE', 'mockVKUser', 'cache-bust', 'vk-init-head', 'frontend-files', 'html-paths', 'frontend-secrets', 'server-version', 'backend-tests'].indexOf(item) !== -1;
});

line('');
line('Code package: ' + (codeFail.length ? 'FAIL' : 'PASS'));
line('PRODUCTION READY: ' + (productionReady ? 'YES' : 'NO'));
if (!productionReady) {
  line('Reason: VK IDs, production URLs and/or secrets are not filled; physical phone tests are outside this script.');
}

process.stdout.write(lines.join('\n') + '\n');
process.exit(codeFail.length ? 1 : 0);
