const fs = require("fs");
const path = require("path");
const { FLOWSTACK_LOGS_DIR } = require("./flowstack_paths");

const LEDGER_FILE = path.join(FLOWSTACK_LOGS_DIR, "event_ledger.json");

function ensureLedger() {
  const dir = path.dirname(LEDGER_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(LEDGER_FILE)) {
    fs.writeFileSync(LEDGER_FILE, JSON.stringify({ events: [] }, null, 2), "utf8");
  }
}

function loadLedger() {
  ensureLedger();
  try {
    return JSON.parse(fs.readFileSync(LEDGER_FILE, "utf8"));
  } catch {
    return { events: [] };
  }
}

function saveLedger(data) {
  ensureLedger();
  fs.writeFileSync(LEDGER_FILE, JSON.stringify(data, null, 2), "utf8");
}

function appendEvent(event) {
  const ledger = loadLedger();
  ledger.events.push({
    ts: new Date().toISOString(),
    ...event
  });
  if (ledger.events.length > 500) {
    ledger.events = ledger.events.slice(-500);
  }
  saveLedger(ledger);
  return ledger;
}

module.exports = {
  LEDGER_FILE,
  loadLedger,
  saveLedger,
  appendEvent
};
