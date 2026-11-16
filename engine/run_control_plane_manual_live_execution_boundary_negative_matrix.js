const path = require("path");
const { readJson } = require("./control_plane_live_gate_read_helpers");
const { validateControlPlaneManualLiveExecutionBoundary } = require("./validate_control_plane_manual_live_execution_boundary");
const { validateControlPlaneManualLiveExecutionReceipt } = require("./validate_control_plane_manual_live_execution_receipt");
const { validateControlPlaneManualLiveRollbackContract } = require("./validate_control_plane_manual_live_rollback_contract");

const fixtureDir = path.join(process.cwd(), "artifacts", "control_plane_manual_live_execution_negative_fixtures");

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
    const r = validateControlPlaneManualLiveExecutionBoundary(load("fixture_boundary_missing_approval.json"));
    cases.push(result("boundary_missing_approval_is_valid_blocked_boundary", r.ok, false, r.failed_checks));
  }
  {
    const r = validateControlPlaneManualLiveExecutionBoundary(load("fixture_boundary_bad_mutation_authority.json"));
    cases.push(result("boundary_bad_mutation_authority_rejected", r.ok, true, r.failed_checks));
  }
  {
    const r = validateControlPlaneManualLiveExecutionBoundary(load("fixture_boundary_started_true.json"));
    cases.push(result("boundary_started_true_rejected", r.ok, true, r.failed_checks));
  }
  {
    const r = validateControlPlaneManualLiveExecutionReceipt(load("fixture_receipt_bad_status.json"));
    cases.push(result("receipt_bad_status_rejected", r.ok, true, r.failed_checks));
  }
  {
    const r = validateControlPlaneManualLiveExecutionReceipt(load("fixture_receipt_executed_true.json"));
    cases.push(result("receipt_executed_true_rejected", r.ok, true, r.failed_checks));
  }
  {
    const r = validateControlPlaneManualLiveRollbackContract(load("fixture_rollback_drift.json"));
    cases.push(result("rollback_drift_rejected", r.ok, true, r.failed_checks));
  }
  {
    const r = validateControlPlaneManualLiveRollbackContract(load("fixture_rollback_bad_type.json"));
    cases.push(result("rollback_bad_type_rejected", r.ok, true, r.failed_checks));
  }

  const passed = cases.filter(c => c.pass).length;
  const failed = cases.filter(c => !c.pass);

  const report = {
    ok: failed.length === 0,
    artifact_type: "control_plane_manual_live_execution_negative_matrix_report",
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
