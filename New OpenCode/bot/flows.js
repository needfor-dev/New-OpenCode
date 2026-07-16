const path = require('path');
const { createSession, destroySession } = require('./browserFactory');
const { appendCSV } = require('./logger');
const {
  gotoReferrer,
  waitOnReferrer,
  clickLinkToTarget,
  fallbackGotoTarget,
  browseTargetHomepage,
  openRandomInternalPostAndWait,
} = require('./pageActions');

async function runTabFlow({ puppeteer, profileManager, proxyManager, cfg, run, tabIndex, sharedSession = null }) {
  const started = Date.now();
  let refClicked = false;
  let localSession = null;
  let page, proxy, profile;
  let ownsPage = true;

  try {
    if (sharedSession) {
      // Reuse shared browser (same proxy/profile context as host browser).
      page = await sharedSession.browser.newPage();
      profile = profileManager.getProfile();
      await page.setUserAgent(profile.ua);
      await page.setViewport(profile.vp);
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
      if (cfg.debug) {
        page.on('console', (msg) => console.log(`page[${tabIndex}] console:`, msg.text && msg.text()));
        page.on('pageerror', (e) => console.log(`page[${tabIndex}] error:`, e && e.message));
      }
      proxy = sharedSession.proxy || null;
      ownsPage = true;
    } else {
      localSession = await createSession({ puppeteer, profileManager, proxyManager, cfg, tabIndex });
      page = localSession.page;
      proxy = localSession.proxy;
      profile = localSession.profile;
      ownsPage = false; // session owns the page; destroySession closes it
    }

    // 1) Open referrer.
    await gotoReferrer(page, cfg.referrer, cfg);

    // 2) Wait on referrer with human-like actions.
    await waitOnReferrer(page, cfg);

    // 3) Attempt to click a link to target.
    refClicked = await clickLinkToTarget(page, cfg.targetHost, cfg);

    // 4) Ensure we are on the target domain.
    if (refClicked) {
      try { await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}); } catch (_) {}
    } else {
      await fallbackGotoTarget(page, cfg.target, cfg.referrer, cfg);
    }

    // 5) Browse target homepage.
    await browseTargetHomepage(page, cfg);

    // 6) Open a random internal post/article.
    const postResult = await openRandomInternalPostAndWait(page, cfg.targetHost, cfg);

    // 7) Optional screenshot.
    if (cfg.screenshot) {
      try {
        const shotPath = path.join(process.cwd(), `shot_run${run}_tab${tabIndex}_${Date.now()}.png`);
        await page.screenshot({ path: shotPath, fullPage: false }).catch(() => {});
      } catch (_) {}
    }

    const finalUrl = await page.url().catch(() => cfg.target);
    const duration = Date.now() - started;
    appendCSV([
      new Date().toISOString(),
      run,
      `tab${tabIndex}`,
      proxy ? proxy.url : 'none',
      profile.ua,
      refClicked ? 'yes' : 'no',
      finalUrl,
      postResult.opened ? 'yes' : 'no',
      postResult.finalUrl || '',
      duration,
    ]);

    return { tab: tabIndex, clicked: refClicked, finalUrl, postOpened: postResult.opened, error: null };
  } catch (e) {
    if (cfg.debug) console.error(`tab[${tabIndex}] flow error:`, e && (e.message || e));
    return { tab: tabIndex, clicked: refClicked, finalUrl: null, postOpened: false, error: e && e.message };
  } finally {
    if (sharedSession && page) {
      try { await page.close(); } catch (_) {}
    }
    if (localSession) {
      await destroySession(localSession);
    }
  }
}

module.exports = { runTabFlow };
