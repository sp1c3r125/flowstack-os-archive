const { findVersionDrift } = require("./repair_observer_version.js");

function validateSecondaryRuntime(workflow, repairResult) {
  const versionObs = findVersionDrift(workflow);

  const issues = [];

  if (!workflow?.active) {
    issues.push("workflow_not_active");
  }

  if ((versionObs.fakeTop || []).length > 0) {
    issues.push("fake_top_nodes_remain");
  }

  if ((versionObs.fakeActive || []).length > 0) {
    issues.push("fake_active_nodes_remain");
  }

  if ((versionObs.driftCount || 0) > 0) {
    issues.push("active_version_drift");
  }

  const platformBlocked =
    repairResult?.status === "platform_blocked_after_success";

  if (issues.length === 0 && platformBlocked) {
    return {
      ok: true,
      status: "validated_repaired_platform_blocked",
      reason: "workflow artifact is healthy; only platform webhook registration remains blocked",
      issues: [],
      manualAction: repairResult?.platformAdaptation?.manualAction || null
    };
  }

  if (issues.length === 0) {
    return {
      ok: true,
      status: "validated_workflow_healthy",
      reason: "workflow artifact is healthy",
      issues: []
    };
  }

  return {
    ok: false,
    status: "validation_failed",
    reason: "workflow artifact still has structural/runtime issues",
    issues
  };
}

module.exports = {
  validateSecondaryRuntime,
};
