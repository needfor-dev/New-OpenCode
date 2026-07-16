/**
 * Configuration and CLI parser for the site tester.
 */

function parseArgs(argv = process.argv.slice(2)) {
  const cfg = {
    target: null,
    referrer: null,
    runs: 1,
    forever: false,
    interval: 10000,       // ms between runs
    minRefWait: 60000,     // 1 min
    maxRefWait: 120000,    // 2 min
    minTargetWait: 60000,  // 1 min
    maxTargetWait: 270000, // 4.5 min
    minTabs: 2,
    maxTabs: 7,
    fixedInstances: null,
    confirmOwned: false,
    headless: false,
    debug: false,
    screenshot: false,
    proxyMode: false,
    proxyFile: 'proxies.txt',
    uaFile: 'uas.txt',
    proxyRotation: true,
    oneBrowserPerTab: false,
    disableImages: false,
    extraPuppeteerArgs: [],
  };

  for (const a of argv) {
    if (!a.startsWith('--')) {
      if (!cfg.target) cfg.target = a;
      else if (!cfg.referrer) cfg.referrer = a;
      continue;
    }

    if (a.startsWith('--runs=')) cfg.runs = intArg(a, 1);
    else if (a === '--forever') cfg.forever = true;
    else if (a.startsWith('--interval=')) cfg.interval = intArg(a, 10000);
    else if (a.startsWith('--min-ref-wait=')) cfg.minRefWait = intArg(a, 60000);
    else if (a.startsWith('--max-ref-wait=')) cfg.maxRefWait = intArg(a, 120000);
    else if (a.startsWith('--min-target-wait=')) cfg.minTargetWait = intArg(a, 60000);
    else if (a.startsWith('--max-target-wait=')) cfg.maxTargetWait = intArg(a, 270000);
    else if (a.startsWith('--min-tabs=')) cfg.minTabs = intArg(a, 2);
    else if (a.startsWith('--max-tabs=')) cfg.maxTabs = intArg(a, 7);
    else if (a.startsWith('--fixed-instances=')) cfg.fixedInstances = intArg(a, 1);
    else if (a === '--confirm-owned') cfg.confirmOwned = true;
    else if (a === '--headless') cfg.headless = true;
    else if (a === '--debug') cfg.debug = true;
    else if (a === '--screenshot') cfg.screenshot = true;
    else if (a === '--proxy') cfg.proxyMode = true;
    else if (a.startsWith('--proxy-file=')) cfg.proxyFile = a.split('=')[1];
    else if (a.startsWith('--ua-file=')) cfg.uaFile = a.split('=')[1];
    else if (a === '--no-proxy-rotate') cfg.proxyRotation = false;
    else if (a === '--one-browser-per-tab') cfg.oneBrowserPerTab = true;
    else if (a === '--disable-images') cfg.disableImages = true;
    else if (a.startsWith('--puppeteer-arg=')) cfg.extraPuppeteerArgs.push(a.split('=').slice(1).join('='));
  }

  // Sanity checks
  cfg.maxRefWait = Math.max(cfg.minRefWait, cfg.maxRefWait);
  cfg.maxTargetWait = Math.max(cfg.minTargetWait, cfg.maxTargetWait);
  cfg.maxTabs = Math.max(cfg.minTabs, cfg.maxTabs);

  // Per-tab proxies require a browser per tab on plain Puppeteer.
  if (cfg.proxyMode && cfg.proxyRotation) cfg.oneBrowserPerTab = true;

  return cfg;
}

function intArg(str, fallback) {
  const v = parseInt(str.split('=')[1], 10);
  return Number.isFinite(v) ? Math.max(0, v) : fallback;
}

function usage() {
  return `Usage: node testbot.js <target_url> <referrer_url> [options] --confirm-owned

Options:
  --runs=N                    Number of runs (default: 1)
  --forever                   Run forever until interrupted
  --interval=MS               Delay between runs in ms (default: 10000)
  --min-ref-wait=MS           Min wait on referrer page (default: 60000)
  --max-ref-wait=MS           Max wait on referrer page (default: 120000)
  --min-target-wait=MS        Min wait on target pages (default: 60000)
  --max-target-wait=MS        Max wait on target pages (default: 270000)
  --min-tabs=N                Min tabs per run (default: 2)
  --max-tabs=N                Max tabs per run (default: 7)
  --fixed-instances=N         Force an exact tab count
  --headless                  Run in headless mode
  --debug                     Print verbose debug info
  --screenshot                Save a screenshot for each tab
  --proxy                     Enable proxy mode (reads proxies.txt)
  --proxy-file=FILE           Use a different proxy list file
  --no-proxy-rotate           Reuse the same proxy for all tabs
  --one-browser-per-tab       Launch a separate browser for each tab
  --disable-images            Block images to save bandwidth
  --ua-file=FILE              Use a custom user-agent list
  --puppeteer-arg=ARG         Pass an extra arg to Chromium (repeatable)
`;
}

module.exports = { parseArgs, usage };
