const TEMPLATES = [
  {
    id: "lead_intake_crm",
    name: "Lead Intake + CRM",
    category: "sales",
    triggers: ["webhook", "form_submit"],
    outputs: ["normalized_lead", "crm_record", "owner_notification", "followup_task"],
    dependencies: [],
    description: "Capture inbound lead, normalize fields, score, upsert to CRM, notify owner, schedule follow-up."
  },
  {
    id: "missed_call_recovery",
    name: "Missed Call Recovery",
    category: "sales",
    triggers: ["missed_call_webhook"],
    outputs: ["callback_task", "sms_reply", "crm_note"],
    dependencies: ["lead_intake_crm"],
    description: "When a missed call occurs, create callback task, send recovery message, and log CRM note."
  },
  {
    id: "booking_reminder",
    name: "Booking Reminder",
    category: "operations",
    triggers: ["booking_created", "schedule_event"],
    outputs: ["reminder_message", "attendance_update"],
    dependencies: [],
    description: "Send reminders before booking and update attendance state after scheduled event."
  },
  {
    id: "reengagement_followup",
    name: "Re-engagement Follow-up",
    category: "sales",
    triggers: ["stale_lead", "no_reply_timeout"],
    outputs: ["reengagement_message", "crm_activity"],
    dependencies: ["lead_intake_crm"],
    description: "Recover stale leads with follow-up sequences and CRM activity logging."
  },
  {
    id: "daily_reporting",
    name: "Daily Reporting",
    category: "analytics",
    triggers: ["schedule_daily"],
    outputs: ["owner_report", "metrics_snapshot"],
    dependencies: ["lead_intake_crm"],
    description: "Aggregate daily metrics and send summary report to operator/owner."
  }
];

function listTemplates() {
  return TEMPLATES;
}

function findTemplatesByKeywords(input) {
  const q = String(input || "").toLowerCase();
  return TEMPLATES.filter(t => {
    const blob = `${t.id} ${t.name} ${t.category} ${t.description} ${t.triggers.join(" ")} ${t.outputs.join(" ")}`.toLowerCase();
    return q.split(/\s+/).every(word => !word || blob.includes(word)) ||
      ["lead","crm","booking","report","call","followup","reengagement"].some(k => q.includes(k) && blob.includes(k));
  });
}

module.exports = {
  listTemplates,
  findTemplatesByKeywords,
};
