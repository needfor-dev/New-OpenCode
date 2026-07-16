module.exports = {
  rand,
  randFloat,
  sleep,
  pick,
  shuffle,
  chance,
  gaussianRandom,
  clamp,
};

/**
 * Random integer in [min, max] (inclusive).
 */
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Random float in [min, max].
 */
function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Promise-based sleep.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pick a random item from an array.
 */
function pick(arr) {
  if (!arr || !arr.length) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Shuffle array in place (Fisher-Yates).
 */
function shuffle(arr) {
  if (!arr) return arr;
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Return true with probability p (0..1).
 */
function chance(p) {
  return Math.random() < p;
}

/**
 * Approximate gaussian random value using Box-Muller.
 */
function gaussianRandom(mean = 0, std = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * std;
}

/**
 * Clamp value between min and max.
 */
function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}
