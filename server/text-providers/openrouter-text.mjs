// Texto narrativo via OpenRouter (API compatível com OpenAI).
// Chave via env: OPENROUTER_API_KEY (gratuita, sem cartão, em openrouter.ai/keys).
// Modelo via env: TEXT_OPENROUTER_MODEL (default nvidia/nemotron-3-ultra-550b-a55b:free
// — veredito do teste lado a lado out-2026: JSON válido, vozes marcadas, payoff forte).
// Tier free: 50 req/dia, 20/min. Um guião gasta 1–2.

export const id = "openrouter-text";
export const DEFAULT_MODEL = process.env.TEXT_OPENROUTER_MODEL || "nvidia/nemotron-3-ultra-550b-a55b:free";
const MAX_TOKENS = Number(process.env.TEXT_MAX_TOKENS || 8192);

// Rotação multi-modelo: os limites free aplicam-se por modelo/endpoint, por
// isso esgotar um não bloqueia os outros. TEXT_OPENROUTER_MODELS (vírgulas)
// sobrepõe-se a TEXT_OPENROUTER_MODEL.
function getModels() {
  const list = String(process.env.TEXT_OPENROUTER_MODELS || "").trim();
  const models = list ? list.split(",").map((x) => x.trim()).filter(Boolean) : [DEFAULT_MODEL];
  if (!list) {
    models.push(
      "qwen/qwen3.8-27b:free",
      "thinkingmachines/inkling-small:free",
      "google/gemma-4-31b-it:free",
      "nvidia/nemotron-3.5-lightning:free"
    );
  }
  return [...new Set(models)];
}

function getApiKey() {
  const key = String(process.env.OPENROUTER_API_KEY || "").trim();
  return !key || key === "replace_with_your_real_key_here" ? null : key;
}

// Os endpoints free por vezes embrulham o JSON em texto. Tenta parse direto,
// depois o primeiro bloco {...} ou [...] equilibrado.
function extractJSON(text) {
  const found = scanJSON(String(text || "").trim());
  if (found) return found;
  return scanJSON(String(text || "").replace(/[\u0000-\u001F\u007F]+/g, " ").trim());
}

function scanJSON(t) {
  try { return JSON.parse(t); } catch {}
  for (const [open, close] of [["{", "}"], ["[", "]"]]) {
    const start = t.indexOf(open);
    if (start < 0) continue;
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < t.length; i++) {
      const ch = t[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') inStr = true;
      else if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (!depth) {
          try { return JSON.parse(t.slice(start, i + 1)); } catch { break; }
        }
      }
    }
  }
  return null;
}

export function isConfigured() {
  return Boolean(getApiKey());
}

export async function generateJSON({ system, user, validate }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    const err = new Error("OPENROUTER_API_KEY em falta no .env — texto OpenRouter indisponível.");
    err.httpStatus = 503;
    throw err;
  }
  let lastErr = null;
  const triedModels = [];
  for (const model of getModels()) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await requestOnce({ apiKey, model, system, user, validate });
      } catch (e) {
        lastErr = e;
        // 401 (chave) não roda: falha já. 429/502 rodam para o próximo modelo.
        if (e.httpStatus === 401) throw e;
        if (e.httpStatus !== 429 && e.httpStatus !== 502) throw e;
        if (attempt === 2) break;
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
    triedModels.push(model);
  }
  if (lastErr && triedModels.length) {
    lastErr.message += ` (modelos esgotados: ${triedModels.join(", ")})`;
  }
  throw lastErr;
}

async function requestOnce({ apiKey, model, system, user, validate }) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:8787",
      "X-Title": "Os Lesados",
    },
    body: JSON.stringify({
      model,
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
      const err = new Error("OPENROUTER_API_KEY inválida ou sem permissão (401). Gera outra em https://openrouter.ai/keys.");
      err.httpStatus = 401;
      throw err;
    }
    if (res.status === 429) {
      const err = new Error("Limite free do OpenRouter atingido (429: 50 req/dia ou 20/min). Espera ou troca TEXT_OPENROUTER_MODEL.");
      err.httpStatus = 429;
      throw err;
    }
    const err = new Error(`OpenRouter texto ${res.status}: ${body.slice(0, 250)}`);
    err.httpStatus = 502;
    throw err;
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || "";
  const parsed = extractJSON(text);
  if (!parsed) {
    const err = new Error(`O OpenRouter devolveu JSON inválido — tenta de novo. Trecho: ${text.slice(0, 200)}`);
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
