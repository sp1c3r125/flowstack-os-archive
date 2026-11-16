"use strict";

const http = require("http");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function getJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers }, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}");
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, statusCode: res.statusCode, body: parsed });
            return;
          }
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        } catch (error) {
          reject(new Error(`INVALID_JSON_RESPONSE: ${error.message}`));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(4000, () => req.destroy(new Error("REQUEST_TIMEOUT")));
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const port = String(args.port || "47911");
  const token = args.token || process.env.CONTROL_PLANE_API_TOKEN;
  const tenantId = args["tenant-id"] || "sampletours_samplecity";
  const projectId = args["project-id"] || "core";

  if (!token) {
    throw new Error("CONTROL_PLANE_API_TOKEN is required");
  }

  const base = `http://127.0.0.1:${port}`;
  const headers = { Authorization: `Bearer ${token}` };

  const health = await getJson(`${base}/health`);
  const summary = await getJson(`${base}/api/control-plane/tenant-execution-status-summary/latest?tenant_id=${tenantId}&project_id=${projectId}`, headers);
  const dashboard = await getJson(`${base}/api/control-plane/tenant-execution-status-dashboard/latest?tenant_id=${tenantId}&project_id=${projectId}`, headers);

  const result = {
    ok: true,
    status: "FLOWSTACK_CONTROL_PLANE_API_RUNTIME_VALID",
    validated_at: new Date().toISOString(),
    port: Number(port),
    tenant_id: tenantId,
    project_id: projectId,
    checks: {
      health: health.body.status,
      summary: summary.body.status,
      dashboard: dashboard.body.status,
    },
    authority: "control_plane_only",
    mutation_performed: false,
    live_mutation: false,
    api_mode: "read_only",
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    status: "FLOWSTACK_CONTROL_PLANE_API_RUNTIME_INVALID",
    error: error.message,
    authority: "control_plane_only",
    mutation_performed: false,
    live_mutation: false,
  }, null, 2));
  process.exit(1);
});
