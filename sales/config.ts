/**
 * Server-side configuration for the Vercel API handlers in api/.
 * This is the only place in sales/ that reads process.env.
 * See .env.example at the repo root for every variable, with placeholder values.
 *
 * Values are read on access (not at import time) so a handler always sees the
 * current environment.
 */

export type TokenRegistry = Record<string, string>;

/**
 * Parse a JSON object of { token: tenantId } into a registry with no prototype,
 * so a token such as "constructor" or "toString" can never match an inherited
 * property. Anything malformed yields an empty registry.
 */
function parseTokenMap(raw: string | undefined): TokenRegistry {
  const registry: TokenRegistry = Object.create(null);
  if (!raw) return registry;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [token, tenantId] of Object.entries(parsed)) {
        if (typeof tenantId === "string" && tenantId) registry[token] = tenantId;
      }
    }
  } catch {
    // malformed JSON: treat as no tokens configured
  }
  return registry;
}

function singleTokenRegistry(token: string | undefined, tenantId: string): TokenRegistry {
  const registry: TokenRegistry = Object.create(null);
  if (token) registry[token] = tenantId;
  return registry;
}

function hasEntries(registry: TokenRegistry): boolean {
  return Object.keys(registry).length > 0;
}

export const serverConfig = {
  // Airtable
  get airtablePat() {
    return process.env.FLOWSTACK_AIRTABLE_PAT;
  },
  get airtableBaseId() {
    return process.env.FLOWSTACK_AIRTABLE_BASE_ID;
  },

  // Groq (proposal polish and chatbot)
  get groqApiKey() {
    return process.env.GROQ_API_KEY;
  },

  // Resend (sales hand-off email)
  get resendApiKey() {
    return process.env.RESEND_API_KEY;
  },
  get salesEmailFrom() {
    return process.env.FLOWSTACK_SALES_EMAIL_FROM;
  },
  get salesEmailTo() {
    return process.env.FLOWSTACK_SALES_EMAIL_TO;
  },

  // Facebook Messenger webhook
  get fbVerifyToken() {
    return process.env.FB_VERIFY_TOKEN;
  },
  get fbPageAccessToken() {
    return process.env.FB_PAGE_ACCESS_TOKEN;
  },

  // Operator access
  get operatorKey() {
    return process.env.OPERATOR_KEY;
  },

  // CORS origin for the portal endpoint
  get portalAllowedOrigin() {
    return process.env.PORTAL_ALLOWED_ORIGIN || "*";
  },

  /**
   * Portal tokens. PORTAL_ACCESS_TOKEN (+ PORTAL_TENANT_ID) wins over PORTAL_TOKENS.
   * With nothing configured the registry is empty, so every request is denied.
   */
  portalTokens(): TokenRegistry {
    const single = singleTokenRegistry(
      process.env.PORTAL_ACCESS_TOKEN,
      process.env.PORTAL_TENANT_ID || "default"
    );
    if (hasEntries(single)) return single;
    return parseTokenMap(process.env.PORTAL_TOKENS);
  },

  /**
   * Discovery tokens. Accepts the PORTAL_* variables or the DISCOVERY_* ones.
   * With nothing configured the registry is empty, so every request is denied.
   */
  discoveryTokens(): TokenRegistry {
    const single = singleTokenRegistry(
      process.env.PORTAL_ACCESS_TOKEN || process.env.DISCOVERY_ACCESS_TOKEN,
      process.env.PORTAL_TENANT_ID || process.env.DISCOVERY_TENANT_ID || "shared"
    );
    if (hasEntries(single)) return single;
    return parseTokenMap(process.env.PORTAL_TOKENS || process.env.DISCOVERY_TOKENS);
  },
};
