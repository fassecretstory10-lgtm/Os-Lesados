// Texto narrativo via Cloudflare Workers AI (REST, sem dependências).
// Token via env: CF_AI_TOKEN. Conta via env: CF_ACCOUNT_ID (ambos já usados
// para imagem). Modelo via env: CF_TEXT_MODEL (default @cf/meta/llama-3.1-8b-instruct).
// Quota independente do OpenRouter: é o segundo cano quando o free esgota.

export const id = "cloudflare-text";
export const DEFAULT_MODEL = process.env.CF_TEXT_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_TOKENS = Number(process.env.TEXT_MAX_TOKENS || 8192);

function getToken() {
  const t = String(process.env.CF_AI_TOKEN || "").trim();
  return !t || t === "replace_with_your_real_token_here" ? null : t;
}

function getAccountId() {
  const a = String(process.env.CF_ACCOUNT_ID || "").trim();
  return !a || a === "replace_with_your_account_id_here" ? null : a;
}

export function isConfigured() {
  return Boolean(getToken() && getAccountId());
}

function extractJSON(text) {
  const t = String(text || "").trim();
  const direct = scanBalanced(t);
  if (direct) return direct;
  // Llama cospe quebras de linha literais dentro de strings — limpar e repetir.
  return scanBalanced(t.replace(/[\u0000-\u001F\u007F]+/g, " "));
}

function scanBalanced(t) {
  try { JSON.parse(t); return JSON.parse(t); } catch {}
  const start = t.indexOf("{");
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < t.length; i++) {
    const ch = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (!depth) {
        try { return JSON.parse(t.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

export async function generateJSON({ system, user, validate }) {
  const token = getToken();
  const accountId = getAccountId();
  if (!token || !accountId) {
    const err = new Error("CF_AI_TOKEN/CF_ACCOUNT_ID em falta no .env — texto Cloudflare indisponível.");
    err.httpStatus = 503;
    throw err;
  }
  let lastErr = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await requestOnce({ token, accountId, system, user, validate });
    } catch (e) {
      lastErr = e;
      if (e.httpStatus !== 502) throw e;
      if (attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw lastErr;
}

async function requestOnce({ token, accountId, system, user, validate }) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${DEFAULT_MODEL}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "system", content: `${system}\n\nResponde APENAS com JSON válido. Sem markdown, sem comentários.` },
        { role: "user", content: user },
      ],
      max_tokens: MAX_TOKENS,
      temperature: 0.9,
    }),
    signal: AbortSignal.timeout(180000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      const err = new Error("CF_AI_TOKEN sem permissão Workers AI (401/403).");
      err.httpStatus = 401;
      throw err;
    }
    if (res.status === 429) {
      const err = new Error("Limite Cloudflare Workers AI atingido (429).");
      err.httpStatus = 429;
      throw err;
    }
    const err = new Error(`Cloudflare texto ${res.status}: ${body.slice(0, 250)}`);
    err.httpStatus = 502;
    throw err;
  }
  const data = await res.json();
  // Workers AI responde em formato OpenAI (result.choices[0].message.content);
  // result.response existe mas nem sempre traz o texto.
  let text = data?.result?.choices?.[0]?.message?.content ?? data?.result?.response ?? "";
  if (text && typeof text === "object") text = JSON.stringify(text);
  const parsed = extractJSON(text);
  if (!parsed) {
    const err = new Error(`Cloudflare devolveu JSON inválido. Trecho: ${String(text).slice(0, 200)}`);
    err.httpStatus = 502;
    throw err;
  }
  if (typeof validate === "function") {
    const problems = validate(parsed);
    if (problems.length) {
      const err = new Error(`Schema inválido do modelo: ${problems.join("; ")}`);
      err.httpStatus = 502;
      throw err;
    }
  }
  return parsed;
}
