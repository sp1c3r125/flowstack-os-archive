// Unit tests for the token registries in sales/config.ts: deny by default,
// no prototype matches, and the documented environment variable precedence.
import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { serverConfig } from "../config";

const KEYS = [
  "PORTAL_ACCESS_TOKEN",
  "PORTAL_TENANT_ID",
  "PORTAL_TOKENS",
  "DISCOVERY_ACCESS_TOKEN",
  "DISCOVERY_TENANT_ID",
  "DISCOVERY_TOKENS",
  "PORTAL_ALLOWED_ORIGIN",
  "GROQ_API_KEY",
];

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

const lookup = (registry: Record<string, string>, token: string) => registry[token] || null;

test("with nothing configured both registries are empty, so every token is denied", () => {
  for (const token of ["demo-client", "demo", "anything"]) {
    assert.equal(lookup(serverConfig.portalTokens(), token), null);
    assert.equal(lookup(serverConfig.discoveryTokens(), token), null);
  }
  assert.deepEqual(Object.keys(serverConfig.portalTokens()), []);
  assert.deepEqual(Object.keys(serverConfig.discoveryTokens()), []);
});

test("PORTAL_TOKENS maps tokens to tenants", () => {
  process.env.PORTAL_TOKENS = JSON.stringify({ "token-one": "tenant_a", "token-two": "tenant_b" });
  const registry = serverConfig.portalTokens();
  assert.equal(lookup(registry, "token-one"), "tenant_a");
  assert.equal(lookup(registry, "token-two"), "tenant_b");
  assert.equal(lookup(registry, "token-three"), null);
});

test("inherited property names never match as tokens", () => {
  process.env.PORTAL_TOKENS = JSON.stringify({ "token-one": "tenant_a" });
  for (const name of ["constructor", "toString", "hasOwnProperty", "valueOf", "__proto__"]) {
    assert.equal(lookup(serverConfig.portalTokens(), name), null, name);
    assert.equal(lookup(serverConfig.discoveryTokens(), name), null, name);
  }
});

test("malformed or wrongly shaped JSON gives an empty registry", () => {
  for (const raw of ["{not json", "[]", '"text"', "42", "null"]) {
    process.env.PORTAL_TOKENS = raw;
    assert.deepEqual(Object.keys(serverConfig.portalTokens()), [], raw);
  }
});

test("entries whose tenant is not a non-empty string are dropped", () => {
  process.env.PORTAL_TOKENS = JSON.stringify({ good: "tenant_a", number: 7, empty: "", nested: { a: 1 }, nothing: null });
  assert.deepEqual(Object.keys(serverConfig.portalTokens()), ["good"]);
});

test("a single portal token wins over PORTAL_TOKENS and defaults its tenant", () => {
  process.env.PORTAL_ACCESS_TOKEN = "single-token";
  process.env.PORTAL_TOKENS = JSON.stringify({ "other-token": "tenant_b" });
  const registry = serverConfig.portalTokens();
  assert.equal(lookup(registry, "single-token"), "default");
  assert.equal(lookup(registry, "other-token"), null);

  process.env.PORTAL_TENANT_ID = "sampletours_samplecity";
  assert.equal(lookup(serverConfig.portalTokens(), "single-token"), "sampletours_samplecity");
});

test("discovery accepts the DISCOVERY_* variables, portal does not", () => {
  process.env.DISCOVERY_TOKENS = JSON.stringify({ "disc-token": "tenant_d" });
  assert.equal(lookup(serverConfig.discoveryTokens(), "disc-token"), "tenant_d");
  assert.equal(lookup(serverConfig.portalTokens(), "disc-token"), null);

  delete process.env.DISCOVERY_TOKENS;
  process.env.DISCOVERY_ACCESS_TOKEN = "disc-single";
  assert.equal(lookup(serverConfig.discoveryTokens(), "disc-single"), "shared");
  process.env.DISCOVERY_TENANT_ID = "tenant_d";
  assert.equal(lookup(serverConfig.discoveryTokens(), "disc-single"), "tenant_d");
});

test("values are read on access, not at import time", () => {
  assert.equal(serverConfig.groqApiKey, undefined);
  process.env.GROQ_API_KEY = "placeholder-not-a-real-key";
  assert.equal(serverConfig.groqApiKey, "placeholder-not-a-real-key");
});

test("CORS origin defaults to * and follows PORTAL_ALLOWED_ORIGIN", () => {
  assert.equal(serverConfig.portalAllowedOrigin, "*");
  process.env.PORTAL_ALLOWED_ORIGIN = "http://localhost:3000";
  assert.equal(serverConfig.portalAllowedOrigin, "http://localhost:3000");
});
