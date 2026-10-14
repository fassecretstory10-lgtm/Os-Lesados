// Fornecedor: Hugging Face — Inference API (REST, sem dependências extra).
// Token via env: HF_TOKEN (placeholder seguro em .env.example; opcional mas
// recomendado — sem token os limites anónimos são muito baixos).
// Modelo via env: HF_IMAGE_MODEL (default "stabilityai/stable-diffusion-xl-base-1.0").
//
// NOTA DE ARQUITETURA: text-to-image simples — NÃO usa imagens de referência
// (ignoradas com warning). O estilo/props viajam só no texto do prompt.

export const id = "huggingface";
export const label = "Hugging Face (Inference API)";
export const keyEnvVar = "HF_TOKEN"; // opcional

function getToken() {
  const t = String(process.env.HF_TOKEN || "").trim();
  return !t || t === "replace_with_your_real_token_here" ? null : t;
}

export function isConfigured() {
  // Funciona sem token (limites anónimos), mas o token é recomendado.
  return true;
}

export function hasToken() {
  return Boolean(getToken());
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
  const warnings = [];
  if (refs.length) {
    warnings.push(
      `${refs.length} referência(s) visual(is) ignorada(s): o modelo HF é text-to-image e não aceita imagens de referência.`
    );
  }
  if (!getToken()) {
    warnings.push("Sem HF_TOKEN: a usar acesso anónimo (limites baixos, modelos podem estar a carregar).");
  }

  const modelId = String(model || "").includes("/")
    ? model
    : (process.env.HF_IMAGE_MODEL || "stabilityai/stable-diffusion-xl-base-1.0");

  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ inputs: String(prompt) }),
    signal: AbortSignal.timeout(180000),
  });

  const contentType = res.headers.get("content-type") || "";
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      // 503 com estimated_time = modelo a carregar no HF.
      if (res.status === 503 && j?.estimated_time) {
        const err = new Error(`Modelo HF a carregar (pronto em ~${Math.ceil(j.estimated_time)}s). Tenta de novo.`);
        err.httpStatus = 503;
        throw err;
      }
      detail = j?.error || JSON.stringify(j).slice(0, 300);
    } catch (e) {
      if (e?.httpStatus) throw e;
    }
    const err = new Error(`Hugging Face ${res.status}: ${String(detail).slice(0, 300)}`);
    err.httpStatus = res.status === 401 || res.status === 403 ? 401 : res.status === 429 ? 429 : 502;
    throw err;
  }

  if (!contentType.startsWith("image/")) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Resposta inesperada do HF (não é imagem): ${txt.slice(0, 200)}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const mime = contentType.split(";")[0].trim() || "image/png";
  return { base64: buf.toString("base64"), mimeType: mime, warnings };
}
