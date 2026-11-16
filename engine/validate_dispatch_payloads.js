const { getContract } = require("./system_contracts.js");

function validateDispatchPayload(route, payload) {
  const toContract = getContract(route.to);

  const required = new Set(toContract.inputs || []);
  const optional = new Set(toContract.optionalInputs || []);
  const allowed = new Set([...required, ...optional]);

  const missingRequired = [];
  for (const field of required) {
    if (payload?.[field] === undefined || payload?.[field] === null || payload?.[field] === "") {
      missingRequired.push(field);
    }
  }

  const unknownFields = Object.keys(payload || {}).filter(k => !allowed.has(k));

  return {
    route: `${route.from} -> ${route.to}`,
    requiredInputs: [...required],
    optionalInputs: [...optional],
    missingRequired,
    unknownFields,
    ok: missingRequired.length === 0
  };
}

module.exports = {
  validateDispatchPayload
};
