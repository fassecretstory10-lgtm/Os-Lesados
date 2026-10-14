// Texto narrativo via Anthropic Messages API.
// Chave via env: ANTHROPIC_API_KEY. Modelo via TEXT_ANTHROPIC_MODEL
// (default claude-haiku-4-5 — rápido e barato para JSON estruturado).
// A API não tem modo JSON estrito: pede-se JSON e valida-se à chegada.

export const id = "anthropic-text";
export const DEFAULT_MODEL = process.env.TEXT_ANTHROPIC_MODEL || "claude-haiku-4-5";
const MAX_TOKENS = Number(process.env.TEXT_MAX_TOKENS || 8192);

function getApiKey() {
  const key = String(process.env.ANTHROPIC_API_KEY || "").trim();
  return !key || key === "replace_with_your_real_key_here" ? null : key;
}

export function isConfigured() {
  return Boolean(getApiKey());
}

export async function generateJSON({ system, user, validate }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    const err = new Error("ANTHROPIC_API_KEY em falta no .env — texto Anthropic indisponível.");
    err.httpStatus = 503;
    throw err;
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      system: `${system}\n\nResponde APENAS com JSON válido. Sem markdown, sem comentários.`,
      messages: [{ role: "user", content: user }],
      temperature: 0.9,
    }),
    signal: AbortSignal.timeout(180000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      const err = new Error("ANTHROPIC_API_KEY inválida ou sem permissão (401).");
      err.httpStatus = 401;
      throw err;
    }
    if (res.status === 429 || /credit balance|quota|overloaded/i.test(body)) {
      const err = new Error("Sem créditos Anthropic (ou 429). Carrega em https://console.anthropic.com/settings/billing.");
      err.httpStatus = 429;
      throw err;
    }
    const err = new Error(`Anthropic texto ${res.status}: ${body.slice(0, 250)}`);
    err.httpStatus = 502;
    throw err;
  }
  const data = await res.json();
  const text = (data?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  let parsed;
  try {
    const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    parsed = JSON.parse(clean);
  } catch {
    if (data?.stop_reason === "max_tokens") {
      const err = new Error(`Resposta cortada por limite de tokens (${MAX_TOKENS}). Aumenta TEXT_MAX_TOKENS no .env.`);
      err.httpStatus = 502;
      throw err;
    }
    const err = new Error("A Anthropic devolveu JSON inválido — tenta de novo.");
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
