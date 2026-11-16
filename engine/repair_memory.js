const {
  FLOWSTACK_ROOT,
  FLOWSTACK_LOGS_DIR,
  FLOWSTACK_WORKFLOWS_DIR,
  FLOWSTACK_REPORTS_DIR,
  AGENT_ACTIONS_LOG,
  ensureFlowstackDirs,
} = require("./flowstack_paths");

ensureFlowstackDirs();
const fs = require("fs");
const path = require("path");

const MEMORY_FILE = path.join(FLOWSTACK_LOGS_DIR, "repair_memory.json");

function ensureDir() {
  const dir = path.dirname(MEMORY_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function defaultMemory() {
  return {
    seenFailures: {},
    patchesTried: {},
    runs: []
  };
}

function loadMemory() {
  ensureDir();
  if (!fs.existsSync(MEMORY_FILE)) {
    const mem = defaultMemory();
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(mem, null, 2), "utf8");
    return mem;
  }

  try {
    return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
  } catch {
    const mem = defaultMemory();
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(mem, null, 2), "utf8");
    return mem;
  }
}

function saveMemory(memory) {
  ensureDir();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2), "utf8");
}

function makeMemory() {
  return loadMemory();
}

function failureKey(failure) {
  return [
    failure?.type || "UNKNOWN",
    failure?.reason || "none",
    failure?.nodeName || "none"
  ].join("::");
}

function patchKey(proposal) {
  try {
    return JSON.stringify(proposal || {});
  } catch {
    return "unserializable_patch";
  }
}

function rememberFailure(memory, workflowName, failure) {
  const key = `${workflowName}::${failureKey(failure)}`;
  memory.seenFailures[key] = (memory.seenFailures[key] || 0) + 1;
  saveMemory(memory);
  return memory.seenFailures[key];
}

function rememberPatch(memory, workflowName, proposal) {
  const key = `${workflowName}::${patchKey(proposal)}`;
  memory.patchesTried[key] = (memory.patchesTried[key] || 0) + 1;
  saveMemory(memory);
  return memory.patchesTried[key];
}

function hasRepeatedFailure(memory, workflowName, failure, limit = 2) {
  const key = `${workflowName}::${failureKey(failure)}`;
  return (memory.seenFailures[key] || 0) >= limit;
}

function hasRepeatedPatch(memory, workflowName, proposal, limit = 2) {
  const key = `${workflowName}::${patchKey(proposal)}`;
  return (memory.patchesTried[key] || 0) >= limit;
}

function addRun(memory, entry) {
  memory.runs.push({
    ts: new Date().toISOString(),
    ...entry
  });

  if (memory.runs.length > 200) {
    memory.runs = memory.runs.slice(-200);
  }

  saveMemory(memory);
  return memory;
}

module.exports = {
  MEMORY_FILE,
  makeMemory,
  failureKey,
  rememberFailure,
  rememberPatch,
  hasRepeatedFailure,
  hasRepeatedPatch,
  addRun,
  saveMemory,
  loadMemory,
};

