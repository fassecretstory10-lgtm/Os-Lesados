// Router de texto narrativo: escolhe o provider por TEXT_PROVIDER=openai|gemini
// (default: openai se configurado, senão gemini). Em falha, tenta o outro
// antes de desistir — mas o erro final lista sempre o que aconteceu em cada um.

import * as geminiText from "./gemini-text.mjs";
import * as openaiText from "./openai-text.mjs";
import * as anthropicText from "./anthropic-text.mjs";

export const DEFAULT_MODEL = process.env.TEXT_MODEL || "gemini-2.5-flash";

function order() {
  const pref = String(process.env.TEXT_PROVIDER || "auto").trim().toLowerCase();
  const avail = [];
  if (openaiText.isConfigured()) avail.push("openai");
  if (anthropicText.isConfigured()) avail.push("anthropic");
  if (geminiText.isConfigured()) avail.push("gemini");
  if (pref === "openai" || pref === "anthropic" || pref === "gemini") {
    return [pref, ...avail.filter((p) => p !== pref)];
  }
  return avail;
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
      const out = await geminiText.generateJSON({ system, user, schemaName, schema });
      return { data: out, provider: "gemini-text", model: geminiText.DEFAULT_MODEL };
    } catch (e) {
      tried.push(`${name}: ${e.message}`);
      if (e.httpStatus === 400 || e.httpStatus === 401) break;
    }
  }
  if (!tried.length) {
    const err = new Error("Texto indisponível: sem chaves (OPENAI_API_KEY / GEMINI_API_KEY) no .env.");
    err.httpStatus = 503;
    throw err;
  }
  const err = new Error(`Texto indisponível em todos os providers. ${tried.join(" | ")}`);
  err.httpStatus = /429/.test(tried.join(" ")) ? 429 : 502;
  throw err;
}
