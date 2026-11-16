// Unit tests for the discovery helpers: keyword template inference and the
// concept document. Both are pure string functions. Fake inputs only.
import test from "node:test";
import assert from "node:assert/strict";
import { inferTemplates, buildConceptDoc } from "../api/discovery";

test("with no input the always-on templates are still returned", () => {
  assert.deepEqual(inferTemplates("", "", ""), ["lead_intake_crm", "daily_reporting"]);
});

test("a booking tool adds the booking reminder", () => {
  assert.ok(inferTemplates("", "", "We use Calendly").includes("booking_reminder"));
});

test("phone and calls add missed call recovery", () => {
  assert.ok(inferTemplates("", "", "phone calls").includes("missed_call_recovery"));
  assert.ok(inferTemplates("Customers make calls to us", "", "").includes("missed_call_recovery"));
});

test("pain about follow-ups adds re-engagement", () => {
  assert.ok(inferTemplates("", "We forgot to follow up and leads go cold", "").includes("reengagement_followup"));
});

test("matching is case and punctuation insensitive", () => {
  assert.ok(inferTemplates("", "", "CAL.COM").includes("booking_reminder"));
  assert.ok(inferTemplates("", "", "Calendly!!!").includes("booking_reminder"));
});

test("templates are never duplicated and the result is repeatable", () => {
  const args: [string, string, string] = [
    "Customers message us on Messenger and WhatsApp, and sometimes call",
    "Missed calls, slow reply, no follow up, no show",
    "Facebook page, Google Sheets, Calendly",
  ];
  const first = inferTemplates(...args);
  assert.equal(new Set(first).size, first.length);
  assert.deepEqual(inferTemplates(...args), first);
  assert.ok(first.includes("lead_intake_crm") && first.includes("daily_reporting"));
});

const base = {
  tenantId: "sampletours_samplecity",
  generatedAt: "2026-01-01T00:00:00.000Z",
};

test("concept doc names the tenant and the generation time", () => {
  const doc = buildConceptDoc({ ...base, journey: "", pain: "", tools: "" });
  assert.match(doc, /^# Workflow Concept - sampletours_samplecity/);
  assert.ok(doc.includes("**Generated:** 2026-01-01T00:00:00.000Z"));
  assert.ok(doc.includes("DRAFT - operator review required before compile"));
});

test("concept doc marks missing inputs and shows an empty-journey placeholder", () => {
  const doc = buildConceptDoc({ ...base, journey: "", pain: "", tools: "" });
  assert.equal((doc.match(/\| Missing \|/g) || []).length, 3);
  assert.ok(doc.includes("No steps parsed"));
  assert.ok(doc.includes("_Not provided_"));
  assert.ok(!doc.includes("undefined"));
});

test("concept doc maps journey steps to templates and numbers them", () => {
  const journey = [
    "1. A customer sends a DM on Messenger",
    "2) Staff replies manually when free",
    "- Booking is written in a notebook",
  ].join("\n");
  const doc = buildConceptDoc({ ...base, journey, pain: "slow reply", tools: "Facebook page" });
  assert.match(doc, /\| 1 \| A customer sends a DM on Messenger \| `lead_intake_crm` \| Trigger \(Messenger Webhook\) \|/);
  assert.match(doc, /\| 2 \| Staff replies manually when free \| `lead_intake_crm` \| -> Auto-reply Node \|/);
  assert.match(doc, /\| 3 \| Booking is written in a notebook \|/);
  assert.ok(doc.includes("| journey_map | OK Provided |"));
});

test("concept doc lists deploy order in the fixed sequence, only for chosen templates", () => {
  const doc = buildConceptDoc({ ...base, journey: "", pain: "forgot to follow up", tools: "Calendly, phone" });
  const order = [...doc.matchAll(/^\d+\. `(\w+)`$/gm)].map((m) => m[1]);
  assert.deepEqual(order, [
    "lead_intake_crm",
    "missed_call_recovery",
    "booking_reminder",
    "reengagement_followup",
    "daily_reporting",
  ]);
});

test("concept doc lists Facebook credentials only when the tools mention Facebook", () => {
  const withFb = buildConceptDoc({ ...base, journey: "", pain: "", tools: "Facebook page" });
  const without = buildConceptDoc({ ...base, journey: "", pain: "", tools: "Spreadsheet" });
  assert.ok(withFb.includes("FB_PAGE_ACCESS_TOKEN_{TENANT}"));
  assert.ok(!without.includes("FB_PAGE_ACCESS_TOKEN_{TENANT}"));
  assert.ok(without.includes("RESEND_API_KEY"));
});

test("concept doc only names credential variables, never values", () => {
  const doc = buildConceptDoc({ ...base, journey: "", pain: "", tools: "Facebook, WhatsApp" });
  assert.ok(!/(pat[A-Za-z0-9]{14}\.|sk-[A-Za-z0-9]{10,}|Bearer\s)/.test(doc));
});
