function validateOutcomeV2({ beforeVersionObs, afterVersionObs, postTestResult, decision }) {
  if (postTestResult?.ok) {
    return { ok: true, status: "SUCCESS", reason: "webhook test succeeded" };
  }

  if (
    decision === "PATCH_TOP_LEVEL" &&
    beforeVersionObs.fakeTop.length > 0 &&
    afterVersionObs.fakeTop.length === 0
  ) {
    return {
      ok: true,
      status: "PATCHED_TOP_LEVEL",
      reason: "top-level fake nodes removed"
    };
  }

  return {
    ok: false,
    status: "FAILED",
    reason: "target repair condition not cleared"
  };
}

module.exports = {
  validateOutcomeV2,
};
