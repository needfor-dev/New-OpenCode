const { rand, randFloat, sleep, chance, clamp } = require('./utils');

const OVERSHOOT_PROBABILITY = 0.25;

module.exports = {
  humanMove,
  humanClick,
  humanScroll,
  humanHover,
  humanMicroActions,
  humanTextSelection,
  humanPause,
};

/**
 * Pause for a random duration (ms) and occasionally perform tiny micro-actions.
 */
async function humanPause(page, minMs, maxMs, { debug } = {}) {
  const total = rand(minMs, maxMs);
  if (debug) console.log(`  human pause ~${Math.round(total / 1000)}s`);
  if (!page || total < 500) {
    await sleep(total);
    return;
  }
  const started = Date.now();
  while (Date.now() - started < total) {
    const remaining = total - (Date.now() - started);
    const chunk = Math.min(rand(300, 1200), remaining);
    if (chance(0.15) && chunk > 500) {
      await tinyMicroAction(page);
    }
    await sleep(chunk);
  }
}

async function tinyMicroAction(page) {
  try {
    const viewport = page.viewport() || { width: 1366, height: 768 };
    const action = rand(0, 2);
    if (action === 0) {
      await page.mouse.move(rand(20, viewport.width - 20), rand(20, viewport.height - 20), { steps: rand(3, 8) });
    } else if (action === 1) {
      const dir = chance(0.5) ? 1 : -1;
      const amount = rand(30, 100) * dir;
      await page.evaluate((y) => window.scrollBy(0, y), amount).catch(() => {});
    } else {
      // tiny safe scroll of 1 line
      await page.evaluate(() => window.scrollBy(0, (Math.random() > 0.5 ? 40 : -40))).catch(() => {});
    }
  } catch (_) {}
}

/**
 * Perform a series of random micro actions (cursor moves, tiny scrolls, pauses)
 * for the given duration in milliseconds.
 */
async function humanMicroActions(page, durationMs, { debug } = {}) {
  if (!page) return;
  const started = Date.now();
  while (Date.now() - started < durationMs) {
    const remaining = durationMs - (Date.now() - started);
    const actionType = rand(0, 3);
    try {
      switch (actionType) {
        case 0:
          await randomCursorWander(page, rand(1, 3));
          break;
        case 1:
          await tinyScroll(page);
          break;
        case 2:
          await humanHover(page, null, { debug });
          break;
        default:
          await sleep(rand(500, 2000));
      }
    } catch (_) {}
    await sleep(Math.min(rand(800, 3500), remaining));
  }
}

async function randomCursorWander(page, points = 3) {
  const vp = page.viewport() || { width: 1366, height: 768 };
  for (let i = 0; i < points; i++) {
    const x = rand(0, vp.width);
    const y = rand(0, vp.height);
    await humanMove(page, x, y, { steps: rand(5, 20), speed: randFloat(0.5, 1.5) });
    await sleep(rand(80, 350));
  }
}

async function tinyScroll(page) {
  const direction = chance(0.6) ? 1 : -1;
  const amount = rand(20, 120) * direction;
  await page.evaluate((y) => window.scrollBy(0, y), amount).catch(() => {});
}

/**
 * Move mouse from current position to (x, y) along a slightly curved path.
 */
async function humanMove(page, x, y, { steps = 12, speed = 1.0 } = {}) {
  const start = await page.evaluate(() => {
    try { return { x: window._lastMouseX || 0, y: window._lastMouseY || 0 }; } catch { return { x: 0, y: 0 }; }
  }).catch(() => ({ x: 0, y: 0 }));

  const points = generateCurvePoints(start.x, start.y, x, y, Math.max(8, Math.floor(steps * speed)));
  for (const p of points) {
    await page.mouse.move(Math.round(p.x), Math.round(p.y)).catch(() => {});
    await sleep(rand(8, 35));
  }
  await page.evaluate((xx, yy) => {
    window._lastMouseX = xx;
    window._lastMouseY = yy;
  }, x, y).catch(() => {});
}

/**
 * Generate a curved path from (x1,y1) to (x2,y2) using a quadratic Bezier.
 * If overshoot is enabled, the curve briefly goes past the target.
 */
function generateCurvePoints(x1, y1, x2, y2, steps) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  // random control point offset
  const ox = rand(-Math.abs(x2 - x1) * 0.4, Math.abs(x2 - x1) * 0.4) || rand(-100, 100);
  const oy = rand(-Math.abs(y2 - y1) * 0.6, Math.abs(y2 - y1) * 0.6) || rand(-100, 100);
  const cx = mx + ox;
  const cy = my + oy;

  let endX = x2;
  let endY = y2;
  if (chance(OVERSHOOT_PROBABILITY)) {
    endX += rand(-15, 15);
    endY += rand(-15, 15);
  }

  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * endX;
    const y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * endY;
    pts.push({ x, y });
  }
  return pts;
}

/**
 * Click an element or coordinates in a human-like way: move cursor, hover/pause, then click.
 * selector can be:
 *   - CSS selector string
 *   - Puppeteer ElementHandle
 *   - plain object { x, y }
 */
