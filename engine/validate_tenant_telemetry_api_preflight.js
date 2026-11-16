"use strict";

const fs = require("fs");
const path = require("path");
const { resolveFlowstackRuntimeRoots } = require("./flowstack_runtime_roots");
const { loadTenantRegistry } = require("./tenant_registry");

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

function validateTenantTelemetryApiPreflight(options = {}) {
  const roots = resolveFlowstackRuntimeRoots(options);
  const tenantId = options.tenantId || options.tenant_id || "sampletours_samplecity";
  const projectId = options.projectId || options.project_id || "core";
  const registry = loadTenantRegistry({ repoRoot: roots.workspace_root });
  const tenant = registry.registry.tenants.find((entry) => entry.tenant_id === tenantId);
  if (!tenant) {
    throw new Error(`Tenant not found in workspace registry: ${tenantId}`);
  }
  const project = (tenant.projects || []).find((entry) => entry.project_id === projectId);
  if (!project) {
    throw new Error(`Project not found in workspace registry: ${tenantId}/${projectId}`);
  }

  const projectRoot = path.join(roots.workspace_root, project.workspace_subpath || `tenants/${tenantId}/projects/${projectId}`);
  const artifactsRoot = path.join(projectRoot, "artifacts");
  const summaryDir = path.join(artifactsRoot, "tenant_execution_status_summaries");
  const dashboardDir = path.join(artifactsRoot, "tenant_execution_status_dashboards");

  return {
    ok: Boolean(process.env.CONTROL_PLANE_API_TOKEN) && fs.existsSync(summaryDir) && fs.existsSync(dashboardDir),
    artifact_type: "tenant_telemetry_api_preflight",
    workspace_root: roots.workspace_root,
    tenant_id: tenantId,
    project_id: projectId,
    token_configured: Boolean(process.env.CONTROL_PLANE_API_TOKEN),
    summary_dir: summaryDir,
    summary_dir_exists: fs.existsSync(summaryDir),
    dashboard_dir: dashboardDir,
    dashboard_dir_exists: fs.existsSync(dashboardDir),
    authority: "control_plane_only",
    mutation_performed: false,
    live_mutation: false,
  };
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const result = validateTenantTelemetryApiPreflight({
    codeRoot: args["code-root"],
    workspaceRoot: args["workspace-root"],
    tenantId: args.tenant_id,
    projectId: args.project_id,
  });
  console.log(JSON.stringify(result, null, 2));
}

module.exports = {
  validateTenantTelemetryApiPreflight,
};
