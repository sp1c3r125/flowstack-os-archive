const { saveWorkflow } = require("./flowstack_tools.js");
const { getContract } = require("./system_contracts.js");
const { getRoutesTo } = require("./route_system_events.js");

function webhookNode(id, name, pathName, position) {
  return {
    id,
    name,
    type: "n8n-nodes-base.webhook",
    typeVersion: 2,
    position,
    parameters: {
      path: pathName,
      httpMethod: "POST",
      responseMode: "lastNode"
    }
  };
}

function scheduleNode(id, name, cron, position) {
  return {
    id,
    name,
    type: "n8n-nodes-base.scheduleTrigger",
    typeVersion: 1.2,
    position,
    parameters: {
      rule: {
        interval: [
          {
            field: "cronExpression",
            expression: cron
          }
        ]
      }
    }
  };
}

function setNode(id, name, fields, position) {
  return {
    id,
    name,
    type: "n8n-nodes-base.set",
    typeVersion: 3.4,
    position,
    parameters: {
      keepOnlySet: false,
      values: {
        string: Object.entries(fields).map(([k, v]) => ({
          name: k,
          value: String(v)
        }))
      }
    }
  };
}

function codeNode(id, name, jsCode, position) {
  return {
    id,
    name,
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position,
    parameters: {
      mode: "runOnceForAllItems",
      jsCode
    }
  };
}

function connectLinear(nodes) {
  const connections = {};
  for (let i = 0; i < nodes.length - 1; i++) {
    connections[nodes[i].name] = {
      main: [[{ node: nodes[i + 1].name, type: "main", index: 0 }]]
    };
  }
  return connections;
}

function incomingRoutes(templateId) {
  return getRoutesTo(templateId);
}

function compileLeadIntakeCrm() {
  const contract = getContract("lead_intake_crm");
  const nodes = [
    webhookNode("1", "Trigger", "flowstack-lead-intake", [0, 0]),
    setNode("2", "Normalize Lead", {
      source: "={{$json.source || 'unknown'}}",
      businessType: "={{$json.businessType || $json.business_type || 'unknown'}}",
      email: "={{$json.email || ''}}",
      phone: "={{$json.phone || ''}}"
    }, [250, 0]),
    codeNode("3", "Generate Adapter Output Shape", `
const itemsIn = $input.all();
return itemsIn.map(item => {
  item.json.leadId = "lead-demo-001";
  item.json.crmRecordId = "crm-demo-001";
  item.json.priority = item.json.email && item.json.phone ? "warm" : "cold";
  item.json.owner = "sales-owner";
  item.json.leadSummary = "lead-summary-stub";
  item.json.crmAction = "crm_upsert";
  item.json.crmMode = "adapter";
  return item;
});
    `, [500, 0]),
    setNode("4", "Emit Lead Contract", {
      leadId: "={{$json.leadId}}",
      crmRecordId: "={{$json.crmRecordId}}",
      priority: "={{$json.priority}}",
      owner: "={{$json.owner}}",
      phone: "={{$json.phone}}",
      email: "={{$json.email}}",
      leadSummary: "={{$json.leadSummary}}",
      crmAction: "={{$json.crmAction}}",
      crmMode: "={{$json.crmMode}}"
    }, [750, 0])
  ];

  return {
    name: contract.workflowName,
    active: false,
    settings: {},
    nodes,
    connections: connectLinear(nodes),
    meta: {
      templateId: "lead_intake_crm",
      contract,
      adapters: ["crm"],
      outgoingRoutes: incomingRoutes("lead_intake_crm")
    }
  };
}

function compileMissedCallRecovery() {
  const contract = getContract("missed_call_recovery");
  const nodes = [
    webhookNode("1", "Trigger", "flowstack-missed-call", [0, 0]),
    setNode("2", "Normalize Route Input", {
      phone: "={{$json.phone || $json.caller || ''}}",
      leadId: "={{$json.leadId || 'lead-demo-001'}}"
    }, [250, 0]),
    setNode("3", "Emit Messaging Output Shape", {
      callbackTaskId: contract.emits.callbackTaskId,
      crmNoteStatus: contract.emits.crmNoteStatus,
      callbackSummary: contract.emits.callbackSummary,
      phone: "={{$json.phone}}",
      leadId: "={{$json.leadId}}",
      messagingAction: "send_message",
      messagingMode: "adapter"
    }, [500, 0])
  ];

  return {
    name: contract.workflowName,
    active: false,
    settings: {},
    nodes,
    connections: connectLinear(nodes),
    meta: {
      templateId: "missed_call_recovery",
      contract,
      adapters: ["messaging"],
      incomingRoutes: incomingRoutes("missed_call_recovery"),
      outgoingRoutes: incomingRoutes("missed_call_recovery")
    }
  };
}

