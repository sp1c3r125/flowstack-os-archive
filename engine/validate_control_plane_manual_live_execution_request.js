const { readJson } = require("./control_plane_live_gate_read_helpers");

function validateControlPlaneManualLiveExecutionRequest(input) {
  const obj = typeof input === "string" ? readJson(input) : input;
  const failed = [];
  if (!obj) failed.push("MISSING_EXECUTION_REQUEST");
  if (obj && obj.artifact_type !== "control_plane_manual_live_execution_request") failed.push("BAD_ARTIFACT_TYPE");
  if (obj && obj.mutation_authority !== "control_plane_only") failed.push("BAD_MUTATION_AUTHORITY");
  if (obj && obj.actual_live_execution_performed !== false) failed.push("PHASE8_MUST_NOT_PERFORM_LIVE_EXECUTION");

  if (obj) {
    const allowed = ["READY_FOR_CONTROLLED_CONSUMPTION", "REQUEST_BLOCKED"];
    if (!allowed.includes(obj.request_status)) failed.push("BAD_REQUEST_STATUS");

    const blocked = Array.isArray(obj.blocked_reasons) ? obj.blocked_reasons : [];
    if (obj.request_status === "READY_FOR_CONTROLLED_CONSUMPTION" && blocked.length > 0) failed.push("READY_REQUEST_MUST_NOT_HAVE_BLOCKED_REASONS");
    if (obj.request_status === "REQUEST_BLOCKED" && blocked.length === 0) failed.push("BLOCKED_REQUEST_MUST_HAVE_BLOCKED_REASONS");

    if (!obj.source_boundary_path) failed.push("MISSING_BOUNDARY_LINEAGE");
    if (!obj.source_preflight_path) failed.push("MISSING_PREFLIGHT_LINEAGE");
  }

  return { ok: failed.length === 0, failed_checks: failed };
}

module.exports = { validateControlPlaneManualLiveExecutionRequest };
