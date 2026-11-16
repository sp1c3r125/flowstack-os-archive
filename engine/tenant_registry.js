const fs = require("fs");
const path = require("path");
const { FLOWSTACK_WORKSPACE_ROOT } = require("./config");

const DEFAULT_REGISTRY_FILE = "control_plane_tenant_registry.json";
const EXPECTED_ARTIFACT_TYPE = "control_plane_tenant_registry";

function readJsonBomSafe(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function getRepoRoot(repoRoot) {
  return path.resolve(repoRoot || ".");
}

function getWorkspaceRoot() {
  return FLOWSTACK_WORKSPACE_ROOT;
}

function getRegistryPath(repoRoot, registryPath) {
  const explicitPath = path.resolve(getRepoRoot(repoRoot), registryPath || DEFAULT_REGISTRY_FILE);
  if (fs.existsSync(explicitPath)) {
    return explicitPath;
  }

  const workspaceCandidate = path.resolve(getWorkspaceRoot(), registryPath || DEFAULT_REGISTRY_FILE);
  return workspaceCandidate;
}

function loadTenantRegistry(options = {}) {
  const repoRoot = getRepoRoot(options.repoRoot);
  const registryPath = getRegistryPath(repoRoot, options.registryPath);

  if (!fs.existsSync(registryPath)) {
    const error = new Error(`Tenant registry not found: ${registryPath}`);
    error.code = "TENANT_REGISTRY_NOT_FOUND";
    throw error;
  }

  const parsed = readJsonBomSafe(registryPath);
  if ((parsed.artifact_type || null) !== EXPECTED_ARTIFACT_TYPE) {
    const error = new Error(`Unexpected tenant registry artifact_type: ${parsed.artifact_type || "null"}`);
    error.code = "TENANT_REGISTRY_TYPE_INVALID";
    throw error;
  }

  if (!Array.isArray(parsed.tenants)) {
    const error = new Error("Tenant registry tenants must be an array");
    error.code = "TENANT_REGISTRY_TENANTS_INVALID";
    throw error;
  }

  return {
    repo_root: repoRoot,
    registry_path: registryPath,
    registry: parsed,
  };
}

function listTenants(options = {}) {
  const loaded = loadTenantRegistry(options);
  return loaded.registry.tenants.map((tenant) => ({
    tenant_id: tenant.tenant_id,
    display_name: tenant.display_name || tenant.tenant_id,
    active: tenant.active !== false,
    project_count: Array.isArray(tenant.projects) ? tenant.projects.length : 0,
  }));
}

function getTenantById(tenantId, options = {}) {
  const loaded = loadTenantRegistry(options);
  const tenant = loaded.registry.tenants.find((item) => item.tenant_id === tenantId);

  if (!tenant) {
    const error = new Error(`Tenant not found: ${tenantId}`);
    error.code = "TENANT_NOT_FOUND";
    throw error;
  }

  return {
    repo_root: loaded.repo_root,
    registry_path: loaded.registry_path,
    tenant,
  };
}

module.exports = {
  DEFAULT_REGISTRY_FILE,
  EXPECTED_ARTIFACT_TYPE,
  loadTenantRegistry,
  listTenants,
  getTenantById,
};
