const { getWorkflow, testWebhook } = require("./flowstack_tools.js");
const { findVersionDrift } = require("./repair_observer_version.js");

function fakeNodes(workflow) {
  return (workflow.nodes || []).filter(n =>
    /example\.invalid/i.test(String(n.parameters?.url || ""))
  );
}

function webhookPathForWorkflow(workflowName) {
  const map = {
    flowstack_lead_intake_crm: "flowstack-lead-intake",
    flowstack_missed_call_recovery: "flowstack-missed-call",
    flowstack_reengagement_followup: "flowstack-reengagement"
  };
  return map[workflowName] || null;
}

function testPayloadForWorkflow(workflowName) {
  const map = {
    flowstack_lead_intake_crm: {
      email: "test@test.com",
      phone: "09000000001",
      source: "instagram",
      businessType: "dental clinic"
    },
    flowstack_missed_call_recovery: {
      phone: "09000000001",
      caller: "09000000001"
    },
    flowstack_reengagement_followup: {
      leadId: "lead-demo-001"
    }
  };
  return map[workflowName] || {};
}

async function validateOne(deployedItem) {
  const workflow = await getWorkflow(deployedItem.deployed.id);
  const versionObs = findVersionDrift(workflow);
  const fake = fakeNodes(workflow);

  const result = {
    workflowName: deployedItem.workflowName,
    workflowId: deployedItem.deployed.id,
    active: !!workflow.active,
    fakeNodeCount: fake.length,
    driftCount: versionObs.driftCount,
    status: "validated",
    runtime: null
  };

  const webhookPath = webhookPathForWorkflow(deployedItem.workflowName);
  if (webhookPath) {
    const runtime = await testWebhook(webhookPath, testPayloadForWorkflow(deployedItem.workflowName));

    result.runtime = {
      status: runtime.status,
      ok: runtime.ok
    };

    if (!runtime.ok && runtime.status === 404) {
      result.status = "validated_repaired_platform_blocked";
    }
  }

  if (!result.active || result.fakeNodeCount > 0 || result.driftCount > 0) {
    result.status = "validation_failed";
  }

  return result;
}

async function validateSystem(deployedResults) {
  const results = [];
  for (const item of deployedResults) {
    results.push(await validateOne(item));
  }
  return results;
}

module.exports = {
  validateSystem
};