async function humanClick(page, selector, { debug } = {}) {
  let x, y;
  if (selector && typeof selector === 'object' && typeof selector.x === 'number' && typeof selector.y === 'number') {
    x = selector.x;
    y = selector.y;
  } else {
    let el;
    if (typeof selector === 'string') {
      try { el = await page.$(selector); } catch (_) { return false; }
    } else {
      el = selector;
    }
    if (!el) {
      if (debug) console.log('  humanClick: element not found', selector);
      return false;
    }
    // Bring element into view so the click actually lands on it.
    if (typeof el.evaluate === 'function') {
      try {
        await el.evaluate((node) => node.scrollIntoView({ behavior: 'instant', block: 'center' }));
        await sleep(rand(150, 350));
      } catch (_) {}
    }
    const box = await el.boundingBox().catch(() => null);
    if (!box) return false;
    const margin = Math.min(4, Math.floor(box.width / 4), Math.floor(box.height / 4));
    x = clamp(rand(box.x + margin, box.x + box.width - margin), box.x + 1, box.x + box.width - 1);
    y = clamp(rand(box.y + margin, box.y + box.height - margin), box.y + 1, box.y + box.height - 1);
  }

  await humanMove(page, x, y, { steps: rand(8, 25), speed: randFloat(0.7, 1.3) });
  await sleep(rand(80, 450));
  await page.mouse.down().catch(() => {});
  await sleep(rand(40, 180));
  await page.mouse.up().catch(() => {});
  await sleep(rand(120, 500));
  return true;
}

/**
 * Hover over a random element (or the provided selector) to mimic reading.
 */
async function humanHover(page, selector = null, { debug } = {}) {
  let el;
  if (typeof selector === 'string' && selector) {
    el = await page.$(selector).catch(() => null);
  }
  if (!el) {
    // Pick a random visible clickable-ish element.
    const selectors = 'a, button, h1, h2, h3, p, li, img, article';
    try {
      const els = await page.$$(selectors);
      if (els.length) {
        const candidate = els[rand(0, Math.min(els.length - 1, 30))];
        const box = await candidate.boundingBox().catch(() => null);
        if (box && box.width > 5 && box.height > 5 && box.y > -50) el = candidate;
      }
    } catch (_) {}
  }
  if (!el) return false;
  const box = await el.boundingBox().catch(() => null);
  if (!box) return false;
  const x = clamp(rand(box.x + 2, box.x + box.width - 2), box.x, box.x + box.width);
  const y = clamp(rand(box.y + 2, box.y + box.height - 2), box.y, box.y + box.height);
  await humanMove(page, x, y, { steps: rand(6, 18) });
  await page.hover(el).catch(() => {});
  await sleep(rand(300, 1500));
  return true;
}

/**
 * Human-like scroll: accelerate then decelerate, with occasional direction
 * changes and pauses. Never scrolls to the very bottom.
 */
async function humanScroll(page, { maxBursts = 5, maxViewports = 2 } = {}) {
  const viewport = page.viewport() || { height: 800 };
  const fullHeight = await page.evaluate(() => {
    try {
      return Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    } catch { return 0; }
  }).catch(() => 0);

  const targetScroll = Math.min(fullHeight, viewport.height * maxViewports * randFloat(0.4, 0.9));
  const bursts = rand(2, maxBursts);
  let scrolled = 0;

  for (let b = 0; b < bursts && scrolled < targetScroll; b++) {
    const remaining = targetScroll - scrolled;
    let step = rand(60, Math.floor(viewport.height / 2));
    if (step > remaining) step = Math.max(30, remaining);

    // Sometimes scroll up a bit to look more natural.
    if (chance(0.15) && b > 0) {
      await smoothScrollBy(page, -rand(30, 120), rand(4, 10));
      await sleep(rand(300, 900));
    }

    const times = rand(1, 4);
    for (let t = 0; t < times && scrolled < targetScroll; t++) {
      await smoothScrollBy(page, step, rand(3, 12));
      scrolled += step;
      await sleep(rand(400, 1800));
    }
    await sleep(rand(600, 2500));
  }
}

async function smoothScrollBy(page, amount, steps) {
  const stepAmount = Math.round(amount / steps);
  let done = 0;
  for (let i = 0; i < steps; i++) {
    const remaining = amount - done;
    const current = Math.abs(remaining) < Math.abs(stepAmount) ? remaining : stepAmount;
    await page.evaluate((y) => window.scrollBy(0, y), current).catch(() => {});
    done += current;
    await sleep(rand(12, 50));
  }
}

/**
 * Randomly select a small chunk of visible text.
 */
async function humanTextSelection(page) {
  try {
    const para = await page.$('p, article, section');
    if (!para) return;
    const box = await para.boundingBox().catch(() => null);
    if (!box) return;
    const startX = box.x + rand(5, Math.max(10, box.width - 10));
    const startY = box.y + rand(5, Math.max(10, box.height - 10));
    const endX = clamp(startX + rand(-120, 120), box.x + 2, box.x + box.width - 2);
    const endY = clamp(startY + rand(-40, 40), box.y + 2, box.y + box.height - 2);
    await humanMove(page, startX, startY, { steps: rand(6, 14) });
    await page.mouse.down().catch(() => {});
    await sleep(rand(60, 200));
    await humanMove(page, endX, endY, { steps: rand(6, 20) });
    await page.mouse.up().catch(() => {});
    await sleep(rand(200, 800));
  } catch (_) {}
}
