const ALLOWED_OPS = new Set([
  "replace_node_with_stub",
  "set_node_url",
  "set_workflow_active"
]);

const ALLOWED_STUB_NODES = new Set([
  "CRM Upsert",
  "Notify Owner",
  "Follow Up Task"
]);

function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

function findNode(workflow, name) {
  return workflow?.nodes?.find(n => n.name === name) || null;
}

function validateProposal(proposal, workflow) {
  if (!proposal || typeof proposal !== "object") {
    return { ok: false, reason: "proposal_not_object" };
  }

  if (!Array.isArray(proposal.operations) || proposal.operations.length === 0) {
    return { ok: false, reason: "no_operations" };
  }

  if (proposal.operations.length > 3) {
    return { ok: false, reason: "too_many_operations" };
  }

  for (const op of proposal.operations) {
    if (!ALLOWED_OPS.has(op?.type)) {
      return { ok: false, reason: `op_not_allowed:${op?.type}` };
    }

    if (op.type === "replace_node_with_stub") {
      if (!ALLOWED_STUB_NODES.has(op.nodeName)) {
        return { ok: false, reason: `stub_node_not_allowed:${op.nodeName}` };
      }
      const node = findNode(workflow, op.nodeName);
      if (!node) return { ok: false, reason: `node_not_found:${op.nodeName}` };
    }

    if (op.type === "set_node_url") {
      const node = findNode(workflow, op.nodeName);
      if (!node) return { ok: false, reason: `node_not_found:${op.nodeName}` };
      if (node.type !== "n8n-nodes-base.httpRequest") {
        return { ok: false, reason: `node_not_http_request:${op.nodeName}` };
      }
      if (typeof op.url !== "string" || !/^https?:\/\//i.test(op.url)) {
        return { ok: false, reason: `invalid_url:${op.url}` };
      }
      if (/example\.invalid/i.test(op.url)) {
        return { ok: false, reason: "fake_url_not_allowed" };
      }
    }

    if (op.type === "set_workflow_active") {
      if (typeof op.active !== "boolean") {
        return { ok: false, reason: "active_must_be_boolean" };
      }
    }
  }

  return { ok: true };
}

function applyProposal(proposal, workflow) {
  const out = clone(workflow);

  for (const op of proposal.operations) {
    if (op.type === "replace_node_with_stub") {
      const node = out.nodes.find(n => n.name === op.nodeName);
      node.type = "n8n-nodes-base.set";
      node.typeVersion = 3.4;
      node.parameters = {
        keepOnlySet: false,
        values: {
          string: Object.entries(op.fields || {}).map(([name, value]) => ({
            name,
            value: String(value)
          }))
        }
      };
    }

    if (op.type === "set_node_url") {
      const node = out.nodes.find(n => n.name === op.nodeName);
      node.parameters = node.parameters || {};
      node.parameters.url = op.url;
    }

    if (op.type === "set_workflow_active") {
      out.active = op.active;
    }
  }

  return out;
}

module.exports = {
  validateProposal,
  applyProposal,
};
