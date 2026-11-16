"use strict";

const path = require("path");
const { spawn } = require("child_process");
const { resolveFlowstackRuntimeRoots } = require("./flowstack_runtime_roots");
const { ensureFlowstackWorkspaceBootstrap } = require("./ensure_flowstack_workspace_bootstrap");
const { validateTenantTelemetryApiPreflight } = require("./validate_tenant_telemetry_api_preflight");

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

function run() {
  const args = parseArgs(process.argv.slice(2));
  const roots = resolveFlowstackRuntimeRoots({
    codeRoot: args["code-root"] || __dirname,
    workspaceRoot: args["workspace-root"],
    port: args.port,
  });

  ensureFlowstackWorkspaceBootstrap({
    codeRoot: roots.code_root,
    workspaceRoot: roots.workspace_root,
  });

  const apiToken = args.token || process.env.CONTROL_PLANE_API_TOKEN;
  if (!apiToken) {
    throw new Error("CONTROL_PLANE_API_TOKEN is required");
  }

  const childEnv = {
    ...process.env,
    CONTROL_PLANE_API_TOKEN: apiToken,
    FLOWSTACK_WORKSPACE_ROOT: roots.workspace_root,
    FLOWSTACK_CODE_ROOT: roots.code_root,
  };

  if (args.preflight !== "false") {
    const preflight = validateTenantTelemetryApiPreflight({
      codeRoot: roots.code_root,
      workspaceRoot: roots.workspace_root,
      tenantId: args.tenant_id || "sampletours_samplecity",
      projectId: args.project_id || "core",
    });
    console.log(JSON.stringify(preflight, null, 2));
  }

  const serverPath = path.join(roots.code_root, "run_control_plane_api_server.js");
  const child = spawn(
    process.execPath,
    [
      serverPath,
      "--repo-root", roots.code_root,
      "--workspace-root", roots.workspace_root,
      "--port", String(roots.port),
    ],
    {
      cwd: roots.code_root,
      env: childEnv,
      stdio: "inherit",
    }
  );

  child.on("exit", (code) => process.exit(code ?? 0));
}

if (require.main === module) {
  run();
}
