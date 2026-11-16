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
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
const SAFE_ROOT = FLOWSTACK_ROOT;
const WORKFLOWS_DIR = FLOWSTACK_WORKFLOWS_DIR;
const LOG_DIR = FLOWSTACK_LOGS_DIR;
const LOG_FILE = AGENT_ACTIONS_LOG;
const N8N_URL = (process.env.N8N_URL || "http://localhost:5678").replace(/\/$/, "");
const N8N_API_KEY = process.env.N8N_API_KEY || "";

for (const dir of [SAFE_ROOT, WORKFLOWS_DIR, LOG_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function ensureApiKey() {
  if (!N8N_API_KEY) throw new Error("Missing N8N_API_KEY environment variable");
}

function logAction(action, data = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    action,
    ...data,
  });
  fs.appendFileSync(LOG_FILE, line + "\n", "utf8");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function safePath(file) {
  const resolved = path.resolve(file);
  if (!resolved.startsWith(path.resolve(SAFE_ROOT))) {
    throw new Error(`Blocked path outside safe workspace: ${resolved}`);
  }
  return resolved;
}

function workflowPathFromName(name) {
  return safePath(path.join(WORKFLOWS_DIR, `${name}.json`));
}

function saveWorkflow(name, workflow) {
  if (!name || !workflow || typeof workflow !== "object") {
    throw new Error("saveWorkflow requires (name, workflow)");
  }
  const file = workflowPathFromName(name);
  if (!workflow.name) workflow.name = name;
  fs.writeFileSync(file, JSON.stringify(workflow, null, 2), "utf8");
  logAction("save_workflow", { file });
  return file;
}

function readSavedWorkflow(nameOrPath) {
  const file = nameOrPath.endsWith(".json") ? safePath(nameOrPath) : workflowPathFromName(nameOrPath);
  if (!fs.existsSync(file)) throw new Error(`Workflow file not found: ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sanitizeWorkflowForCreate(workflow) {
  const copy = JSON.parse(JSON.stringify(workflow));
  delete copy.id;
  delete copy.active;
  delete copy.versionId;
  delete copy.createdAt;
  delete copy.updatedAt;
  delete copy.isArchived;
  delete copy.versionCounter;
  delete copy.triggerCount;
  delete copy.shared;
  delete copy.tags;
  delete copy.activeVersionId;
  delete copy.meta;
  delete copy.pinData;
  delete copy.staticData;
  delete copy.description;
  return {
    name: copy.name,
    nodes: copy.nodes || [],
    connections: copy.connections || {},
    settings: copy.settings || {},
  };
}

function sanitizeWorkflowForUpdate(workflow) {
  return sanitizeWorkflowForCreate(workflow);
}

async function apiFetch(endpoint, options = {}) {
  ensureApiKey();
  const res = await fetch(`${N8N_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-N8N-API-KEY": N8N_API_KEY,
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(`${options.method || "GET"} ${endpoint} failed ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }
  return data;
}

async function listWorkflows(limit = 250) {
  const data = await apiFetch(`/api/v1/workflows?limit=${limit}`, { method: "GET" });
  return Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
}

async function findWorkflowByName(name) {
  const rows = await listWorkflows();
  return rows.find(w => w?.name === name) || null;
}

async function getWorkflow(idOrName) {
  if (!idOrName) throw new Error("getWorkflow requires id or name");

  if (String(idOrName).match(/^[A-Za-z0-9_-]{8,}$/)) {
    return await apiFetch(`/api/v1/workflows/${idOrName}`, { method: "GET" });
  }

  const byName = await findWorkflowByName(String(idOrName));
  if (!byName?.id) throw new Error(`Workflow not found by name: ${idOrName}`);
  return await apiFetch(`/api/v1/workflows/${byName.id}`, { method: "GET" });
}

async function createWorkflow(workflow) {
  const payload = sanitizeWorkflowForCreate(workflow);
  const result = await apiFetch(`/api/v1/workflows`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  logAction("deploy_workflow_create", { workflowName: payload.name, id: result?.id || null });
  return result;
}

async function updateWorkflow(idOrWorkflow, maybeWorkflow) {
  let workflowId;
  let workflow;

  if (typeof idOrWorkflow === "object" && idOrWorkflow) {
    workflowId = idOrWorkflow.id;
    workflow = idOrWorkflow;
  } else {
    workflowId = idOrWorkflow;
    workflow = maybeWorkflow;
  }

  if (!workflowId) throw new Error("updateWorkflow requires workflow id");
  if (!workflow || typeof workflow !== "object") throw new Error("updateWorkflow requires workflow object");

  const payload = sanitizeWorkflowForUpdate(workflow);
  const result = await apiFetch(`/api/v1/workflows/${workflowId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  logAction("deploy_workflow_update", { workflowName: payload.name, id: workflowId });
  return result;
}

async function activateWorkflow(id) {
  try {
    await apiFetch(`/api/v1/workflows/${id}/activate`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    logAction("activate_workflow", { id, mode: "activate_endpoint" });
  } catch (err) {
    logAction("activate_workflow_failed", { id, error: String(err.message || err) });
  }

  for (let i = 0; i < 6; i++) {
    const wf = await getWorkflow(id);
    logAction("activate_workflow_verify", { id, attempt: i + 1, active: !!wf?.active });
    if (wf?.active === true) return wf;
    await sleep(1000);
  }

  throw new Error(`Workflow ${id} did not verify active`);
}

async function deployWorkflow(nameOrPath) {
  const workflow = String(nameOrPath).endsWith(".json")
    ? JSON.parse(fs.readFileSync(safePath(nameOrPath), "utf8"))
    : readSavedWorkflow(String(nameOrPath));

  if (!workflow?.name) throw new Error("deployWorkflow requires workflow.name");

  const existing = await findWorkflowByName(workflow.name);
  let result;

  if (existing?.id) {
    result = await updateWorkflow(existing.id, { ...workflow, id: existing.id });
  } else {
    result = await createWorkflow(workflow);
  }

  const id = result?.id || existing?.id;
  if (!id) throw new Error(`Could not resolve workflow id for ${workflow.name}`);

  await activateWorkflow(id);
  return { id, name: workflow.name, mode: existing ? "updated" : "created" };
}

async function testWebhook(pathName, payload = {}) {
  const clean = String(pathName || "").replace(/^\/+/, "");
  const prodUrl = `${N8N_URL}/webhook/${clean}`;

  const res = await fetch(prodUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  const result = {
    ok: res.ok,
    status: res.status,
    body: data,
    error: res.ok ? null : (typeof data === "string" ? data : JSON.stringify(data)),
  };

  logAction("test_webhook", {
    pathName: clean,
    status: res.status,
    response: typeof data === "string" ? data : JSON.stringify(data),
  });

  return result;
}

async function listExecutions(limit = 20) {
  const data = await apiFetch(`/api/v1/executions?limit=${limit}`, { method: "GET" });
  return Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
}

async function getExecution(id) {
  return await apiFetch(`/api/v1/executions/${id}`, { method: "GET" });
}

async function getLatestExecutionForWorkflow(workflowId) {
  const rows = await listExecutions(20);
  const hit = rows.find(x => String(x?.workflowId || x?.workflowData?.id || "") === String(workflowId));
  if (!hit?.id) return null;

  try {
    return await getExecution(hit.id);
  } catch {
    return hit;
  }
}

module.exports = {
  logAction,
  saveWorkflow,
  readSavedWorkflow,
  deployWorkflow,
  getWorkflow,
  updateWorkflow,
  activateWorkflow,
  testWebhook,
  listExecutions,
  getLatestExecutionForWorkflow,
  workflowPathFromName,
  safePath,
};

