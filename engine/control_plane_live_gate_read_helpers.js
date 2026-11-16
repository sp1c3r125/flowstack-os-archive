const fs = require("fs");
const path = require("path");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function stripBom(text) {
  return typeof text === "string" ? text.replace(/^\uFEFF/, "") : text;
}

function readJson(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(stripBom(raw));
}

function writeJson(filePath, obj) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
  return filePath;
}

function listArtifacts(dir, prefix) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .map((name) => path.join(dir, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

function getLatestArtifact(dir, prefix) {
  return listArtifacts(dir, prefix)[0] || null;
}

module.exports = {
  ensureDir,
  stripBom,
  readJson,
  writeJson,
  listArtifacts,
  getLatestArtifact,
};
