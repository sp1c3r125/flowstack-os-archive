function stubOpsForNodes(nodeNames) {
  const stubMap = {
    "CRM Upsert": { crmStatus: "upserted_stub", crmRecordId: "crm-demo-001" },
    "Notify Owner": { ownerNotificationStatus: "sent_stub" },
    "Follow Up Task": { followUpStatus: "scheduled_stub", followUpWaitHours: "24" }
  };

  return nodeNames
    .filter(n => !!stubMap[n])
    .map(n => ({
      type: "replace_node_with_stub",
      nodeName: n,
      fields: stubMap[n]
    }));
}

function chooseStrategyV2({ versionObs, execObs, platformObs }) {
  if (versionObs.fakeTop.length > 0) {
    return {
      failure: {
        type: "TOP_LEVEL_FAKE_NODES",
        patchable: true,
        reason: "top-level workflow still has fake nodes"
      },
      proposal: {
        reason: "replace fake nodes in top-level workflow",
        operations: stubOpsForNodes(versionObs.fakeTop)
      },
      decision: "PATCH_TOP_LEVEL"
    };
  }

  if (versionObs.fakeActive.length > 0 || versionObs.driftCount > 0) {
    return {
      failure: {
        type: "ACTIVE_VERSION_DRIFT",
        patchable: false,
        reason: "activeVersion differs from top-level workflow and still references fake nodes"
      },
      proposal: null,
      decision: "ESCALATE_VERSION_DRIFT"
    };
  }

  if (platformObs.active && platformObs.webhook404 && platformObs.webhookNotRegistered) {
    return {
      failure: {
        type: "WEBHOOK_NOT_REGISTERED",
        patchable: false,
        reason: "workflow active but webhook not registered"
      },
      proposal: null,
      decision: "ESCALATE_PLATFORM"
    };
  }

  if (/ENOTFOUND|getaddrinfo|example\.invalid/i.test(execObs.errorText || "")) {
    return {
      failure: {
        type: "HTTP_DNS_FAILURE",
        patchable: false,
        reason: "runtime dns failure remains after top-level patch"
      },
      proposal: null,
      decision: "ESCALATE_RUNTIME"
    };
  }

  return {
    failure: {
      type: "UNKNOWN",
      patchable: false,
      reason: "no safe repair rule matched"
    },
    proposal: null,
    decision: "ESCALATE_UNKNOWN"
  };
}

module.exports = {
  chooseStrategyV2,
};
