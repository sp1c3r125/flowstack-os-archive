const { readJson } = require("./control_plane_live_gate_read_helpers");

function validateControlPlaneManualLiveExecutionProgression(input) {
  const obj = typeof input === "string" ? readJson(input) : input;
  const failed = [];
  if (!obj) failed.push("MISSING_EXECUTION_PROGRESSION");
  if (obj && obj.artifact_type !== "control_plane_manual_live_execution_progression") failed.push("BAD_ARTIFACT_TYPE");
  if (obj && obj.mutation_authority !== "control_plane_only") failed.push("BAD_MUTATION_AUTHORITY");
  if (obj && obj.actual_live_execution_performed !== false) failed.push("PHASE9_MUST_NOT_PERFORM_LIVE_EXECUTION");
  if (obj) {
    const allowed = ["READY_FOR_MANUAL_OPERATOR_STEP", "PROGRESSION_BLOCKED"];
    if (!allowed.includes(obj.progression_status)) failed.push("BAD_PROGRESSION_STATUS");
    if (!obj.source_operator_execution_event_consumption_path) failed.push("MISSING_OPERATOR_EVENT_CONSUMPTION_LINEAGE");
  }
  return { ok: failed.length === 0, failed_checks: failed };
}

module.exports = { validateControlPlaneManualLiveExecutionProgression };
