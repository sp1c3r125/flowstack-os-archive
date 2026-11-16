const path = require("path");
const { readJson } = require("./control_plane_live_gate_read_helpers");
const { validateControlPlaneManualLiveOperatorExecutionEvent } = require("./validate_control_plane_manual_live_operator_execution_event");
const { validateControlPlaneManualLiveOperatorExecutionEventConsumption } = require("./validate_control_plane_manual_live_operator_execution_event_consumption");
const { validateControlPlaneManualLiveExecutionProgression } = require("./validate_control_plane_manual_live_execution_progression");
const { validateControlPlaneManualLivePostExecutionValidationResult } = require("./validate_control_plane_manual_live_post_execution_validation_result");
const { validateControlPlaneManualLiveRollbackTransition } = require("./validate_control_plane_manual_live_rollback_transition");

const fixtureDir = path.join(process.cwd(), "artifacts", "control_plane_manual_live_execution_progression_negative_fixtures");

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
    const r = validateControlPlaneManualLiveOperatorExecutionEvent(load("fixture_operator_event_blocked_valid.json"));
    cases.push(result("operator_event_blocked_valid_artifact", r.ok, false, r.failed_checks));
  }
  {
    const r = validateControlPlaneManualLiveOperatorExecutionEvent(load("fixture_operator_event_ready_with_blockers.json"));
    cases.push(result("operator_event_ready_with_blockers_rejected", r.ok, true, r.failed_checks));
  }
  {
    const r = validateControlPlaneManualLiveOperatorExecutionEventConsumption(load("fixture_operator_event_consumption_bad_status.json"));
    cases.push(result("operator_event_consumption_bad_status_rejected", r.ok, true, r.failed_checks));
  }
  {
    const r = validateControlPlaneManualLiveOperatorExecutionEventConsumption(load("fixture_operator_event_consumption_executed_true.json"));
    cases.push(result("operator_event_consumption_executed_true_rejected", r.ok, true, r.failed_checks));
  }
  {
    const r = validateControlPlaneManualLiveExecutionProgression(load("fixture_progression_bad_status.json"));
    cases.push(result("progression_bad_status_rejected", r.ok, true, r.failed_checks));
  }
  {
    const r = validateControlPlaneManualLivePostExecutionValidationResult(load("fixture_post_validation_result_bad_status.json"));
    cases.push(result("post_validation_result_bad_status_rejected", r.ok, true, r.failed_checks));
  }
  {
    const r = validateControlPlaneManualLiveRollbackTransition(load("fixture_rollback_transition_bad_status.json"));
    cases.push(result("rollback_transition_bad_status_rejected", r.ok, true, r.failed_checks));
  }
  {
    const r = validateControlPlaneManualLiveRollbackTransition(load("fixture_rollback_transition_executed_true.json"));
    cases.push(result("rollback_transition_executed_true_rejected", r.ok, true, r.failed_checks));
  }

  const passed = cases.filter(c => c.pass).length;
  const failed = cases.filter(c => !c.pass);

  const report = {
    ok: failed.length === 0,
    artifact_type: "control_plane_manual_live_execution_progression_negative_matrix_report",
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
