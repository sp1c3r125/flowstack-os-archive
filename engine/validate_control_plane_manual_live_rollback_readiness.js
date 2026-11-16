const { readJson } = require("./control_plane_live_gate_read_helpers");

function validateControlPlaneManualLiveRollbackReadiness(input) {
  const obj = typeof input === "string" ? readJson(input) : input;
  const failed = [];
  if (!obj) failed.push("MISSING_ROLLBACK_READINESS");
  if (obj && obj.artifact_type !== "control_plane_manual_live_rollback_readiness") failed.push("BAD_ARTIFACT_TYPE");
  if (obj && obj.mutation_authority !== "control_plane_only") failed.push("BAD_MUTATION_AUTHORITY");
  if (obj && obj.actual_rollback_executed !== false) failed.push("ROLLBACK_MUST_NOT_EXECUTE_IN_PHASE8");
  if (obj) {
    const allowed = ["ROLLBACK_PLACEHOLDER_READY", "ROLLBACK_PLACEHOLDER_MISSING"];
    if (!allowed.includes(obj.rollback_ready_status)) failed.push("BAD_ROLLBACK_READINESS_STATUS");
    if (!obj.source_rollback_contract_path) failed.push("MISSING_ROLLBACK_CONTRACT_LINEAGE");
  }
  return { ok: failed.length === 0, failed_checks: failed };
}

module.exports = { validateControlPlaneManualLiveRollbackReadiness };