function compileReengagementFollowup() {
  const contract = getContract("reengagement_followup");
  const nodes = [
    webhookNode("1", "Trigger", "flowstack-reengagement", [0, 0]),
    setNode("2", "Normalize Route Input", {
      leadId: "={{$json.leadId || 'lead-demo-001'}}",
      priority: "={{$json.priority || 'warm'}}"
    }, [250, 0]),
    setNode("3", "Emit Messaging Output Shape", {
      reengagementStatus: contract.emits.reengagementStatus,
      reengagementSummary: contract.emits.reengagementSummary,
      leadId: "={{$json.leadId}}",
      priority: "={{$json.priority}}",
      messagingAction: "send_message",
      messagingMode: "adapter"
    }, [500, 0])
  ];

  return {
    name: contract.workflowName,
    active: false,
    settings: {},
    nodes,
    connections: connectLinear(nodes),
    meta: {
      templateId: "reengagement_followup",
      contract,
      adapters: ["messaging"],
      incomingRoutes: incomingRoutes("reengagement_followup"),
      outgoingRoutes: incomingRoutes("reengagement_followup")
    }
  };
}

function compileDailyReporting() {
  const contract = getContract("daily_reporting");
  const nodes = [
    scheduleNode("1", "Daily Trigger", "0 8 * * *", [0, 0]),
    setNode("2", "Aggregate System Summaries", {
      leadSummary: "lead-summary-stub",
      callbackSummary: "callback-summary-stub",
      reengagementSummary: "reengagement-summary-stub"
    }, [250, 0]),
    codeNode("3", "Build Metrics Snapshot", `
const itemsIn = $input.all();
return itemsIn.map(item => {
  item.json.metricsSnapshot = "metrics-demo-snapshot";
  item.json.reportingAction = "send_report";
  item.json.reportingMode = "adapter";
  return item;
});
    `, [500, 0]),
    setNode("4", "Emit Reporting Output Shape", {
      ownerReportStatus: contract.emits.ownerReportStatus,
      metricsSnapshot: "={{$json.metricsSnapshot}}",
      reportingAction: "={{$json.reportingAction}}",
      reportingMode: "={{$json.reportingMode}}"
    }, [750, 0])
  ];

  return {
    name: contract.workflowName,
    active: false,
    settings: {},
    nodes,
    connections: connectLinear(nodes),
    meta: {
      templateId: "daily_reporting",
      contract,
      adapters: ["reporting"],
      incomingRoutes: incomingRoutes("daily_reporting")
    }
  };
}

function compileFromTemplateId(templateId) {
  switch (templateId) {
    case "lead_intake_crm":
      return compileLeadIntakeCrm();
    case "missed_call_recovery":
      return compileMissedCallRecovery();
    case "reengagement_followup":
      return compileReengagementFollowup();
    case "daily_reporting":
      return compileDailyReporting();
    default:
      throw new Error(`Unsupported templateId: ${templateId}`);
  }
}

function compileSystemPlanV3(deterministicPlan) {
  const compiled = [];

  for (const wf of deterministicPlan.workflows) {
    const workflow = compileFromTemplateId(wf.templateId);
    const savedPath = saveWorkflow(workflow.name, workflow);

    compiled.push({
      templateId: wf.templateId,
      workflowName: workflow.name,
      savedPath,
      trigger: wf.trigger,
      dependencies: wf.dependencies || [],
      contract: workflow.meta.contract,
      meta: workflow.meta
    });
  }

  return {
    request: deterministicPlan.request,
    deploymentOrder: deterministicPlan.deploymentOrder,
    compiled
  };
}

module.exports = {
  compileSystemPlanV3
};
