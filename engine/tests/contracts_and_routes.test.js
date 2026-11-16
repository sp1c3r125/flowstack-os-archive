"use strict";

// Unit tests for the deterministic core: contracts, routes and payload validation.
// No network, no environment, no files written. Fake data only.

const test = require("node:test");
const assert = require("node:assert/strict");

const { getContract, getContracts } = require("../system_contracts");
const { getRoutes, getRoutesTo } = require("../route_system_events");
const { validateDispatchPayload } = require("../validate_dispatch_payloads");

test("getContract returns a known contract and throws for an unknown one", () => {
  assert.equal(getContract("lead_intake_crm").workflowName, "flowstack_lead_intake_crm");
  assert.throws(() => getContract("does_not_exist"), /Unknown contract for templateId: does_not_exist/);
});

test("every route connects two known contracts", () => {
  const contracts = getContracts();
  for (const route of getRoutes()) {
    assert.ok(contracts[route.from], `unknown source ${route.from}`);
    assert.ok(contracts[route.to], `unknown target ${route.to}`);
  }
});

test("every routed field is an output of the source and an input of the target", () => {
  for (const route of getRoutes()) {
    const from = getContract(route.from);
    const to = getContract(route.to);
    const accepted = new Set([...(to.inputs || []), ...(to.optionalInputs || [])]);
    for (const [sourceField, targetField] of Object.entries(route.fields)) {
      assert.ok(from.outputs.includes(sourceField), `${route.from} does not output ${sourceField}`);
      assert.ok(accepted.has(targetField), `${route.to} does not accept ${targetField}`);
    }
  }
});

test("every contract dependency is itself a contract, and the graph has no cycles", () => {
  const contracts = getContracts();
  const visiting = new Set();
  const done = new Set();
  const visit = (id) => {
    assert.ok(contracts[id], `unknown dependency ${id}`);
    assert.ok(!visiting.has(id), `cycle through ${id}`);
    if (done.has(id)) return;
    visiting.add(id);
    for (const dep of contracts[id].dependsOn || []) visit(dep);
    visiting.delete(id);
    done.add(id);
  };
  Object.keys(contracts).forEach(visit);
});

test("getRoutesTo returns only routes that end at the given template", () => {
  const routes = getRoutesTo("daily_reporting");
  assert.equal(routes.length, 3);
  assert.ok(routes.every((r) => r.to === "daily_reporting"));
  assert.deepEqual(getRoutesTo("lead_intake_crm"), []);
});

test("validateDispatchPayload accepts a complete payload", () => {
  const route = getRoutes().find((r) => r.to === "missed_call_recovery");
  const result = validateDispatchPayload(route, { leadId: "lead-001", phone: "0900 000 0001" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.missingRequired, []);
  assert.deepEqual(result.unknownFields, []);
  assert.equal(result.route, "lead_intake_crm -> missed_call_recovery");
});

test("validateDispatchPayload accepts optional fields", () => {
  const route = getRoutes().find((r) => r.to === "missed_call_recovery");
  const result = validateDispatchPayload(route, { leadId: "lead-001", phone: "0900 000 0001", caller: "0900 000 0002" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.unknownFields, []);
});

test("validateDispatchPayload reports missing required fields, treating '', null and undefined as missing", () => {
  const route = getRoutes().find((r) => r.to === "missed_call_recovery");
  const result = validateDispatchPayload(route, { leadId: "", phone: null });
  assert.equal(result.ok, false);
  assert.deepEqual(result.missingRequired.sort(), ["leadId", "phone"]);
});

test("validateDispatchPayload reports unknown fields without failing the payload", () => {
  const route = getRoutes().find((r) => r.to === "reengagement_followup");
  const result = validateDispatchPayload(route, { leadId: "lead-001", priority: "warm", surprise: 1 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.unknownFields, ["surprise"]);
});

test("validateDispatchPayload treats a missing payload as all fields missing", () => {
  const route = getRoutes().find((r) => r.to === "reengagement_followup");
  const result = validateDispatchPayload(route, undefined);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missingRequired.sort(), ["leadId", "priority"]);
});

test("a target with no required inputs accepts an empty payload", () => {
  const route = getRoutes().find((r) => r.to === "daily_reporting");
  assert.equal(validateDispatchPayload(route, {}).ok, true);
});
