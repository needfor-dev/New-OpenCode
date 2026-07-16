const fs = require('fs');
const { pick, shuffle } = require('./utils');

/**
 * Parses a proxy string into normalized parts.
 * Supported formats:
 *   host:port
 *   http://host:port
 *   http://user:pass@host:port
 *   socks5://host:port
 *   socks5://user:pass@host:port
 */
function parseProxyString(proxyStr) {
  if (!proxyStr) return null;
  const original = proxyStr.trim();
  let url = original;
  if (!/^https?:\/\//.test(url) && !/^socks5?:\/\//.test(url)) {
    url = 'http://' + url;
  }
  let parsed;
  try { parsed = new URL(url); } catch { return null; }

  const protocol = parsed.protocol.replace(':', '') === 'socks5' ? 'socks5' : 'http';
  const host = parsed.hostname;
  const port = parsed.port || (protocol === 'socks5' ? 1080 : 80);
  const username = parsed.username || null;
  const password = parsed.password || null;

  return { original, protocol, host, port, username, password, url: `${protocol}://${host}:${port}` };
}

class ProxyManager {
  constructor(file, rotation = true) {
    this.rotation = rotation;
    this.proxies = [];
    if (file && fs.existsSync(file)) {
      this.proxies = fs.readFileSync(file, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
        .map(parseProxyString)
        .filter(Boolean);
    }
    // Add a default list if none supplied.
    if (!this.proxies.length) {
      // Rotating public proxies rarely work; keep this empty so the user supplies their own.
    }
    if (this.rotation) {
      shuffle(this.proxies);
    }
    this.index = 0;
  }

  hasProxies() {
    return this.proxies.length > 0;
  }

  getProxy() {
    if (!this.proxies.length) return null;
    if (this.rotation) {
      const p = this.proxies[this.index % this.proxies.length];
      this.index++;
      return p;
    }
    return pick(this.proxies);
  }

  getPuppeteerArgs(proxy) {
    const args = [];
    if (proxy) {
      args.push(`--proxy-server=${proxy.url}`);
    }
    return args;
  }

  getAuth(proxy) {
    if (!proxy || (!proxy.username && !proxy.password)) return null;
    return { username: proxy.username || '', password: proxy.password || '' };
  }
}

module.exports = { ProxyManager, parseProxyString };
