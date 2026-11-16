const { readJson } = require("./control_plane_live_gate_read_helpers");

function validateControlPlaneManualLiveRollbackContract(input) {
  const obj = typeof input === "string" ? readJson(input) : input;
  const failed = [];
  if (!obj) failed.push("MISSING_ROLLBACK_CONTRACT");
  if (obj && obj.artifact_type !== "control_plane_manual_live_rollback_contract") failed.push("BAD_ARTIFACT_TYPE");
  if (obj && obj.mutation_authority !== "control_plane_only") failed.push("BAD_MUTATION_AUTHORITY");
  if (obj && obj.rollback_execution_performed !== false) failed.push("ROLLBACK_MUST_NOT_EXECUTE_IN_PHASE7");
  if (obj && obj.placeholder_only !== true) failed.push("ROLLBACK_PLACEHOLDER_REQUIRED_IN_PHASE7");
  return { ok: failed.length === 0, failed_checks: failed };
}

module.exports = { validateControlPlaneManualLiveRollbackContract };
