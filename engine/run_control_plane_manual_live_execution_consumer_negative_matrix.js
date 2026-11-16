const path = require("path");
const { readJson } = require("./control_plane_live_gate_read_helpers");
const { validateControlPlaneManualLiveExecutionRequest } = require("./validate_control_plane_manual_live_execution_request");
const { validateControlPlaneManualLiveExecutionConsumption } = require("./validate_control_plane_manual_live_execution_consumption");
const { validateControlPlaneManualLiveExecutionStateTransition } = require("./validate_control_plane_manual_live_execution_state_transition");
const { validateControlPlaneManualLivePostExecutionReport } = require("./validate_control_plane_manual_live_post_execution_report");
const { validateControlPlaneManualLiveRollbackReadiness } = require("./validate_control_plane_manual_live_rollback_readiness");

const fixtureDir = path.join(process.cwd(), "artifacts", "control_plane_manual_live_execution_consumer_negative_fixtures");

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
    const r = validateControlPlaneManualLiveExecutionRequest(load("fixture_request_blocked_valid.json"));
    cases.push(result("request_blocked_valid_artifact", r.ok, false, r.failed_checks));
  }
  {
    const r = validateControlPlaneManualLiveExecutionRequest(load("fixture_request_ready_with_blockers.json"));
    cases.push(result("request_ready_with_blockers_rejected", r.ok, true, r.failed_checks));
  }
  {
    const r = validateControlPlaneManualLiveExecutionConsumption(load("fixture_consumption_bad_status.json"));
    cases.push(result("consumption_bad_status_rejected", r.ok, true, r.failed_checks));
  }
  {
    const r = validateControlPlaneManualLiveExecutionConsumption(load("fixture_consumption_executed_true.json"));
    cases.push(result("consumption_executed_true_rejected", r.ok, true, r.failed_checks));
  }
  {
    const r = validateControlPlaneManualLiveExecutionStateTransition(load("fixture_transition_bad_next_state.json"));
    cases.push(result("transition_bad_next_state_rejected", r.ok, true, r.failed_checks));
  }
  {
    const r = validateControlPlaneManualLivePostExecutionReport(load("fixture_post_report_bad_status.json"));
    cases.push(result("post_report_bad_status_rejected", r.ok, true, r.failed_checks));
  }
  {
    const r = validateControlPlaneManualLiveRollbackReadiness(load("fixture_rollback_readiness_drift.json"));
    cases.push(result("rollback_readiness_drift_rejected", r.ok, true, r.failed_checks));
  }

  const passed = cases.filter(c => c.pass).length;
  const failed = cases.filter(c => !c.pass);

  const report = {
    ok: failed.length === 0,
    artifact_type: "control_plane_manual_live_execution_consumer_negative_matrix_report",
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
