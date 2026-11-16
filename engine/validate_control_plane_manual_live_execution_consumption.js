const { readJson } = require("./control_plane_live_gate_read_helpers");

function validateControlPlaneManualLiveExecutionConsumption(input) {
  const obj = typeof input === "string" ? readJson(input) : input;
  const failed = [];
  if (!obj) failed.push("MISSING_EXECUTION_CONSUMPTION");
  if (obj && obj.artifact_type !== "control_plane_manual_live_execution_consumption") failed.push("BAD_ARTIFACT_TYPE");
  if (obj && obj.mutation_authority !== "control_plane_only") failed.push("BAD_MUTATION_AUTHORITY");
  if (obj && obj.actual_live_execution_performed !== false) failed.push("PHASE8_MUST_NOT_PERFORM_LIVE_EXECUTION");
  if (obj) {
    const allowed = ["CONTROLLED_CONSUMPTION_ACCEPTED", "CONTROLLED_CONSUMPTION_BLOCKED"];
    if (!allowed.includes(obj.consumption_status)) failed.push("BAD_CONSUMPTION_STATUS");
    if (!obj.source_execution_request_path) failed.push("MISSING_REQUEST_LINEAGE");
  }
  return { ok: failed.length === 0, failed_checks: failed };
}

module.exports = { validateControlPlaneManualLiveExecutionConsumption };
