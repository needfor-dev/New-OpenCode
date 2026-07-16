const fs = require('fs');
const path = require('path');

const CSV_FILE = path.join(process.cwd(), 'sessions_log.csv');
const HEADERS = 'timestamp,run,tab,proxy,ua,referrer_clicked,target_final,post_opened,post_final,duration_ms\n';

function ensureCSV() {
  try {
    if (!fs.existsSync(CSV_FILE)) fs.writeFileSync(CSV_FILE, HEADERS);
  } catch (_) {}
}

function appendCSV(row) {
  try {
    ensureCSV();
    const sanitized = row.map((x) => {
      const s = String(x || '').replace(/"/g, '""');
      return `"${s}"`;
    });
    fs.appendFileSync(CSV_FILE, sanitized.join(',') + '\n');
  } catch (_) {}
}

module.exports = { appendCSV, ensureCSV };
