const fs = require("fs");
const path = require("path");

const { FLOWSTACK_HOME, FLOWSTACK_ROOT } = require("./config");

// All runtime files (logs, reports, workflows, ledger) live under FLOWSTACK_HOME.
const FLOWSTACK_LOGS_DIR = path.join(FLOWSTACK_ROOT, "logs");
const FLOWSTACK_WORKFLOWS_DIR = path.join(FLOWSTACK_ROOT, "workflows");
const FLOWSTACK_REPORTS_DIR = path.join(FLOWSTACK_ROOT, "reports");
const AGENT_ACTIONS_LOG = path.join(FLOWSTACK_LOGS_DIR, "agent_actions.log");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function ensureFlowstackDirs() {
  ensureDir(FLOWSTACK_ROOT);
  ensureDir(FLOWSTACK_LOGS_DIR);
  ensureDir(FLOWSTACK_WORKFLOWS_DIR);
  ensureDir(FLOWSTACK_REPORTS_DIR);
}

module.exports = {
  FLOWSTACK_HOME,
  FLOWSTACK_ROOT,
  FLOWSTACK_LOGS_DIR,
  FLOWSTACK_WORKFLOWS_DIR,
  FLOWSTACK_REPORTS_DIR,
  AGENT_ACTIONS_LOG,
  ensureDir,
  ensureFlowstackDirs,
};
