function validateRuntime({ workflow, versionObs, execObs, platformObs, testResult }) {
  const issues = [];

  if (versionObs?.fakeTop?.length > 0) {
    issues.push({
      type: "FAKE_TOP_NODES_REMAIN",
      nodes: versionObs.fakeTop
    });
  }

  if (versionObs?.fakeActive?.length > 0) {
    issues.push({
      type: "FAKE_ACTIVE_NODES_REMAIN",
      nodes: versionObs.fakeActive
    });
  }

  if ((versionObs?.driftCount || 0) > 0) {
    issues.push({
      type: "ACTIVE_VERSION_DRIFT",
      driftCount: versionObs.driftCount
    });
  }

  if (platformObs?.active && platformObs?.webhook404 && platformObs?.webhookNotRegistered) {
    issues.push({
      type: "WEBHOOK_NOT_REGISTERED"
    });
  }

  if (/ENOTFOUND|getaddrinfo|example\.invalid/i.test(execObs?.errorText || "")) {
    issues.push({
      type: "RUNTIME_DNS_FAILURE",
      lastNode: execObs?.lastNode || null
    });
  }

  return {
    ok: issues.length === 0 || (
      issues.length === 1 &&
      issues[0].type === "WEBHOOK_NOT_REGISTERED"
    ),
    issues,
    status: issues.length === 0
      ? "RUNTIME_OK"
      : (issues.length === 1 && issues[0].type === "WEBHOOK_NOT_REGISTERED"
          ? "PLATFORM_BLOCKED"
          : "RUNTIME_ISSUES")
  };
}

module.exports = {
  validateRuntime,
};
