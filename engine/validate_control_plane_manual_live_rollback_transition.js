const { readJson } = require("./control_plane_live_gate_read_helpers");

function validateControlPlaneManualLiveRollbackTransition(input) {
  const obj = typeof input === "string" ? readJson(input) : input;
  const failed = [];
  if (!obj) failed.push("MISSING_ROLLBACK_TRANSITION");
  if (obj && obj.artifact_type !== "control_plane_manual_live_rollback_transition") failed.push("BAD_ARTIFACT_TYPE");
  if (obj && obj.mutation_authority !== "control_plane_only") failed.push("BAD_MUTATION_AUTHORITY");
  if (obj && obj.actual_rollback_executed !== false) failed.push("PHASE9_MUST_NOT_EXECUTE_ROLLBACK");
  if (obj) {
    const allowed = ["ROLLBACK_TRANSITION_READY", "ROLLBACK_TRANSITION_BLOCKED"];
    if (!allowed.includes(obj.rollback_transition_status)) failed.push("BAD_ROLLBACK_TRANSITION_STATUS");
    if (!obj.source_rollback_readiness_path) failed.push("MISSING_ROLLBACK_READINESS_LINEAGE");
  }
  return { ok: failed.length === 0, failed_checks: failed };
}

module.exports = { validateControlPlaneManualLiveRollbackTransition };
