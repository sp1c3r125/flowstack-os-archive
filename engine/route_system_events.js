const ROUTES = [
  {
    from: "lead_intake_crm",
    to: "missed_call_recovery",
    fields: {
      leadId: "leadId",
      phone: "phone"
    }
  },
  {
    from: "lead_intake_crm",
    to: "reengagement_followup",
    fields: {
      leadId: "leadId",
      priority: "priority"
    }
  },
  {
    from: "lead_intake_crm",
    to: "daily_reporting",
    fields: {
      leadSummary: "leadSummary"
    }
  },
  {
    from: "missed_call_recovery",
    to: "daily_reporting",
    fields: {
      callbackSummary: "callbackSummary"
    }
  },
  {
    from: "reengagement_followup",
    to: "daily_reporting",
    fields: {
      reengagementSummary: "reengagementSummary"
    }
  }
];

function getRoutes() {
  return ROUTES;
}

function getRoutesTo(templateId) {
  return ROUTES.filter(r => r.to === templateId);
}

module.exports = {
  getRoutes,
  getRoutesTo
};
