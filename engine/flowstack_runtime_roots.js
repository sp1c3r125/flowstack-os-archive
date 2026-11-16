"use strict";

const path = require("path");
const { FLOWSTACK_HOME } = require("./flowstack_paths");

function resolveFlowstackRuntimeRoots(options = {}) {
  const codeRoot = path.resolve(options.codeRoot || options.repoRoot || process.cwd());
  const workspaceRoot = path.resolve(
    options.workspaceRoot ||
      options.flowstackWorkspaceRoot ||
      process.env.FLOWSTACK_WORKSPACE_ROOT ||
      FLOWSTACK_HOME
  );
  const port = String(options.port || process.env.CONTROL_PLANE_API_PORT || "47911");

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
