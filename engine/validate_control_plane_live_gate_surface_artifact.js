const { readJson } = require("./control_plane_live_gate_read_helpers");
function validateControlPlaneLiveGateSurfaceArtifact(input) {
  const obj = typeof input === "string" ? readJson(input) : input;
  const failed = [];
  if (!obj) failed.push("MISSING_SURFACE");
  if (obj && obj.artifact_type !== "control_plane_live_gate_surface_artifact") failed.push("BAD_ARTIFACT_TYPE");
  if (obj && obj.mutation_authority !== "control_plane_only") failed.push("BAD_MUTATION_AUTHORITY");
  if (obj && !obj.operator_summary) failed.push("MISSING_OPERATOR_SUMMARY");
  return { ok: failed.length === 0, failed_checks: failed };
}
module.exports = { validateControlPlaneLiveGateSurfaceArtifact };
