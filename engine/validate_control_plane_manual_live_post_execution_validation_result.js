const { readJson } = require("./control_plane_live_gate_read_helpers");

function validateControlPlaneManualLivePostExecutionValidationResult(input) {
  const obj = typeof input === "string" ? readJson(input) : input;
  const failed = [];
  if (!obj) failed.push("MISSING_POST_EXECUTION_VALIDATION_RESULT");
  if (obj && obj.artifact_type !== "control_plane_manual_live_post_execution_validation_result") failed.push("BAD_ARTIFACT_TYPE");
  if (obj && obj.mutation_authority !== "control_plane_only") failed.push("BAD_MUTATION_AUTHORITY");
  if (obj && obj.actual_live_execution_checked !== false) failed.push("PHASE9_POST_EXECUTION_MUST_STAY_PLACEHOLDER");
  if (obj && obj.validation_result_status !== "PLACEHOLDER_NOT_EXECUTED") failed.push("BAD_VALIDATION_RESULT_STATUS");
  if (obj && !obj.source_execution_progression_path) failed.push("MISSING_EXECUTION_PROGRESSION_LINEAGE");
  return { ok: failed.length === 0, failed_checks: failed };
}

module.exports = { validateControlPlaneManualLivePostExecutionValidationResult };
