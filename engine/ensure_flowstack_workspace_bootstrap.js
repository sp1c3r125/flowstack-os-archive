"use strict";

const fs = require("fs");
const path = require("path");
const { resolveFlowstackRuntimeRoots } = require("./flowstack_runtime_roots");

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

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureFlowstackWorkspaceBootstrap(options = {}) {
  const roots = resolveFlowstackRuntimeRoots(options);
  const workspaceRegistryPath = path.join(roots.workspace_root, "control_plane_tenant_registry.json");
  const codeRegistryPath = path.join(roots.code_root, "control_plane_tenant_registry.json");

  ensureDir(roots.workspace_root);
  ensureDir(path.join(roots.workspace_root, "tenants"));

  let registryAction = "present";
  if (!fs.existsSync(workspaceRegistryPath)) {
    if (!fs.existsSync(codeRegistryPath)) {
      const error = new Error(`Tenant registry source not found: ${codeRegistryPath}`);
      error.code = "FLOWSTACK_WORKSPACE_REGISTRY_SOURCE_NOT_FOUND";
      throw error;
    }
    fs.copyFileSync(codeRegistryPath, workspaceRegistryPath);
    registryAction = "copied_from_code_root";
  }

  return {
    ok: true,
    artifact_type: "flowstack_workspace_bootstrap",
    code_root: roots.code_root,
    workspace_root: roots.workspace_root,
    workspace_registry_path: workspaceRegistryPath,
    registry_action: registryAction,
    authority: "control_plane_only",
    mutation_performed: false,
    live_mutation: false,
  };
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const result = ensureFlowstackWorkspaceBootstrap({
    codeRoot: args["code-root"],
    workspaceRoot: args["workspace-root"],
  });
  console.log(JSON.stringify(result, null, 2));
}

module.exports = {
  ensureFlowstackWorkspaceBootstrap,
};
