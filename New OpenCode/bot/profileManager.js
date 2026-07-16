const fs = require('fs');
const path = require('path');
const { pick } = require('./utils');

const DEFAULT_UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.0.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
];

const DEFAULT_VIEWPORTS = [
  { width: 1366, height: 768, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  { width: 1440, height: 900, deviceScaleFactor: 2, isMobile: false, hasTouch: false },
  { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  { width: 1536, height: 864, deviceScaleFactor: 1.25, isMobile: false, hasTouch: false },
  { width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true },
  { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  { width: 1024, height: 768, deviceScaleFactor: 2, isMobile: false, hasTouch: true },
];

class ProfileManager {
  constructor(uaFile) {
    this.uas = DEFAULT_UAS;
    this.viewports = DEFAULT_VIEWPORTS;
    if (uaFile && fs.existsSync(uaFile)) {
      const lines = fs.readFileSync(uaFile, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length) this.uas = lines;
    }
  }

  getProfile() {
    const ua = pick(this.uas);
    const vp = pick(this.viewports);
    return { ua, vp };
  }

  getUaList() {
    return this.uas;
  }
}

module.exports = { ProfileManager };
