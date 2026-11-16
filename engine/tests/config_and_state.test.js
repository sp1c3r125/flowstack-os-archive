"use strict";

// Tests for engine/config.js, the tenant registry and the event ledger.
// Each environment-dependent check runs in a child process with a controlled
// environment, and anything written goes to a temp directory, never to the repo.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ENGINE_DIR = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(ENGINE_DIR, "..");

const MANAGED = [
  "FLOWSTACK_HOME",
  "FLOWSTACK_ROOT",
  "FLOWSTACK_WORKSPACE_ROOT",
  "CONTROL_PLANE_API_TOKEN",
  "CONTROL_PLANE_API_PORT",
  "FLOWSTACK_DEMO_MODE",
  "ENABLE_LLM_REPAIR",
  "LITELLM_URL",
  "LITELLM_MODEL",
  "LITELLM_KEY",
  "N8N_URL",
  "N8N_API_KEY",
];

// Run a snippet in a fresh node process whose environment has none of the
// variables above unless the test sets them. The snippet prints JSON.
function runWith(overrides, code) {
  const env = { ...process.env };
  for (const key of MANAGED) delete env[key];
  Object.assign(env, overrides);
  const out = execFileSync(process.execPath, ["-e", code], { cwd: ENGINE_DIR, env, encoding: "utf8" });
  return JSON.parse(out);
}

const showConfig = `console.log(JSON.stringify(require("./config")))`;

test("config defaults: data dir under the repo root, demo mode on, LLM repair off, no keys", () => {
  const c = runWith({}, showConfig);
  assert.equal(c.FLOWSTACK_HOME, path.join(REPO_ROOT, "data"));
  assert.equal(c.FLOWSTACK_ROOT, c.FLOWSTACK_HOME);
  assert.equal(c.FLOWSTACK_WORKSPACE_ROOT, c.FLOWSTACK_HOME);
  assert.equal(c.CONTROL_PLANE_API_PORT, "47911");
  assert.equal(c.CONTROL_PLANE_API_TOKEN, "");
  assert.equal(c.FLOWSTACK_DEMO_MODE, true);
  assert.equal(c.ENABLE_LLM_REPAIR, false);
  assert.equal(c.LITELLM_KEY, "");
  assert.equal(c.N8N_API_KEY, "");
  assert.equal(c.N8N_URL, "http://localhost:5678");
});

test("config: FLOWSTACK_HOME moves the root and the workspace root with it", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "fs-home-"));
  try {
    const c = runWith({ FLOWSTACK_HOME: home }, showConfig);
    assert.equal(c.FLOWSTACK_HOME, path.resolve(home));
    assert.equal(c.FLOWSTACK_ROOT, path.resolve(home));
    assert.equal(c.FLOWSTACK_WORKSPACE_ROOT, path.resolve(home));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("config: switches parse as documented and N8N_URL loses a trailing slash", () => {
  const c = runWith(
    { FLOWSTACK_DEMO_MODE: "0", ENABLE_LLM_REPAIR: "1", N8N_URL: "http://n8n.example/", CONTROL_PLANE_API_PORT: "5000" },
    showConfig
  );
  assert.equal(c.FLOWSTACK_DEMO_MODE, false);
  assert.equal(c.ENABLE_LLM_REPAIR, true);
  assert.equal(c.N8N_URL, "http://n8n.example");
  assert.equal(c.CONTROL_PLANE_API_PORT, "5000");
});

test("config: childProcessEnv adds overrides on top of the current environment", () => {
  const out = runWith(
    { CONTROL_PLANE_API_PORT: "5000" },
    `const { childProcessEnv } = require("./config");
     const e = childProcessEnv({ EXTRA_FLAG: "yes", CONTROL_PLANE_API_PORT: "6000" });
     console.log(JSON.stringify({ extra: e.EXTRA_FLAG, port: e.CONTROL_PLANE_API_PORT, hasPath: Boolean(e.PATH || e.Path) }));`
  );
  assert.deepEqual(out, { extra: "yes", port: "6000", hasPath: true });
});

test("the shipped tenant registry holds only the Sample Tours tenant", () => {
  const { listTenants, getTenantById } = require("../tenant_registry");
  const tenants = listTenants({ repoRoot: ENGINE_DIR });
  assert.deepEqual(
    tenants.map((t) => t.tenant_id),
    ["sampletours_samplecity"]
  );
  assert.equal(tenants[0].active, true);
  assert.equal(getTenantById("sampletours_samplecity", { repoRoot: ENGINE_DIR }).tenant.display_name, "Sample Tours (Sample City)");
});

test("getTenantById throws TENANT_NOT_FOUND for an unknown tenant", () => {
  const { getTenantById } = require("../tenant_registry");
  assert.throws(
    () => getTenantById("no_such_tenant", { repoRoot: ENGINE_DIR }),
    (err) => err.code === "TENANT_NOT_FOUND"
  );
});

test("loadTenantRegistry rejects a file of the wrong type and a non-array tenant list", () => {
  const { loadTenantRegistry } = require("../tenant_registry");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fs-registry-"));
  try {
    fs.writeFileSync(path.join(dir, "wrong_type.json"), JSON.stringify({ artifact_type: "something_else", tenants: [] }));
    fs.writeFileSync(
      path.join(dir, "bad_tenants.json"),
      JSON.stringify({ artifact_type: "control_plane_tenant_registry", tenants: {} })
    );
    assert.throws(
      () => loadTenantRegistry({ repoRoot: dir, registryPath: "wrong_type.json" }),
      (err) => err.code === "TENANT_REGISTRY_TYPE_INVALID"
    );
    assert.throws(
      () => loadTenantRegistry({ repoRoot: dir, registryPath: "bad_tenants.json" }),
      (err) => err.code === "TENANT_REGISTRY_TENANTS_INVALID"
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("event ledger appends to FLOWSTACK_HOME, keeps order, and caps at 500 events", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "fs-ledger-"));
  try {
    const out = runWith(
      { FLOWSTACK_HOME: home },
      `const { appendEvent, loadLedger, LEDGER_FILE } = require("./event_ledger");
       appendEvent({ type: "first", leadId: "lead-001" });
       appendEvent({ type: "second" });
       const afterTwo = loadLedger().events.map(e => e.type);
       for (let i = 0; i < 510; i++) appendEvent({ type: "bulk", i });
       const events = loadLedger().events;
       console.log(JSON.stringify({
         afterTwo,
         count: events.length,
         firstKept: events[0].i,
         last: events[events.length - 1].i,
         hasTimestamp: typeof events[0].ts === "string",
         ledgerFile: LEDGER_FILE,
       }));`
    );
    assert.deepEqual(out.afterTwo, ["first", "second"]);
    assert.equal(out.count, 500);
    assert.equal(out.firstKept, 10);
    assert.equal(out.last, 509);
    assert.equal(out.hasTimestamp, true);
    assert.ok(path.resolve(out.ledgerFile).startsWith(path.resolve(home)), "ledger must live under FLOWSTACK_HOME");
    assert.ok(fs.existsSync(out.ledgerFile));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
