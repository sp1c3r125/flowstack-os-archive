function getNodeMap(nodes) {
  const out = {};
  for (const n of Array.isArray(nodes) ? nodes : []) {
    out[n.name] = {
      type: n.type,
      url: n.parameters?.url || null
    };
  }
  return out;
}

function findVersionDrift(workflow) {
  const top = getNodeMap(workflow?.nodes || []);
  const active = getNodeMap(workflow?.activeVersion?.nodes || []);
  const diffs = [];

  const allNames = new Set([...Object.keys(top), ...Object.keys(active)]);
  for (const name of allNames) {
    const a = top[name] || null;
    const b = active[name] || null;
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      diffs.push({
        nodeName: name,
        topLevel: a,
        activeVersion: b
      });
    }
  }

  const fakeTop = Object.entries(top)
    .filter(([_, v]) => /example\.invalid/i.test(String(v?.url || "")))
    .map(([name]) => name);

  const fakeActive = Object.entries(active)
    .filter(([_, v]) => /example\.invalid/i.test(String(v?.url || "")))
    .map(([name]) => name);

  return {
    hasActiveVersion: !!workflow?.activeVersion,
    driftCount: diffs.length,
    diffs,
    fakeTop,
    fakeActive
  };
}

module.exports = {
  findVersionDrift,
};
