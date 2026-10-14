// Fornecedor: Cloudflare Workers AI — text-to-image (REST, sem dependências).
// Token via env: CF_AI_TOKEN (User API Token com permissão Workers AI).
// Conta via env: CF_ACCOUNT_ID (obrigatório — ver dashboard Cloudflare).
// Modelo via env: CF_IMAGE_MODEL (default "@cf/black-forest-labs/flux-1-schnell").
//
// Endpoint: POST https://api.cloudflare.com/client/v4/accounts/{id}/ai/run/{model}
// Resposta imagem: { result: { image: "<base64>" }, success: true }.
// NOTA: text-to-image — refs ignoradas com warning (viajam só no texto).

export const id = "cloudflare";
export const label = "Cloudflare Workers AI";
export const keyEnvVar = "CF_AI_TOKEN";

const DEFAULT_MODEL = "@cf/black-forest-labs/flux-1-schnell";
// Limite real da API (confirmado em produção): o campo /prompt tem de ter <= 2048 chars.
const MAX_PROMPT_CHARS = 2048;

function getToken() {
  const t = String(process.env.CF_AI_TOKEN || "").trim();
  return !t || t === "replace_with_your_real_token_here" ? null : t;
}

function getAccountId() {
  const a = String(process.env.CF_ACCOUNT_ID || "").trim();
  return !a || a === "replace_with_your_account_id" ? null : a;
}

export function isConfigured() {
  return Boolean(getToken() && getAccountId());
}

export function isRateLimitError(e) {
  if (e?.httpStatus === 429) return true;
  const msg = String(e?.message || "").toLowerCase();
  return msg.includes("429") || msg.includes("rate limit") || msg.includes("quota");
}

/**
 * Interface comum: ({ model, prompt, refs }) -> { base64, mimeType, warnings }.
 */
export async function generate({ model, prompt, refs = [] }) {
  if (!getToken()) {
    const err = new Error("CF_AI_TOKEN em falta. Define no .env (vê .env.example).");
    err.httpStatus = 503;
    throw err;
  }
  const accountId = getAccountId();
  if (!accountId) {
    const err = new Error("CF_ACCOUNT_ID em falta. Define no .env (encontra-o no dashboard Cloudflare, lado direito do ecrã inicial).");
    err.httpStatus = 503;
    throw err;
  }
  const warnings = [];
  let text = String(prompt);
  if (text.length > MAX_PROMPT_CHARS) {
    // O prompt do utilizador vem primeiro no fullText, por isso o corte
    // apanha a cauda (regras/estilo). Aviso explícito em vez de falha 400.
    text = text.slice(0, MAX_PROMPT_CHARS);
    warnings.push(`Prompt truncado a ${MAX_PROMPT_CHARS} caracteres (limite do modelo CF).`);
  }
  if (refs.length) {
    warnings.push(
      `${refs.length} referência(s) visual(is) ignorada(s): o modelo CF é text-to-image e não aceita imagens de referência.`
    );
  }

  const modelId = String(model || "").startsWith("@cf/")
    ? model
    : (process.env.CF_IMAGE_MODEL || DEFAULT_MODEL);

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: text }),
      signal: AbortSignal.timeout(180000),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const detail = (data.errors || []).map((e) => e.message || JSON.stringify(e)).join(" | ") || res.statusText;
    const err = new Error(`Cloudflare ${res.status}: ${String(detail).slice(0, 300)}`);
    err.httpStatus = res.status === 401 || res.status === 403 ? 401 : res.status === 429 ? 429 : 502;
    if (err.httpStatus === 401) err.message = "CF_AI_TOKEN inválido ou sem permissão Workers AI (401).";
    throw err;
  }

  let b64 = data?.result?.image || null;
  if (!b64) throw new Error("A Cloudflare não devolveu imagem (result.image vazio).");
  // Alguns modelos devolvem data-URL; normalizar para base64 puro.
  const m = String(b64).match(/^data:([^;]+);base64,(.+)$/);
  const mimeType = m ? m[1] : "image/jpeg";
  if (m) b64 = m[2];
  return { base64: b64, mimeType, warnings };
}
