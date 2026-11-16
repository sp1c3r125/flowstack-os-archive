const {
  logAction,
  getWorkflow,
  updateWorkflow,
  activateWorkflow,
  testWebhook,
  getLatestExecutionForWorkflow,
  saveWorkflow
} = require("./flowstack_tools.js");

const { validateProposal, applyProposal } = require("./repair_guardrails.js");
const { findVersionDrift } = require("./repair_observer_version.js");
const { observeExecution } = require("./repair_observer_execution.js");
const { observePlatform } = require("./repair_observer_platform.js");
const { chooseStrategyV2 } = require("./repair_strategist_v2.js");
const { validateOutcomeV2 } = require("./repair_validator_v2.js");
const {
  makeMemory,
  rememberFailure,
  rememberPatch,
  hasRepeatedFailure,
  hasRepeatedPatch,
  addRun
} = require("./repair_memory.js");
const { shouldUseLlmStrategy, proposeLlmStrategy } = require("./repair_llm_strategist.js");
const { reconcileActiveVersion } = require("./repair_activeversion_reconciler.js");
const { validateRuntime } = require("./repair_runtime_validator.js");
const { adaptPlatformIssue } = require("./repair_platform_adapter.js");

async function persistPatchedWorkflow(workflow, proposal, source, attempt) {
  saveWorkflow(workflow.name, workflow);
  await updateWorkflow(workflow.id, workflow);
  await activateWorkflow(workflow.id);

  logAction("repair_patch_applied", {
    workflowId: workflow.id,
    workflowName: workflow.name,
    attempt,
    source,
    proposal
  });
}


function isNonRepairableDryRunState(input) {
  const text = JSON.stringify(input || {}).toUpperCase();

  const blockedSignals = [
    "ADAPTER_HEALTH_NOT_READY",
    "DRY_RUN_ONLY",
    "LIVE_NOT_REQUESTED",
    "LIVE_NOT_APPROVED",
  ];

  return blockedSignals.some((signal) => text.includes(signal));
}

