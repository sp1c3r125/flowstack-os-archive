const { readJson } = require("./control_plane_live_gate_read_helpers");

function validateControlPlaneManualLiveExecutionBoundary(input) {
  const obj = typeof input === "string" ? readJson(input) : input;
  const failed = [];

  if (!obj) failed.push("MISSING_EXECUTION_BOUNDARY");
  if (obj && obj.artifact_type !== "control_plane_manual_live_execution_boundary") failed.push("BAD_ARTIFACT_TYPE");
  if (obj && obj.mutation_authority !== "control_plane_only") failed.push("BAD_MUTATION_AUTHORITY");
  if (obj && obj.actual_live_execution_started !== false) failed.push("LIVE_EXECUTION_MUST_NOT_START_IN_PHASE7");

  if (obj) {
    const allowedStatuses = ["READY_FOR_MANUAL_EXECUTION_BOUNDARY", "MANUAL_EXECUTION_BOUNDARY_BLOCKED"];
    if (!allowedStatuses.includes(obj.boundary_status)) {
      failed.push("BAD_BOUNDARY_STATUS");
    }

    const blockedReasons = Array.isArray(obj.blocked_reasons) ? obj.blocked_reasons : [];
    const isReady = obj.boundary_status === "READY_FOR_MANUAL_EXECUTION_BOUNDARY";
    const isBlocked = obj.boundary_status === "MANUAL_EXECUTION_BOUNDARY_BLOCKED";

    if (isReady && blockedReasons.length > 0) {
      failed.push("READY_BOUNDARY_MUST_NOT_HAVE_BLOCKED_REASONS");
    }

    if (isBlocked && blockedReasons.length === 0) {
      failed.push("BLOCKED_BOUNDARY_MUST_HAVE_BLOCKED_REASONS");
    }
  }

  return { ok: failed.length === 0, failed_checks: failed };
}

module.exports = { validateControlPlaneManualLiveExecutionBoundary };
