const { readJson } = require("./control_plane_live_gate_read_helpers");

function validateControlPlaneManualLiveOperatorExecutionEventConsumption(input) {
  const obj = typeof input === "string" ? readJson(input) : input;
  const failed = [];
  if (!obj) failed.push("MISSING_OPERATOR_EXECUTION_EVENT_CONSUMPTION");
  if (obj && obj.artifact_type !== "control_plane_manual_live_operator_execution_event_consumption") failed.push("BAD_ARTIFACT_TYPE");
  if (obj && obj.mutation_authority !== "control_plane_only") failed.push("BAD_MUTATION_AUTHORITY");
  if (obj && obj.actual_live_execution_performed !== false) failed.push("PHASE9_MUST_NOT_PERFORM_LIVE_EXECUTION");
  if (obj) {
    const allowed = ["OPERATOR_EXECUTION_PROGRESSION_ACCEPTED", "OPERATOR_EXECUTION_PROGRESSION_BLOCKED"];
    if (!allowed.includes(obj.consumption_status)) failed.push("BAD_OPERATOR_EVENT_CONSUMPTION_STATUS");
    if (!obj.source_operator_execution_event_path) failed.push("MISSING_OPERATOR_EVENT_LINEAGE");
  }
  return { ok: failed.length === 0, failed_checks: failed };
}

module.exports = { validateControlPlaneManualLiveOperatorExecutionEventConsumption };