async function runRepairSupervisor({
  workflowIdOrName,
  webhookPath,
  testPayload,
  maxAttempts = 3,
  allowLlm = false
}) {

  const supervisorInput = arguments[0] || {};

  if (isNonRepairableDryRunState(supervisorInput)) {
    try {
      logAction("repair_blocked_nonrepairable_dry_run_state", {
        source: "repair_supervisor",
        blocked_at: new Date().toISOString(),
        reason: "nonrepairable_dry_run_state",
        input_summary: {
          issue:
            supervisorInput?.issue ||
            supervisorInput?.failure_class ||
            supervisorInput?.run_result?.issue ||
            supervisorInput?.run_result?.failure_class ||
            null,
          status:
            supervisorInput?.status ||
            supervisorInput?.run_result?.status ||
            null,
        },
      });
    } catch (_) {}

    return {
      ok: true,
      skipped: true,
      repair_blocked: true,
      repairable: false,
      reason: "nonrepairable_dry_run_state",
      issue:
        supervisorInput?.issue ||
        supervisorInput?.failure_class ||
        supervisorInput?.run_result?.issue ||
        supervisorInput?.run_result?.failure_class ||
        null,
      status:
        supervisorInput?.status ||
        supervisorInput?.run_result?.status ||
        null,
    };
  }

  const memory = makeMemory();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let workflow = await getWorkflow(workflowIdOrName);
    const latestExecution = await getLatestExecutionForWorkflow(workflow.id).catch(() => null);
    const preTestResult = await testWebhook(webhookPath, testPayload);

    let versionObs = findVersionDrift(workflow);
    const execObs = observeExecution(latestExecution);
    const platformObs = observePlatform(workflow, preTestResult);

    logAction("repair_observer_snapshot", {
      workflowId: workflow.id,
      workflowName: workflow.name,
      attempt,
      versionObs,
      execObs,
      platformObs
    });

    if ((versionObs.fakeActive?.length || 0) > 0 || (versionObs.driftCount || 0) > 0) {
      const reconciled = reconcileActiveVersion(workflow);

      if (reconciled.changed) {
        reconciled.workflow.id = workflow.id;
        await persistPatchedWorkflow(
          reconciled.workflow,
          { reason: reconciled.reason, operations: [{ type: "reconcile_active_version" }] },
          "active_version_reconciler",
          attempt
        );

        workflow = await getWorkflow(workflow.id);
        versionObs = findVersionDrift(workflow);

        addRun(memory, {
          workflowId: workflow.id,
          workflowName: workflow.name,
          attempt,
          phase: "active_version_reconcile",
          reason: reconciled.reason
        });

        logAction("active_version_reconciled", {
          workflowId: workflow.id,
          workflowName: workflow.name,
          attempt,
          reason: reconciled.reason,
          afterVersionObs: versionObs
        });
      }
    }

    let strategy = chooseStrategyV2({
      versionObs,
      execObs,
      platformObs
    });

    const platformAdaptation = adaptPlatformIssue({
      workflow,
      platformObs,
      failure: strategy.failure
    });

    const failureCount = rememberFailure(memory, workflow.name, strategy.failure);
    const repeatedFailure = platformAdaptation?.countsTowardFailureStop === false
      ? false
      : hasRepeatedFailure(memory, workflow.name, strategy.failure, 3);

    logAction("repair_finding", {
      workflowId: workflow.id,
      workflowName: workflow.name,
      attempt,
      failure: strategy.failure,
      decision: strategy.decision,
      failureCount,
      platformAdaptation
    });

    addRun(memory, {
      workflowId: workflow.id,
      workflowName: workflow.name,
      attempt,
      phase: "finding",
      failure: strategy.failure,
      decision: strategy.decision,
      failureCount,
      platformAdaptation
    });

    if (repeatedFailure) {
      return {
        status: "stopped",
        attempts: attempt,
        reason: "same_failure_repeated",
        failure: strategy.failure,
        memory
      };
    }

    const mayUseLlm = allowLlm && shouldUseLlmStrategy({
      failure: strategy.failure,
      versionObs,
      platformObs,
      repeatedFailure
    });

    if ((!strategy.failure.patchable || !strategy.proposal) && mayUseLlm) {
      const llmFailure = {
        ...strategy.failure,
        patchable: true,
        reason: `${strategy.failure.reason} | fallback_llm_strategy`
      };

      const llmProposal = await proposeLlmStrategy({
        workflow,
        versionObs,
        execObs,
        platformObs,
        failure: llmFailure
      }).catch(() => null);

      if (llmProposal && Array.isArray(llmProposal.operations) && llmProposal.operations.length > 0) {
        strategy = {
          failure: llmFailure,
          proposal: llmProposal,
          decision: "PATCH_WITH_LLM_GUARDRAILS"
        };

        logAction("repair_llm_proposal", {
          workflowId: workflow.id,
          workflowName: workflow.name,
          attempt,
          proposal: llmProposal
        });

        addRun(memory, {
          workflowId: workflow.id,
          workflowName: workflow.name,
          attempt,
          phase: "llm_proposal",
          proposal: llmProposal
        });
      } else {
        logAction("repair_llm_skipped_or_invalid", {
          workflowId: workflow.id,
          workflowName: workflow.name,
          attempt,
          reason: "no_valid_operations_from_llm"
        });
      }
    }

    if (!strategy.failure.patchable || !strategy.proposal) {
      const runtime = validateRuntime({
        workflow,
        versionObs,
        execObs,
        platformObs,
        testResult: preTestResult
      });

      if (platformAdaptation) {
        return {
          status: platformAdaptation.status,
          attempts: attempt,
          reason: platformAdaptation.note,
          decision: strategy.decision,
          runtime,
          platformAdaptation,
          memory
        };
      }

      return {
        status: runtime.status === "PLATFORM_BLOCKED" ? "platform_blocked_after_success" : "escalated",
        attempts: attempt,
        reason: strategy.failure.reason,
        decision: strategy.decision,
        runtime,
        memory
      };
    }

    const check = validateProposal(strategy.proposal, workflow);
    if (!check.ok) {
      logAction("repair_proposal_blocked", {
        workflowId: workflow.id,
        workflowName: workflow.name,
        attempt,
        reason: check.reason,
        proposal: strategy.proposal
      });

      return {
        status: "blocked",
        attempts: attempt,
        reason: check.reason,
        proposal: strategy.proposal,
        memory
      };
    }

    const patchCount = rememberPatch(memory, workflow.name, strategy.proposal);

    if (hasRepeatedPatch(memory, workflow.name, strategy.proposal, 3)) {
      return {
        status: "stopped",
        attempts: attempt,
        reason: "same_patch_repeated",
        proposal: strategy.proposal,
        memory
      };
    }

    const patched = applyProposal(strategy.proposal, workflow);
    patched.id = workflow.id;

    await persistPatchedWorkflow(
      patched,
      strategy.proposal,
      strategy.decision === "PATCH_WITH_LLM_GUARDRAILS" ? "llm_guarded" : "v2_agents",
      attempt
    );

    addRun(memory, {
      workflowId: workflow.id,
      workflowName: workflow.name,
      attempt,
      phase: "patch_applied",
      patchCount,
      proposal: strategy.proposal
    });

    const updatedWorkflow = await getWorkflow(workflow.id);
    const postTestResult = await testWebhook(webhookPath, testPayload);
    const afterVersionObs = findVersionDrift(updatedWorkflow);
    const outcome = validateOutcomeV2({
      beforeVersionObs: versionObs,
      afterVersionObs,
      postTestResult,
      decision: strategy.decision
    });

    const runtime = validateRuntime({
      workflow: updatedWorkflow,
      versionObs: afterVersionObs,
      execObs,
      platformObs: observePlatform(updatedWorkflow, postTestResult),
      testResult: postTestResult
    });

    logAction("repair_validation", {
      workflowId: workflow.id,
      workflowName: workflow.name,
      attempt,
      outcome,
      runtime,
      afterVersionObs,
      testStatus: postTestResult.status
    });

    addRun(memory, {
      workflowId: workflow.id,
      workflowName: workflow.name,
      attempt,
      phase: "validation",
      outcome,
      runtime,
      testStatus: postTestResult.status
    });

    if (outcome.ok || runtime.status === "PLATFORM_BLOCKED") {
      return {
        status: runtime.status === "PLATFORM_BLOCKED"
          ? "platform_blocked_after_success"
          : (outcome.status === "PATCHED_TOP_LEVEL" ? "partial_success" : "success"),
        attempts: attempt,
        reason: runtime.status === "PLATFORM_BLOCKED" ? "workflow repaired; platform webhook still blocked" : outcome.reason,
        afterVersionObs,
        runtime,
        memory
      };
    }

    workflowIdOrName = workflow.id;
  }

  return {
    status: "stopped",
    attempts: maxAttempts,
    reason: "max_attempts_reached"
  };
}

module.exports = {
  runRepairSupervisor,
};
