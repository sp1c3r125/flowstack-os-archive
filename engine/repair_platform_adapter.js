function adaptPlatformIssue({ workflow, platformObs, failure }) {
  if (
    failure?.type === "WEBHOOK_NOT_REGISTERED" &&
    platformObs?.active &&
    platformObs?.webhook404 &&
    platformObs?.webhookNotRegistered
  ) {
    return {
      type: "N8N_WEBHOOK_REGISTRATION_BLOCK",
      status: "platform_blocked_after_success",
      countsTowardFailureStop: false,
      manualAction: {
        kind: "n8n_ui_activation_check",
        message: "Open the workflow in n8n UI, toggle Active off/on, then run Execute workflow once or test the production webhook again."
      },
      note: "Workflow is active and repaired, but n8n did not register the production webhook."
    };
  }

  return null;
}

module.exports = {
  adaptPlatformIssue,
};
