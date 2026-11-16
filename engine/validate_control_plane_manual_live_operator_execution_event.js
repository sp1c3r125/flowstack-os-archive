const { readJson } = require("./control_plane_live_gate_read_helpers");

function validateControlPlaneManualLiveOperatorExecutionEvent(input) {
  const obj = typeof input === "string" ? readJson(input) : input;
  const failed = [];
  if (!obj) failed.push("MISSING_OPERATOR_EXECUTION_EVENT");
  if (obj && obj.artifact_type !== "control_plane_manual_live_operator_execution_event") failed.push("BAD_ARTIFACT_TYPE");
  if (obj && obj.mutation_authority !== "control_plane_only") failed.push("BAD_MUTATION_AUTHORITY");
  if (obj && obj.actual_live_execution_performed !== false) failed.push("PHASE9_MUST_NOT_PERFORM_LIVE_EXECUTION");

  if (obj) {
    const allowed = ["OPERATOR_EVENT_ACCEPTED", "OPERATOR_EVENT_BLOCKED"];
    if (!allowed.includes(obj.operator_event_status)) failed.push("BAD_OPERATOR_EVENT_STATUS");

    const blocked = Array.isArray(obj.blocked_reasons) ? obj.blocked_reasons : [];
    if (obj.operator_event_status === "OPERATOR_EVENT_ACCEPTED" && blocked.length > 0) failed.push("ACCEPTED_OPERATOR_EVENT_MUST_NOT_HAVE_BLOCKED_REASONS");
    if (obj.operator_event_status === "OPERATOR_EVENT_BLOCKED" && blocked.length === 0) failed.push("BLOCKED_OPERATOR_EVENT_MUST_HAVE_BLOCKED_REASONS");

    if (!obj.source_execution_request_path) failed.push("MISSING_EXECUTION_REQUEST_LINEAGE");
    if (!obj.source_execution_consumption_path) failed.push("MISSING_EXECUTION_CONSUMPTION_LINEAGE");
  }

  return { ok: failed.length === 0, failed_checks: failed };
}

module.exports = { validateControlPlaneManualLiveOperatorExecutionEvent };
