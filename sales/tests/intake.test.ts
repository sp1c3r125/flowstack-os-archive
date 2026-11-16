// Unit tests for package routing. The recommendation is a pure function of the
// form answers and the leakage figure: same input, same output, no model involved.
import test from "node:test";
import assert from "node:assert/strict";
import {
  recommendPackageFromInputs,
  buildQualificationReason,
  buildLeadCapturePayload,
} from "../services/intake";
import { enterpriseSetupFloor, serviceCatalog } from "../services/catalog";
import { INITIAL_CALCULATOR_DATA, INITIAL_INGEST_DATA, type AppState, type IngestData } from "../types";

// A quiet business: nothing that pushes the tier up.
const quiet: IngestData = {
  contactName: "Sample Contact",
  agencyName: "Sample Tours",
  contactEmail: "contact@sampletours.example",
  phone: "0900 000 0001",
  niche: "Hospitality / Tourism",
  leadSources: [],
  messagesPerDay: 0,
  primaryProblem: "Slow replies",
  problemDetail: "",
  needsBooking: false,
  multipleOffers: false,
  needsStaffRouting: false,
  crmUsed: "",
  bookingLink: "",
};

const ask = (overrides: Partial<IngestData>, leakage = 0) =>
  recommendPackageFromInputs(leakage, { ...quiet, ...overrides });

test("quiet inputs and no leakage recommend Lite", () => {
  const r = ask({});
  assert.equal(r.packageKey, "lite");
  assert.equal(r.needsEnterprise, false);
  assert.equal(r.recommendedLabel, serviceCatalog.lite.name);
});

test("leakage alone sets the base tier", () => {
  assert.equal(ask({}, 20000).packageKey, "starter");
  assert.equal(ask({}, 80000).packageKey, "growth");
});

test("some traffic or one lead source lifts Lite to Starter", () => {
  assert.equal(ask({ messagesPerDay: 3 }).packageKey, "starter");
  assert.equal(ask({ leadSources: ["Facebook"] }).packageKey, "starter");
  assert.equal(ask({ needsBooking: true }).packageKey, "starter");
});

test("booking plus volume, sources or leakage lifts to Growth", () => {
  assert.equal(ask({ needsBooking: true, messagesPerDay: 10 }).packageKey, "growth");
  assert.equal(ask({ needsBooking: true, leadSources: ["Facebook", "Website"] }).packageKey, "growth");
  assert.equal(ask({ needsBooking: true }, 60000).packageKey, "growth");
});

test("routing, several offers, high volume or three sources lift to Scale", () => {
  assert.equal(ask({ needsStaffRouting: true }).packageKey, "scale");
  assert.equal(ask({ multipleOffers: true }).packageKey, "scale");
  assert.equal(ask({ messagesPerDay: 40 }).packageKey, "scale");
  assert.equal(ask({ leadSources: ["Facebook", "Website", "Phone"] }).packageKey, "scale");
});

test("the tier is never lowered by the form answers", () => {
  const r = ask({ needsBooking: true, messagesPerDay: 10 }, 200000);
  assert.equal(r.packageKey, "scale");
});

test("staff routing at Scale is flagged for enterprise review with its reasons", () => {
  const r = ask({ needsStaffRouting: true });
  assert.equal(r.needsEnterprise, true);
  assert.equal(r.recommendedLabel, "Custom / Enterprise");
  assert.ok(r.enterpriseReasons.includes("More than 5 pipelines"));
  assert.ok(r.enterpriseReasons.includes("Complex role-based routing"));
});

test("several offers at Scale are flagged as enterprise", () => {
  const r = ask({ multipleOffers: true });
  assert.equal(r.needsEnterprise, true);
  assert.ok(r.enterpriseReasons.includes("More than 4 offers or booking outcomes"));
});

test("Scale with no enterprise trigger keeps the normal Scale label", () => {
  const r = ask({ leadSources: ["Facebook", "Website", "Phone"] });
  assert.equal(r.packageKey, "scale");
  assert.deepEqual(r.enterpriseReasons, []);
  assert.equal(r.needsEnterprise, false);
  assert.equal(r.recommendedLabel, serviceCatalog.scale.name);
});

test("naming a CRM at Scale counts as a custom reporting layer", () => {
  const r = ask({ leadSources: ["Facebook", "Website", "Phone"], crmUsed: "Sample CRM" });
  assert.deepEqual(r.enterpriseReasons, ["Custom dashboard / reporting layer"]);
  assert.equal(r.needsEnterprise, true);
});

test("a CRM below Scale is not an enterprise trigger", () => {
  const r = ask({ needsBooking: true, crmUsed: "Sample CRM" });
  assert.equal(r.needsEnterprise, false);
  assert.deepEqual(r.enterpriseReasons, []);
});

test("the recommendation is deterministic", () => {
  const input = { ...quiet, needsBooking: true, messagesPerDay: 12, leadSources: ["Facebook", "Website"] };
  assert.deepEqual(recommendPackageFromInputs(45000, input), recommendPackageFromInputs(45000, input));
});

test("qualification reason lists the inputs that were given", () => {
  const ingest: IngestData = { ...quiet, messagesPerDay: 5, leadSources: ["Facebook"], needsBooking: true };
  const reason = buildQualificationReason(recommendPackageFromInputs(60000, ingest), 60000, ingest);
  assert.match(reason, /recommended because of/);
  assert.match(reason, /5 messages\/day/);
  assert.match(reason, /1 lead source(?!s)/);
  assert.match(reason, /needs booking flow/);
  assert.match(reason, /main problem: slow replies/);
  assert.match(reason, /60,000/);
});

test("qualification reason for enterprise names the triggers and the setup floor", () => {
  const ingest: IngestData = { ...quiet, needsStaffRouting: true };
  const reason = buildQualificationReason(recommendPackageFromInputs(0, ingest), 0, ingest);
  assert.match(reason, /^Custom \/ Enterprise required because/);
  assert.match(reason, /staff routing/);
  assert.ok(reason.includes(enterpriseSetupFloor));
});

test("lead capture payload carries the deterministic recommendation", () => {
  const state: AppState = {
    step: "proposal",
    calculator: INITIAL_CALCULATOR_DATA,
    ingest: { ...INITIAL_INGEST_DATA, ...quiet, needsBooking: true, messagesPerDay: 12 },
    calculatedMetrics: { monthlyLeakage: 60000, annualLeakage: 720000 },
  };
  const payload = buildLeadCapturePayload(state);
  const expected = recommendPackageFromInputs(60000, state.ingest);
  assert.equal(payload.packageKey, expected.packageKey);
  assert.equal(payload.recommendedPackage, expected.recommendedLabel);
  assert.equal(payload.qualificationReason, buildQualificationReason(expected, 60000, state.ingest));
});
