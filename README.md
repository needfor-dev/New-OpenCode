cd "New OpenCode Project" and
npm install


Basic run (no proxies):
node testbot.js https://yourdomain.com https://referrer.com --runs=3 --debug --confirm-owned


With rotating proxies (one browser per tab):
node testbot.js https://yourdomain.com https://referrer.com --proxy --debug --confirm-owned


Headless + disable images + extra Chromium arg:
node testbot.js https://yourdomain.com https://referrer.com --headless --disable-images --puppeteer-arg="--window-size=1366,768" --confirm-owned


Run (replace URLs with yours)
node testbot.js https://yourdomain.com https://referrer.com --runs=5 --interval=30000 --confirm-owned
