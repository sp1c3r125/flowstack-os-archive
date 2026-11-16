// Runs the unit tests in sales/tests/*.test.ts.
// The sources are TypeScript with extensionless imports, so each test file is
// bundled with esbuild into .test-build/ (git-ignored) and run with node --test.
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const salesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testsDir = path.join(salesDir, "tests");
const outDir = path.join(salesDir, ".test-build");

const entries = readdirSync(testsDir)
  .filter((name) => name.endsWith(".test.ts"))
  .map((name) => path.join(testsDir, name));

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: entries,
  outdir: outDir,
  bundle: true,
  platform: "node",
  format: "esm",
  outExtension: { ".js": ".mjs" },
  // Large parsers that the code under test imports but the tests never call.
  external: ["mammoth", "pdf-parse"],
  logLevel: "error",
});

const built = readdirSync(outDir)
  .filter((name) => name.endsWith(".test.mjs"))
  .map((name) => path.join(outDir, name));

const result = spawnSync(process.execPath, ["--test", ...built], { stdio: "inherit" });
rmSync(outDir, { recursive: true, force: true });
process.exit(result.status ?? 1);
