const CONTRACTS = {
  lead_intake_crm: {
    workflowName: "flowstack_lead_intake_crm",
    inputs: ["source", "businessType", "email", "phone"],
    outputs: ["leadId", "crmRecordId", "priority", "owner", "phone", "email", "leadSummary"],
    emits: {
      leadId: "lead-demo-001",
      crmRecordId: "crm-demo-001",
      priority: "warm",
      owner: "sales-owner",
      leadSummary: "lead-summary-stub"
    }
  },

  missed_call_recovery: {
    workflowName: "flowstack_missed_call_recovery",
    inputs: ["phone", "leadId"],
    optionalInputs: ["caller"],
    outputs: ["callbackTaskId", "crmNoteStatus", "phone", "leadId", "callbackSummary"],
    emits: {
      callbackTaskId: "callback-demo-001",
      crmNoteStatus: "logged_stub",
      callbackSummary: "callback-summary-stub"
    },
    dependsOn: ["lead_intake_crm"]
  },

  reengagement_followup: {
    workflowName: "flowstack_reengagement_followup",
    inputs: ["leadId", "priority"],
    optionalInputs: ["lastContactAt"],
    outputs: ["reengagementStatus", "leadId", "priority", "reengagementSummary"],
    emits: {
      reengagementStatus: "sent_stub",
      reengagementSummary: "reengagement-summary-stub"
    },
    dependsOn: ["lead_intake_crm"]
  },

  daily_reporting: {
    workflowName: "flowstack_daily_reporting",
    inputs: [],
    optionalInputs: ["leadSummary", "callbackSummary", "reengagementSummary"],
    outputs: ["ownerReportStatus", "metricsSnapshot"],
    emits: {
      ownerReportStatus: "sent_stub"
    },
    dependsOn: ["lead_intake_crm", "missed_call_recovery", "reengagement_followup"]
  }
};

function getContracts() {
  return CONTRACTS;
}

function getContract(templateId) {
  const c = CONTRACTS[templateId];
  if (!c) throw new Error(`Unknown contract for templateId: ${templateId}`);
  return c;
}

module.exports = {
  getContracts,
  getContract
};
