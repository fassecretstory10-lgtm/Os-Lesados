// Router de texto narrativo.
// Seleção por TEXT_PROVIDERS (lista separada por vírgulas, ex. "openrouter").
// Só os providers listados são usados — é assim que se desativa os pagos.
// Sem TEXT_PROVIDERS, vale TEXT_PROVIDER (preferência única) ou auto (todos
// os configurados, por ordem openai > anthropic > gemini > openrouter).

import * as geminiText from "./gemini-text.mjs";
import * as openaiText from "./openai-text.mjs";
import * as anthropicText from "./anthropic-text.mjs";
import * as openrouterText from "./openrouter-text.mjs";
import * as cloudflareText from "./cloudflare-text.mjs";

export const DEFAULT_MODEL = process.env.TEXT_MODEL || "gemini-2.5-flash";

const ALL = ["openai", "anthropic", "gemini", "openrouter", "cloudflare"];

function order() {
  const allow = String(process.env.TEXT_PROVIDERS || "").trim().toLowerCase();
  if (allow) {
    const wanted = allow.split(",").map((x) => x.trim()).filter((x) => ALL.includes(x));
    return wanted.filter((p) => isProviderConfigured(p));
  }
  const pref = String(process.env.TEXT_PROVIDER || "auto").trim().toLowerCase();
  const avail = [];
  if (openaiText.isConfigured()) avail.push("openai");
  if (anthropicText.isConfigured()) avail.push("anthropic");
  if (geminiText.isConfigured()) avail.push("gemini");
  if (openrouterText.isConfigured()) avail.push("openrouter");
  if (cloudflareText.isConfigured()) avail.push("cloudflare");
  if (ALL.includes(pref)) {
    return [pref, ...avail.filter((p) => p !== pref)];
  }
  return avail;
}

function isProviderConfigured(name) {
  if (name === "openai") return openaiText.isConfigured();
  if (name === "anthropic") return anthropicText.isConfigured();
  if (name === "gemini") return geminiText.isConfigured();
  if (name === "openrouter") return openrouterText.isConfigured();
  if (name === "cloudflare") return cloudflareText.isConfigured();
  return false;
}

export function isConfigured() {
  return order().length > 0;
}

export function activeTextProviders() {
  return order();
}

/**
 * @param {object} args - { system, user, schema?, schemaName?, validate? }
 * gemini usa schema+schemaName; openai usa validate (função).
 */
export async function generateJSON({ system, user, schema = null, schemaName = "story", validate = null }) {
  const tried = [];
  for (const name of order()) {
    try {
      if (name === "openai") {
        const out = await openaiText.generateJSON({ system, user, validate });
        return { data: out, provider: "openai-text", model: openaiText.DEFAULT_MODEL };
      }
      if (name === "anthropic") {
        const out = await anthropicText.generateJSON({ system, user, validate });
        return { data: out, provider: "anthropic-text", model: anthropicText.DEFAULT_MODEL };
      }
      if (name === "openrouter") {
        const out = await openrouterText.generateJSON({ system, user, validate });
        return { data: out, provider: "openrouter-text", model: openrouterText.DEFAULT_MODEL };
      }
      if (name === "cloudflare") {
        const out = await cloudflareText.generateJSON({ system, user, validate });
        return { data: out, provider: "cloudflare-text", model: cloudflareText.DEFAULT_MODEL };
      }
      const out = await geminiText.generateJSON({ system, user, schemaName, schema });
      return { data: out, provider: "gemini-text", model: geminiText.DEFAULT_MODEL };
    } catch (e) {
      tried.push(`${name}: ${e.message}`);
      if (e.httpStatus === 400 || e.httpStatus === 401) break;
    }
  }
  if (!tried.length) {
    const err = new Error("Texto indisponível: sem chaves (OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY / OPENROUTER_API_KEY) no .env.");
    err.httpStatus = 503;
    throw err;
  }
  const err = new Error(`Texto indisponível em todos os providers. ${tried.join(" | ")}`);
  err.httpStatus = /429/.test(tried.join(" ")) ? 429 : 502;
  throw err;
}
