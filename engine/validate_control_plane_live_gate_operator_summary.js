const { readJson } = require("./control_plane_live_gate_read_helpers");
function validateControlPlaneLiveGateOperatorSummary(input) {
  const obj = typeof input === "string" ? readJson(input) : input;
  const failed = [];
  if (!obj) failed.push("MISSING_OPERATOR_SUMMARY");
  if (obj && obj.artifact_type !== "control_plane_live_gate_operator_summary") failed.push("BAD_ARTIFACT_TYPE");
  if (obj && obj.mutation_authority !== "control_plane_only") failed.push("BAD_MUTATION_AUTHORITY");
  return { ok: failed.length === 0, failed_checks: failed };
}
module.exports = { validateControlPlaneLiveGateOperatorSummary };
