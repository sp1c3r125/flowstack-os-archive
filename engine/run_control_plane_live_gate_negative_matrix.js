const path = require("path");
const { readJson } = require("./control_plane_live_gate_read_helpers");
const { validateControlPlaneLiveGateState } = require("./validate_control_plane_live_gate_state");
const { validateControlPlaneLiveGateApprovalRecord } = require("./validate_control_plane_live_gate_approval_record");
const { validateControlPlaneLiveGateStateSummary } = require("./validate_control_plane_live_gate_state_summary");
const { validateControlPlaneLiveGateOperatorSummary } = require("./validate_control_plane_live_gate_operator_summary");
const { validateControlPlaneLiveGateSurfaceArtifact } = require("./validate_control_plane_live_gate_surface_artifact");

const fixtureDir = path.join(process.cwd(), "artifacts", "control_plane_live_gate_negative_fixtures");

function load(name) {
  return readJson(path.join(fixtureDir, name));
}

function result(name, ok, expectedFail, failedChecks) {
  const pass = expectedFail ? ok === false : ok === true;
  return { name, pass, ok, expectedFail, failedChecks: failedChecks || [] };
}

function run() {
  const cases = [];

  {
    const r = validateControlPlaneLiveGateState(load("fixture_blocked_state.json"));
    cases.push(result("blocked_state_is_valid_blocked_state", r.ok, false, r.failed_checks));
  }

  {
    const r = validateControlPlaneLiveGateState(load("fixture_bad_mutation_authority_state.json"));
    cases.push(result("bad_mutation_authority_state_rejected", r.ok, true, r.failed_checks));
  }

  {
    const r = validateControlPlaneLiveGateState(load("fixture_state_flag_status_mismatch.json"));
    cases.push(result("state_flag_status_mismatch_rejected", r.ok, true, r.failed_checks));
  }

  {
    const r = validateControlPlaneLiveGateApprovalRecord(load("fixture_bad_approval_status.json"));
    cases.push(result("bad_approval_status_rejected", r.ok, true, r.failed_checks));
  }

  {
    const r = validateControlPlaneLiveGateApprovalRecord(load("fixture_live_mutation_true_approval.json"));
    cases.push(result("live_mutation_true_approval_rejected", r.ok, true, r.failed_checks));
  }

  {
    const r = validateControlPlaneLiveGateStateSummary(load("fixture_bad_summary_authority.json"));
    cases.push(result("bad_summary_authority_rejected", r.ok, true, r.failed_checks));
  }

  {
    const r = validateControlPlaneLiveGateOperatorSummary(load("fixture_bad_operator_summary_type.json"));
    cases.push(result("bad_operator_summary_type_rejected", r.ok, true, r.failed_checks));
  }

  {
    const r = validateControlPlaneLiveGateSurfaceArtifact(load("fixture_bad_surface_authority.json"));
    cases.push(result("bad_surface_authority_rejected", r.ok, true, r.failed_checks));
  }

  {
    const bundle = load("fixture_parity_mismatch_bundle.json");
    const failed = [];
    if (bundle.state.eligibility_status !== bundle.summary.eligibility_status) failed.push("STATE_SUMMARY_MISMATCH");
    if (bundle.summary.eligibility_status !== bundle.operatorSummary.eligibility_status) failed.push("SUMMARY_OPERATOR_MISMATCH");
    if (!bundle.surface.operator_summary || bundle.surface.operator_summary.eligibility_status !== bundle.operatorSummary.eligibility_status) failed.push("OPERATOR_SURFACE_MISMATCH");
    const ok = failed.length === 0;
    cases.push(result("parity_mismatch_bundle_rejected", ok, true, failed));
  }

  const passed = cases.filter(c => c.pass).length;
  const failed = cases.filter(c => !c.pass);

  const report = {
    ok: failed.length === 0,
    artifact_type: "control_plane_live_gate_negative_matrix_report",
    generated_at: new Date().toISOString(),
    total_cases: cases.length,
    passed_cases: passed,
    failed_cases: failed.length,
    cases
  };

  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (!report.ok) process.exit(1);
}

run();
