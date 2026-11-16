const { readJson } = require("./control_plane_live_gate_read_helpers");

function validateControlPlaneManualLivePostExecutionReport(input) {
  const obj = typeof input === "string" ? readJson(input) : input;
  const failed = [];
  if (!obj) failed.push("MISSING_POST_EXECUTION_REPORT");
  if (obj && obj.artifact_type !== "control_plane_manual_live_post_execution_report") failed.push("BAD_ARTIFACT_TYPE");
  if (obj && obj.mutation_authority !== "control_plane_only") failed.push("BAD_MUTATION_AUTHORITY");
  if (obj && obj.actual_live_execution_checked !== false) failed.push("POST_EXECUTION_CHECK_MUST_BE_FALSE_IN_PHASE8");
  if (obj && obj.post_execution_validation_status !== "PLACEHOLDER_NOT_EXECUTED") failed.push("BAD_POST_EXECUTION_STATUS");
  if (obj && !obj.source_state_transition_path) failed.push("MISSING_TRANSITION_LINEAGE");
  return { ok: failed.length === 0, failed_checks: failed };
}

module.exports = { validateControlPlaneManualLivePostExecutionReport };
