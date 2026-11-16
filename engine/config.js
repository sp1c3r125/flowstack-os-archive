"use strict";

// Single place where the engine reads environment variables.
// Every other engine file imports from here instead of touching process.env.
// See .env.example at the repo root for the full list with placeholder values.

const path = require("path");

const env = process.env;

// Where logs, reports, workflows and the event ledger are written.
// Default: ./data at the repo root (git-ignored).
const FLOWSTACK_HOME = path.resolve(env.FLOWSTACK_HOME || path.join(__dirname, "..", "data"));
const FLOWSTACK_ROOT = env.FLOWSTACK_ROOT || FLOWSTACK_HOME;
const FLOWSTACK_WORKSPACE_ROOT = path.resolve(env.FLOWSTACK_WORKSPACE_ROOT || FLOWSTACK_HOME);

// Control plane API
const CONTROL_PLANE_API_TOKEN = env.CONTROL_PLANE_API_TOKEN || "";
const CONTROL_PLANE_API_PORT = String(env.CONTROL_PLANE_API_PORT || "47911");

// Behaviour switches
const FLOWSTACK_DEMO_MODE = String(env.FLOWSTACK_DEMO_MODE || "1") === "1";
const ENABLE_LLM_REPAIR = String(env.ENABLE_LLM_REPAIR || "0") === "1";

// Optional LiteLLM proxy for the repair path
const LITELLM_URL = env.LITELLM_URL || "http://127.0.0.1:4000/chat/completions";
const LITELLM_MODEL = env.LITELLM_MODEL || "coding";
const LITELLM_KEY = env.LITELLM_KEY || "";

// n8n
const N8N_URL = (env.N8N_URL || "http://localhost:5678").replace(/\/$/, "");
const N8N_API_KEY = String(env["N8N_API_KEY"] ?? "");

// Environment for a spawned child process: the current environment plus overrides.
function childProcessEnv(overrides) {
  return { ...env, ...overrides };
}

module.exports = {
  childProcessEnv,
  FLOWSTACK_HOME,
  FLOWSTACK_ROOT,
  FLOWSTACK_WORKSPACE_ROOT,
  CONTROL_PLANE_API_TOKEN,
  CONTROL_PLANE_API_PORT,
  FLOWSTACK_DEMO_MODE,
  ENABLE_LLM_REPAIR,
  LITELLM_URL,
  LITELLM_MODEL,
  LITELLM_KEY,
  N8N_URL,
  N8N_API_KEY,
};
