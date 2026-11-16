const { readJson } = require("./control_plane_live_gate_read_helpers");
function validateControlPlaneLiveGateState(input) {
  const obj = typeof input === "string" ? readJson(input) : input;
  const failed = [];
  if (!obj) failed.push("MISSING_STATE");
  if (obj && obj.artifact_type !== "control_plane_live_gate_state") failed.push("BAD_ARTIFACT_TYPE");
  if (obj && obj.mutation_authority !== "control_plane_only") failed.push("BAD_MUTATION_AUTHORITY");
  if (obj && obj.eligible_for_manual_live_gate === true && obj.eligibility_status !== "ELIGIBLE_FOR_MANUAL_LIVE_GATE") failed.push("ELIGIBILITY_FLAG_STATUS_MISMATCH");
  if (obj && obj.eligible_for_manual_live_gate === false && obj.eligibility_status === "ELIGIBLE_FOR_MANUAL_LIVE_GATE") failed.push("ELIGIBILITY_FLAG_STATUS_MISMATCH");
  return { ok: failed.length === 0, failed_checks: failed };
}
module.exports = { validateControlPlaneLiveGateState };
