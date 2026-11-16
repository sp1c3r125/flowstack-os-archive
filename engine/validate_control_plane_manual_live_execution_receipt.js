const { readJson } = require("./control_plane_live_gate_read_helpers");

function validateControlPlaneManualLiveExecutionReceipt(input) {
  const obj = typeof input === "string" ? readJson(input) : input;
  const failed = [];
  if (!obj) failed.push("MISSING_EXECUTION_RECEIPT");
  if (obj && obj.artifact_type !== "control_plane_manual_live_execution_receipt") failed.push("BAD_ARTIFACT_TYPE");
  if (obj && obj.mutation_authority !== "control_plane_only") failed.push("BAD_MUTATION_AUTHORITY");
  if (obj && obj.actual_live_execution_performed !== false) failed.push("LIVE_EXECUTION_MUST_NOT_BE_PERFORMED_IN_PHASE7");
  if (obj && obj.receipt_status !== "BOUNDARY_PREPARED_NOT_EXECUTED") failed.push("BAD_RECEIPT_STATUS");
  if (obj && !obj.source_preflight_validation_path) failed.push("MISSING_PREFLIGHT_LINEAGE");
  return { ok: failed.length === 0, failed_checks: failed };
}

module.exports = { validateControlPlaneManualLiveExecutionReceipt };
