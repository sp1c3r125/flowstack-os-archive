"use strict";

const path = require("path");
const { FLOWSTACK_WORKSPACE_ROOT, CONTROL_PLANE_API_PORT } = require("./config");

function resolveFlowstackRuntimeRoots(options = {}) {
  const codeRoot = path.resolve(options.codeRoot || options.repoRoot || process.cwd());
  const workspaceRoot = path.resolve(
    options.workspaceRoot ||
      options.flowstackWorkspaceRoot ||
      FLOWSTACK_WORKSPACE_ROOT
  );
  const port = String(options.port || CONTROL_PLANE_API_PORT);

  return {
    code_root: codeRoot,
    workspace_root: workspaceRoot,
    port,
    authority: "control_plane_only",
    mutation_performed: false,
    live_mutation: false,
  };
}

module.exports = {
  resolveFlowstackRuntimeRoots,
};
