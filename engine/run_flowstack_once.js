const { saveWorkflow, deployWorkflow, testWebhook, getWorkflow } = require("./flowstack_tools.js");
const { runRepairSupervisor } = require("./repair_supervisor.js");
const { validateSecondaryRuntime } = require("./repair_secondary_validator.js");

function buildWorkflow() {
  const demoMode = String(process.env.FLOWSTACK_DEMO_MODE || "1") === "1";

  const crmNode = demoMode
    ? {
        id: "5",
        name: "CRM Upsert",
        type: "n8n-nodes-base.set",
        typeVersion: 3.4,
        position: [1000, 0],
        parameters: {
          keepOnlySet: false,
          values: {
            string: [
              { name: "crmStatus", value: "upserted_stub" },
              { name: "crmRecordId", value: "crm-demo-001" }
            ]
          }
        }
      }
    : {
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
      };

  const notifyNode = demoMode
    ? {
        id: "6",
        name: "Notify Owner",
        type: "n8n-nodes-base.set",
        typeVersion: 3.4,
        position: [1250, 0],
        parameters: {
          keepOnlySet: false,
          values: {
            string: [
              { name: "ownerNotificationStatus", value: "sent_stub" }
            ]
          }
        }
      }
    : {
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
      };

  const followUpNode = demoMode
    ? {
        id: "7",
        name: "Follow Up Task",
        type: "n8n-nodes-base.set",
        typeVersion: 3.4,
        position: [1500, 0],
        parameters: {
          keepOnlySet: false,
          values: {
            string: [
              { name: "followUpStatus", value: "scheduled_stub" },
              { name: "followUpWaitHours", value: "24" }
            ]
          }
        }
      }
    : {
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
      };

  return {
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
              { name: "owner", value: "sales-owner" }
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
      crmNode,
      notifyNode,
      followUpNode
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
}

(async () => {
  try {
    const workflow = buildWorkflow();
    const webhookPath = "flowstack-lead-intake";
    const testPayload = {
      email: "test@test.com",
      phone: "09000000001",
      source: "instagram",
      businessType: "dental clinic"
    };

    console.log("=== BUILD ===");
    console.log({ demoMode: String(process.env.FLOWSTACK_DEMO_MODE || "1") === "1" });
    const savedPath = saveWorkflow(workflow.name, workflow);
    console.log({ savedPath });

    console.log("=== DEPLOY ===");
    const deployedWorkflow = await deployWorkflow(savedPath);
    console.log(deployedWorkflow);

    console.log("=== INITIAL TEST ===");
    const initialTestResult = await testWebhook(webhookPath, testPayload);
    console.log(initialTestResult);

    console.log("=== GUARDED REPAIR ===");
    const repairResult = await runRepairSupervisor({
      workflowIdOrName: deployedWorkflow.id || workflow.name,
      webhookPath,
      testPayload,
      maxAttempts: 3,
      allowLlm: String(process.env.ENABLE_LLM_REPAIR || "0") === "1"
    });
    console.log(JSON.stringify({ repairResult }, null, 2));

    console.log("=== SECONDARY VALIDATION ===");
    const finalWorkflow = await getWorkflow(deployedWorkflow.id || workflow.name);
    const secondaryValidation = validateSecondaryRuntime(finalWorkflow, repairResult);
    console.log(JSON.stringify({ secondaryValidation }, null, 2));

    process.exit(0);
  } catch (err) {
    console.error("run_flowstack_once failed:");
    console.error(err);
    process.exit(1);
  }
})();
