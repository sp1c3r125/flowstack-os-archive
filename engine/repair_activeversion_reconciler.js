function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

function nodeMap(nodes) {
  const out = {};
  for (const n of Array.isArray(nodes) ? nodes : []) {
    out[n.name] = n;
  }
  return out;
}

function reconcileActiveVersion(workflow) {
  const out = clone(workflow);

  if (!out.activeVersion || !Array.isArray(out.activeVersion.nodes)) {
    return {
      changed: false,
      workflow: out,
      reason: "no_active_version"
    };
  }

  const top = nodeMap(out.nodes || []);
  let changed = false;

  out.activeVersion.nodes = (out.activeVersion.nodes || []).map(n => {
    const topNode = top[n.name];
    if (!topNode) return n;

    const a = JSON.stringify({
      type: n.type,
      parameters: n.parameters || {}
    });
    const b = JSON.stringify({
      type: topNode.type,
      parameters: topNode.parameters || {}
    });

    if (a !== b) {
      changed = true;
      return clone(topNode);
    }

    return n;
  });

  return {
    changed,
    workflow: out,
    reason: changed ? "active_version_reconciled" : "already_reconciled"
  };
}

module.exports = {
  reconcileActiveVersion,
};
