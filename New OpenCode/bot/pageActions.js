const { rand, sleep } = require('./utils');
const { humanClick, humanScroll, humanMicroActions, humanHover, humanTextSelection } = require('./humanActions');

async function gotoReferrer(page, referrerUrl, cfg) {
  await page.goto(referrerUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((err) => {
    if (cfg.debug) console.warn(`referrer goto failed: ${err && err.message}`);
  });
}

async function waitOnReferrer(page, cfg) {
  const wait = rand(cfg.minRefWait, cfg.maxRefWait);
  if (cfg.debug) console.log(`  referrer wait ~${Math.round(wait / 1000)}s`);
  await humanMicroActions(page, wait, { debug: cfg.debug });
}

/**
 * Try to click a link from the referrer that leads to the target domain.
 * Falls back to generic shorteners or text matches, otherwise returns false.
 */
async function clickLinkToTarget(page, targetHost, cfg) {
  await sleep(rand(800, 2500));

  const anchors = await page.$$('a[href]').catch(() => []);
  const candidates = [];
  const shorteners = ['t.co', 'bit.ly', 'tinyurl', 'short.link', 'ow.ly'];

  for (const a of anchors) {
    const href = await a.evaluate((node) => node.href).catch(() => null);
    if (!href) continue;
    try {
      if (new URL(href).hostname.includes(targetHost)) {
        candidates.push(a);
        continue;
      }
    } catch (_) {}

    const lowerHref = href.toLowerCase();
    const text = await a.evaluate((node) => node.innerText).catch(() => '');
    if (shorteners.some((s) => lowerHref.includes(s)) || text.toLowerCase().includes(targetHost.toLowerCase())) {
      candidates.push(a);
    }
  }

  if (!candidates.length) return false;
  const el = candidates[Math.floor(Math.random() * candidates.length)];

  if (cfg.debug) console.log('  clicking direct/fallback anchor');
  const clicked = await humanClick(page, el, { debug: cfg.debug });
  if (!clicked) return false;

  try {
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  } catch (_) {}
  return true;
}

/**
 * Fallback navigation to the target with a referrer header.
 */
async function fallbackGotoTarget(page, targetUrl, referrerUrl, cfg) {
  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000, referer: referrerUrl });
  } catch (err) {
    if (cfg.debug) console.warn(`fallback goto error: ${err && err.message}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  }
}

async function browseTargetHomepage(page, cfg) {
  await humanScroll(page, { maxBursts: rand(2, 5), maxViewports: 2 });
  const waitHome = rand(cfg.minTargetWait, cfg.maxTargetWait);
  if (cfg.debug) console.log(`  waiting on homepage ~${Math.round(waitHome / 1000)}s`);

  const started = Date.now();
  while (Date.now() - started < waitHome) {
    const remaining = waitHome - (Date.now() - started);
    const action = rand(0, 5);
    try {
      switch (action) {
        case 0: await humanScroll(page, { maxBursts: rand(1, 3), maxViewports: 1 }); break;
        case 1: await humanHover(page, null, { debug: cfg.debug }); break;
        case 2: await humanMicroActions(page, Math.min(rand(2000, 6000), remaining), { debug: cfg.debug }); break;
        case 3: await humanTextSelection(page); break;
        default: await humanPause(page, 500, 1500);
      }
    } catch (_) {}
    await sleep(Math.min(rand(1500, 6000), remaining));
  }
}

/**
 * Find and open a random internal post/article on the target domain.
 */
async function openRandomInternalPostAndWait(page, targetHost, cfg) {
  const href = await page.evaluate((host) => {
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map((a) => a.href)
      .filter((h) => {
        try {
          const u = new URL(h);
          return u.hostname.includes(host) && u.pathname !== '/' && u.pathname !== '' && !h.endsWith('#');
        } catch { return false; }
      });
    const unique = [...new Set(links)];
    if (!unique.length) return null;
    return unique[Math.floor(Math.random() * unique.length)];
  }, targetHost).catch(() => null);

  if (!href) return { opened: false };

  try {
    await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await humanScroll(page, { maxBursts: rand(2, 5), maxViewports: 2 });
    await humanMicroActions(page, rand(cfg.minTargetWait, cfg.maxTargetWait), { debug: cfg.debug });
    return { opened: true, finalUrl: await page.url().catch(() => href) };
  } catch (e) {
    return { opened: false, finalUrl: await page.url().catch(() => null) };
  }
}

module.exports = {
  gotoReferrer,
  waitOnReferrer,
  clickLinkToTarget,
  fallbackGotoTarget,
  browseTargetHomepage,
  openRandomInternalPostAndWait,
};
