const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));

const LITELLM_URL = process.env.LITELLM_URL || "http://127.0.0.1:4000/chat/completions";
const LITELLM_KEY = process.env.LITELLM_KEY || "";
const LITELLM_MODEL = process.env.LITELLM_MODEL || "coding";

function extractJson(text) {
  if (!text) return null;

  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch {}
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try { return JSON.parse(text.slice(firstBrace, lastBrace + 1)); } catch {}
  }

  return null;
}

async function proposeRepair({ workflowSummary, failure, maxOps = 2 }) {
  const system = [
    "You are a guarded repair strategist for n8n workflows.",
    "Return JSON only.",
    "You may only propose operations from this allowlist:",
    "replace_node_with_stub, set_node_url, set_workflow_active.",
    "Never invent credentials.",
    "Never rewrite topology.",
    "Never return more than " + maxOps + " operations."
  ].join(" ");

  const user = JSON.stringify({
    workflowSummary,
    failure,
    requiredShape: {
      reason: "string",
      operations: [
        {
          type: "replace_node_with_stub | set_node_url | set_workflow_active",
          nodeName: "string when relevant",
          url: "string when relevant",
          active: "boolean when relevant",
          fields: { key: "value" }
        }
      ]
    }
  }, null, 2);

  const res = await fetch(LITELLM_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LITELLM_KEY}`,
    },
    body: JSON.stringify({
      model: LITELLM_MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`LiteLLM failed ${res.status}: ${text}`);
  }

  let content = "";
  try {
    const data = JSON.parse(text);
    content = data?.choices?.[0]?.message?.content || "";
  } catch {
    content = text;
  }

  return extractJson(content);
}

module.exports = {
  proposeRepair,
};
