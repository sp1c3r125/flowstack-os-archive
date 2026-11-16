const { proposeRepair } = require("./repair_llm.js");

const NON_LLM_FAILURE_TYPES = new Set([
  "WEBHOOK_NOT_REGISTERED",
  "ACTIVE_VERSION_DRIFT",
  "TOP_LEVEL_FAKE_NODES"
]);

function shouldUseLlmStrategy({ failure, versionObs, platformObs, repeatedFailure }) {
  if (!failure) return false;
  if (NON_LLM_FAILURE_TYPES.has(failure.type)) return false;
  if (repeatedFailure) return false;
  if (platformObs?.active && platformObs?.webhook404 && platformObs?.webhookNotRegistered) return false;
  if ((versionObs?.driftCount || 0) > 0) return false;
  return true;
}

async function proposeLlmStrategy({
  workflow,
  versionObs,
  execObs,
  platformObs,
  failure
}) {
  const workflowSummary = {
    id: workflow?.id || null,
    name: workflow?.name || null,
    active: !!workflow?.active,
    topFakeNodes: versionObs?.fakeTop || [],
    activeFakeNodes: versionObs?.fakeActive || [],
    driftCount: versionObs?.driftCount || 0,
    lastNode: execObs?.lastNode || null,
    execError: execObs?.errorText || "",
    platformObs
  };

  return await proposeRepair({
    workflowSummary,
    failure,
    maxOps: 2
  });
}

module.exports = {
  shouldUseLlmStrategy,
  proposeLlmStrategy,
};
