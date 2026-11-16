const { readJson } = require("./control_plane_live_gate_read_helpers");

function validateControlPlaneLiveGateApprovalRecord(input) {
  const obj = typeof input === "string" ? readJson(input) : input;
  const failed = [];
  if (!obj) failed.push("MISSING_APPROVAL_RECORD");
  if (obj && obj.artifact_type !== "control_plane_live_gate_approval_record") failed.push("BAD_ARTIFACT_TYPE");
  if (obj && obj.mutation_authority !== "control_plane_only") failed.push("BAD_MUTATION_AUTHORITY");
  if (obj && obj.live_mutation_allowed !== false) failed.push("LIVE_MUTATION_MUST_BE_FALSE");
  if (obj && !["pending_human_approval", "blocked_not_approvable"].includes(obj.approval_status)) {
    failed.push("BAD_APPROVAL_STATUS");
  }
  return { ok: failed.length === 0, failed_checks: failed };
}

module.exports = { validateControlPlaneLiveGateApprovalRecord };
