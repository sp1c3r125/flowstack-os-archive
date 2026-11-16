const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
const { getRoutes } = require("./route_system_events.js");
const { appendEvent } = require("./event_ledger.js");
const { validateDispatchPayload } = require("./validate_dispatch_payloads.js");

const N8N_URL = (process.env.N8N_URL || "http://localhost:5678").replace(/\/$/, "");

const WEBHOOK_PATHS = {
  lead_intake_crm: "flowstack-lead-intake",
  missed_call_recovery: "flowstack-missed-call",
  reengagement_followup: "flowstack-reengagement"
};

function getWebhookPath(templateId) {
  return WEBHOOK_PATHS[templateId] || null;
}

function buildDispatchPayload(route, sourcePayload) {
  const out = {};
  for (const [fromField, toField] of Object.entries(route.fields || {})) {
    out[toField] = sourcePayload?.[fromField];
  }
  return out;
}

function getOutgoingRoutes(fromTemplateId) {
  return getRoutes().filter(r => r.from === fromTemplateId);
}

async function dispatchRoute({ route, sourcePayload, mode = "dryRun" }) {
  const payload = buildDispatchPayload(route, sourcePayload);
  const validation = validateDispatchPayload(route, payload);
  const webhookPath = getWebhookPath(route.to);

  const result = {
    from: route.from,
    to: route.to,
    mode,
    payload,
    validation,
    webhookPath,
    dispatched: false,
    response: null
  };

  if (!validation.ok) {
    result.response = { status: "blocked_invalid_payload" };
    appendEvent({
      kind: "dispatch_blocked",
      from: route.from,
      to: route.to,
      mode,
      payload,
      validation
    });
    return result;
  }

  if (mode === "dryRun") {
    result.dispatched = true;
    result.response = { status: "simulated" };
    appendEvent({
      kind: "dispatch",
      from: route.from,
      to: route.to,
      mode,
      payload,
      validation
    });
    return result;
  }

  if (!webhookPath) {
    result.response = { status: "no_webhook_path" };
    appendEvent({
      kind: "dispatch",
      from: route.from,
      to: route.to,
      mode,
      payload,
      validation,
      status: "no_webhook_path"
    });
    return result;
  }

  const res = await fetch(`${N8N_URL}/webhook/${webhookPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  result.dispatched = res.ok;
  result.response = {
    status: res.status,
    body: data
  };

  appendEvent({
    kind: "dispatch",
    from: route.from,
    to: route.to,
    mode,
    payload,
    validation,
    status: res.status,
    ok: res.ok
  });

  return result;
}

async function dispatchFromSource({ fromTemplateId, sourcePayload, mode = "dryRun" }) {
  const routes = getOutgoingRoutes(fromTemplateId);
  const results = [];

  for (const route of routes) {
    results.push(await dispatchRoute({ route, sourcePayload, mode }));
  }

  return results;
}

function buildLeadIntakeSampleOutput() {
  return {
    leadId: "lead-demo-001",
    crmRecordId: "crm-demo-001",
    priority: "warm",
    owner: "sales-owner",
    phone: "09000000001",
    email: "test@test.com",
    leadSummary: "lead-summary-stub"
  };
}

function buildMissedCallSampleOutput() {
  return {
    callbackTaskId: "callback-demo-001",
    crmNoteStatus: "logged_stub",
    phone: "09000000001",
    leadId: "lead-demo-001",
    callbackSummary: "callback-summary-stub"
  };
}

function buildReengagementSampleOutput() {
  return {
    reengagementStatus: "sent_stub",
    leadId: "lead-demo-001",
    priority: "warm",
    reengagementSummary: "reengagement-summary-stub"
  };
}

module.exports = {
  getWebhookPath,
  buildDispatchPayload,
  getOutgoingRoutes,
  dispatchRoute,
  dispatchFromSource,
  buildLeadIntakeSampleOutput,
  buildMissedCallSampleOutput,
  buildReengagementSampleOutput
};
