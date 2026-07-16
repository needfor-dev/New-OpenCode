const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Create a single browser + page configured for a single session.
 * When proxy is supplied it is applied to the whole browser.
 */
async function createSession({ puppeteer, profileManager, proxyManager, cfg, tabIndex }) {
  const profile = profileManager.getProfile();
  const proxy = cfg.proxyMode ? proxyManager.getProxy() : null;

  const profileDir = path.join(os.tmpdir(), `testbot_profile_${Date.now()}_${tabIndex}_${randHex(6)}`);
  fs.mkdirSync(profileDir, { recursive: true });

  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
  ];

  if (cfg.disableImages) {
    args.push('--blink-settings=imagesEnabled=false');
  }

  if (proxy) {
    args.push(`--proxy-server=${proxy.url}`);
  }

  if (cfg.extraPuppeteerArgs && cfg.extraPuppeteerArgs.length) {
    args.push(...cfg.extraPuppeteerArgs);
  }

  const browser = await puppeteer.launch({
    headless: !!cfg.headless,
    userDataDir: profileDir,
    defaultViewport: null,
    args,
  });

  const page = await browser.newPage();
  await page.setUserAgent(profile.ua);
  await page.setViewport(profile.vp);
  await page.setExtraHTTPHeaders({
    'Accept-Language': pickLanguage(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Upgrade-Insecure-Requests': '1',
  });

  if (proxy && proxy.username) {
    await page.authenticate({ username: proxy.username, password: proxy.password || '' });
  }

  // Some sites check screen dimensions through JS APIs.
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    try {
      window.chrome = window.chrome || {};
      window.chrome.runtime = {};
    } catch (_) {}
  });

  if (cfg.debug) {
    page.on('console', (msg) => console.log(`page[${tabIndex}] console:`, msg.text && msg.text()));
    page.on('pageerror', (e) => console.log(`page[${tabIndex}] error:`, e && e.message));
    browser.on('targetcreated', (t) => console.log(`browser[${tabIndex}] target created:`, t.url()));
  }

  return { browser, page, profileDir, proxy, profile };
}

function pickLanguage() {
  const langs = ['en-US,en;q=0.9', 'en-GB,en;q=0.9', 'en;q=0.9'];
  return langs[Math.floor(Math.random() * langs.length)];
}

function randHex(len) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

/**
 * Close a browser and remove its temporary profile directory.
 */
async function destroySession({ browser, profileDir }) {
  try { await browser.close(); } catch (_) {}
  try {
    if (fs.existsSync(profileDir)) {
      fs.rmSync(profileDir, { recursive: true, force: true });
    }
  } catch (_) {}
}

module.exports = { createSession, destroySession };
