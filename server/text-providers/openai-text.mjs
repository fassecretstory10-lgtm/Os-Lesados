// Texto narrativo via OpenAI Chat Completions (JSON mode).
// Chave via env: OPENAI_API_KEY. Modelo via TEXT_OPENAI_MODEL (default gpt-4o-mini).

export const id = "openai-text";
export const DEFAULT_MODEL = process.env.TEXT_OPENAI_MODEL || "gpt-4o-mini";
const MAX_TOKENS = Number(process.env.TEXT_MAX_TOKENS || 8192);

function getApiKey() {
  const key = String(process.env.OPENAI_API_KEY || "").trim();
  return !key || key === "replace_with_your_real_key_here" ? null : key;
}

export function isConfigured() {
  return Boolean(getApiKey());
}

export async function generateJSON({ system, user, validate }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    const err = new Error("OPENAI_API_KEY em falta no .env — texto OpenAI indisponível.");
    err.httpStatus = 503;
    throw err;
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: `${system}\n\nResponde APENAS com JSON válido. Sem markdown, sem comentários.` },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      max_tokens: MAX_TOKENS,
      temperature: 0.9,
    }),
    signal: AbortSignal.timeout(180000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 401) {
      const err = new Error("OPENAI_API_KEY inválida ou sem permissão (401).");
      err.httpStatus = 401;
      throw err;
    }
    if (res.status === 429) {
      const err = new Error("Quota OpenAI esgotada (429/insufficient_quota). Carrega créditos em https://platform.openai.com/settings/organization/billing.");
      err.httpStatus = 429;
      throw err;
    }
    const err = new Error(`OpenAI texto ${res.status}: ${body.slice(0, 250)}`);
    err.httpStatus = 502;
    throw err;
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || "";
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const err = new Error("A OpenAI devolveu JSON inválido — tenta de novo.");
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
