const { StateGraph } = require("@langchain/langgraph");
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
const {
  saveWorkflow,
  deployWorkflow,
  testWebhook,
} = require("./flowstack_tools.js");

const LITELLM_BASE = process.env.LITELLM_BASE || "http://127.0.0.1:4000";
const MODEL = process.env.LITELLM_MODEL || "coding";
const KEY = process.env.LITELLM_KEY || "";

async function callModel(system, prompt) {
  const res = await fetch(`${LITELLM_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
    }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`LiteLLM error ${res.status}: ${text}`);
  const json = JSON.parse(text);
  return json?.choices?.[0]?.message?.content ?? "";
}

async function planner(state) {
  console.log("\n=== PLANNER ===");
  const system = "You are a Flowstack OS planner for lead capture + CRM pipelines. Return concise implementation notes only.";
  const prompt = `Request:\n${state.input}\n\nFocus on trigger, normalize, dedupe, score, CRM, notify, follow-up.`;
  const plan = await callModel(system, prompt);
  return { ...state, plan };
}

function compiler(state) {
  console.log("\n=== COMPILER ===");
  const workflow = {
    name: "flowstack_crm_pipeline",
    active: false,
    settings: {},
    nodes: [
      {
        id: "1",
        name: "Trigger",
        type: "n8n-nodes-base.webhook",
        typeVersion: 2,
        position: [0, 0],
        parameters: {
          path: "flowstack-lead-intake",
          httpMethod: "POST",
          responseMode: "lastNode"
        }
      },
      {
        id: "2",
        name: "Normalize Lead",
        type: "n8n-nodes-base.set",
        typeVersion: 3.4,
        position: [250, 0],
        parameters: {
          keepOnlySet: false,
          values: {
            string: [
              { name: "source", value: "={{$json.source || 'unknown'}}" },
              { name: "businessType", value: "={{$json.businessType || $json.business_type || 'unknown'}}" },
              { name: "email", value: "={{$json.email || ''}}" },
              { name: "phone", value: "={{$json.phone || ''}}" },
              { name: "owner", value: "sales-owner" },
              { name: "plannerNotes", value: state.plan || "" }
            ]
          }
        }
      },
      {
        id: "3",
        name: "Dedupe Lead",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [500, 0],
        parameters: {
          mode: "runOnceForAllItems",
          jsCode: `const itemsIn = $input.all(); return itemsIn.map(item => { const email = item.json.email || ""; const phone = item.json.phone || ""; item.json.dedupeKey = email ? email.toLowerCase() : phone; item.json.isDuplicate = false; return item; });`
        }
      },
      {
        id: "4",
        name: "Score Lead",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [750, 0],
        parameters: {
          mode: "runOnceForAllItems",
          jsCode: `const itemsIn = $input.all(); return itemsIn.map(item => { const bt = (item.json.businessType || "").toLowerCase(); const src = (item.json.source || "").toLowerCase(); let score = 0; if (["clinic","agency","real estate","gym","dental","medspa"].some(v => bt.includes(v))) score += 40; if (["instagram","facebook","ads","organic"].some(v => src.includes(v))) score += 20; if (item.json.email) score += 20; if (item.json.phone) score += 20; item.json.leadScore = score; item.json.priority = score >= 70 ? "hot" : score >= 40 ? "warm" : "cold"; return item; });`
        }
      },
      {
        id: "5",
        name: "CRM Upsert",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [1000, 0],
        parameters: {
          method: "POST",
          url: "https://example.invalid/crm/upsert",
          sendBody: true,
          specifyBody: "json",
          jsonBody: "={{$json}}"
        }
      },
      {
        id: "6",
        name: "Notify Owner",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [1250, 0],
        parameters: {
          method: "POST",
          url: "https://example.invalid/notify-owner",
          sendBody: true,
          specifyBody: "json",
          jsonBody: "={{ { owner: $json.owner, priority: $json.priority, leadScore: $json.leadScore, email: $json.email, phone: $json.phone } }}"
        }
      },
      {
        id: "7",
        name: "Follow Up Task",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [1500, 0],
        parameters: {
          method: "POST",
          url: "https://example.invalid/followup-task",
          sendBody: true,
          specifyBody: "json",
          jsonBody: "={{ { waitHours: 24, email: $json.email, phone: $json.phone, priority: $json.priority, source: $json.source } }}"
        }
      }
    ],
    connections: {
      "Trigger": { main: [[{ node: "Normalize Lead", type: "main", index: 0 }]] },
      "Normalize Lead": { main: [[{ node: "Dedupe Lead", type: "main", index: 0 }]] },
      "Dedupe Lead": { main: [[{ node: "Score Lead", type: "main", index: 0 }]] },
      "Score Lead": { main: [[{ node: "CRM Upsert", type: "main", index: 0 }]] },
      "CRM Upsert": { main: [[{ node: "Notify Owner", type: "main", index: 0 }]] },
      "Notify Owner": { main: [[{ node: "Follow Up Task", type: "main", index: 0 }]] }
    }
  };

  return {
    ...state,
    workflow,
    webhookPath: "flowstack-lead-intake",
    testPayload: {
      email: "test@test.com",
      phone: "09000000001",
      source: "instagram",
      businessType: "dental clinic"
    }
  };
}

async function validator(state) {
  console.log("\n=== VALIDATOR ===");
  return { ...state, valid: true };
}

async function saver(state) {
  console.log("\n=== SAVER ===");
  const savedPath = saveWorkflow(state.workflow.name, state.workflow);
  return { ...state, savedPath };
}

async function deployer(state) {
  console.log("\n=== DEPLOYER ===");
  const deployedWorkflow = await deployWorkflow(state.savedPath);
  return { ...state, deployedWorkflow };
}

async function tester(state) {
  console.log("\n=== TESTER ===");
  const initialTestResult = await testWebhook(state.webhookPath, state.testPayload);
  return { ...state, initialTestResult };
}

const graph = new StateGraph({
  channels: {
    input: { value: (x, y) => y ?? x, default: () => "" },
    plan: { value: (x, y) => y ?? x, default: () => "" },
    workflow: { value: (x, y) => y ?? x, default: () => null },
    webhookPath: { value: (x, y) => y ?? x, default: () => "" },
    testPayload: { value: (x, y) => y ?? x, default: () => null },
    valid: { value: (x, y) => y ?? x, default: () => false },
    savedPath: { value: (x, y) => y ?? x, default: () => "" },
    deployedWorkflow: { value: (x, y) => y ?? x, default: () => null },
    initialTestResult: { value: (x, y) => y ?? x, default: () => null }
  },
});

graph.addNode("planner", planner);
graph.addNode("compiler", compiler);
graph.addNode("validator", validator);
graph.addNode("saver", saver);
graph.addNode("deployer", deployer);
graph.addNode("tester", tester);

graph.addEdge("planner", "compiler");
graph.addEdge("compiler", "validator");
graph.addEdge("validator", "saver");
graph.addEdge("saver", "deployer");
graph.addEdge("deployer", "tester");

graph.setEntryPoint("planner");

const app = graph.compile();
module.exports = { app };
