"use strict";

// Runs every negative-fixture matrix offline and prints one summary line each.
// Exit code is non-zero if any matrix fails. Used by `npm run contracts`.

const path = require("path");
const { spawnSync } = require("child_process");

const MATRICES = [
  "run_control_plane_live_gate_negative_matrix.js",
  "run_control_plane_manual_live_execution_boundary_negative_matrix.js",
  "run_control_plane_manual_live_execution_consumer_negative_matrix.js",
  "run_control_plane_manual_live_execution_progression_negative_matrix.js",
];

let failures = 0;
for (const script of MATRICES) {
  // Runners resolve fixtures from process.cwd(), so run them from this folder.
  const child = spawnSync(process.execPath, [path.join(__dirname, script)], {
    cwd: __dirname,
    encoding: "utf8",
  });
  let report = null;
  try {
    report = JSON.parse(child.stdout);
  } catch {
    // fall through to the failure line below
  }
  const ok = child.status === 0 && report && report.ok === true;
  if (!ok) failures += 1;
  const counts = report ? `${report.passed_cases}/${report.total_cases}` : "no report";
  console.log(`${ok ? "PASS" : "FAIL"}  ${script}  (${counts})`);
}

console.log(failures === 0 ? "\nAll negative matrices passed." : `\n${failures} matrix(es) failed.`);
process.exit(failures === 0 ? 0 : 1);
