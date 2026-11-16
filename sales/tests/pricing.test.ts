// Unit tests for the leakage maths and the package catalog. Fake numbers only.
import test from "node:test";
import assert from "node:assert/strict";
import {
  REVENUE_COMMISSION_PERCENTAGE,
  HIGH_VALUE_THRESHOLD,
  calculateMonthlyLeakage,
  calculateAnnualLeakage,
  checkIsHighValue,
  formatCurrency,
} from "../utils/calculations";
import {
  recommendPackage,
  getEnterpriseReasons,
  exceedsScaleBoundaries,
  packageOrder,
  serviceCatalog,
  scaleBoundaries,
  type ScaleScopeInput,
} from "../services/catalog";

// ---- calculations ----

test("monthly leakage = volume x value x (1 - rate) x commission", () => {
  // 100 leads x 5,000 x 60% lost x 20% = 60,000
  assert.equal(calculateMonthlyLeakage(100, 5000, 40), 60000);
  assert.equal(REVENUE_COMMISSION_PERCENTAGE, 0.2);
});

test("monthly leakage edge cases: nothing lost at 100% success, full loss at 0%", () => {
  assert.equal(calculateMonthlyLeakage(100, 5000, 100), 0);
  assert.equal(calculateMonthlyLeakage(100, 5000, 0), 100000);
  assert.equal(calculateMonthlyLeakage(0, 5000, 40), 0);
});

test("annual leakage is twelve months", () => {
  assert.equal(calculateAnnualLeakage(60000), 720000);
  assert.equal(calculateAnnualLeakage(0), 0);
});

test("high value means strictly above the threshold", () => {
  assert.equal(HIGH_VALUE_THRESHOLD, 100000);
  assert.equal(checkIsHighValue(100000), false);
  assert.equal(checkIsHighValue(100001), true);
});

test("formatCurrency prefixes the peso sign and drops decimals", () => {
  const text = formatCurrency(1234567.89);
  assert.ok(text.startsWith("₱"));
  assert.equal(text.replace(/\D/g, ""), "1234568");
});

// ---- catalog ----

test("recommendPackage switches tier exactly at 15k, 60k and 150k", () => {
  assert.equal(recommendPackage(0), "lite");
  assert.equal(recommendPackage(14999), "lite");
  assert.equal(recommendPackage(15000), "starter");
  assert.equal(recommendPackage(59999), "starter");
  assert.equal(recommendPackage(60000), "growth");
  assert.equal(recommendPackage(149999), "growth");
  assert.equal(recommendPackage(150000), "scale");
  assert.equal(recommendPackage(5_000_000), "scale");
});

test("tier order is lite, starter, growth, scale and each has a catalog entry", () => {
  assert.deepEqual(packageOrder, ["lite", "starter", "growth", "scale"]);
  for (const key of packageOrder) {
    assert.ok(serviceCatalog[key].name, `${key} has a name`);
    assert.ok(serviceCatalog[key].setup, `${key} has a setup price`);
  }
});

const withinScale: ScaleScopeInput = {
  leadSources: scaleBoundaries.leadSources,
  offers: scaleBoundaries.offers,
  pipelines: scaleBoundaries.pipelines,
  sequences: scaleBoundaries.sequences,
};

test("a request exactly on every Scale boundary is not enterprise", () => {
  assert.deepEqual(getEnterpriseReasons(withinScale), []);
  assert.equal(exceedsScaleBoundaries(withinScale), false);
});

test("each numeric boundary produces its own reason when exceeded by one", () => {
  const cases: Array<[keyof typeof scaleBoundaries, string]> = [
    ["leadSources", "More than 4 lead sources"],
    ["offers", "More than 4 offers or booking outcomes"],
    ["pipelines", "More than 5 pipelines"],
    ["sequences", "More than 4 follow-up sequences"],
  ];
  for (const [field, expected] of cases) {
    const input = { ...withinScale, [field]: scaleBoundaries[field] + 1 };
    assert.deepEqual(getEnterpriseReasons(input), [expected]);
    assert.equal(exceedsScaleBoundaries(input), true);
  }
});

test("each flag adds one reason, and several flags add several", () => {
  assert.deepEqual(getEnterpriseReasons({ ...withinScale, multiLocation: true }), ["Multi-location deployment"]);
  const many = getEnterpriseReasons({
    ...withinScale,
    customDashboard: true,
    heavyCompliance: true,
    complexRoleRouting: true,
    nonStandardIntegrations: true,
    unlimitedCustomWork: true,
  });
  assert.equal(many.length, 5);
  assert.equal(new Set(many).size, 5);
});

test("flags set to false add nothing", () => {
  assert.deepEqual(
    getEnterpriseReasons({ ...withinScale, multiLocation: false, customDashboard: false, heavyCompliance: false }),
    []
  );
});
