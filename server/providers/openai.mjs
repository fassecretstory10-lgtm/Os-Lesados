// Fornecedor: OpenAI — família gpt-image (REST, sem dependências extra).
// Chave via env: OPENAI_API_KEY (placeholder seguro em .env.example).
// Modelo via env: OPENAI_IMAGE_MODEL (default "gpt-image-1").
//
// ARQUITETURA:
// - Sem refs  -> POST /v1/images/generations (text-to-image, 1536x1024 = 16:9).
// - Com refs  -> POST /v1/images/edits (multipart image[] + prompt): as fotos
//   de personagens/cenário entram como edição, dando continuidade visual.
// DALL-E clássico continua suportado (fallback por URL) se o modelo começar
// por "dall-e", mas esta chave só tem a família gpt-image.

import { Buffer } from "node:buffer";

export const id = "openai";
export const label = "OpenAI gpt-image";
export const keyEnvVar = "OPENAI_API_KEY";

const SIZE_16_9 = "1536x1024"; // landscape 3:2 ≈ 16:9 em gpt-image
const MAX_PROMPT_CHARS = 32000; // limite folgado do gpt-image
const MAX_EDIT_IMAGES = 8;

function getApiKey() {
  const key = String(process.env.OPENAI_API_KEY || "").trim();
  return !key || key === "replace_with_your_real_key_here" ? null : key;
}

export function isConfigured() {
  return Boolean(getApiKey());
}

export function isRateLimitError(e) {
  if (e?.httpStatus === 429) return true;
  const msg = String(e?.message || "").toLowerCase();
  return msg.includes("429") || msg.includes("rate limit") || msg.includes("quota") || msg.includes("billing");
}

function throwOpenAIError(res, body) {
  const err = new Error(`OpenAI ${res.status}: ${body.slice(0, 300) || res.statusText}`);
  err.httpStatus = res.status === 401 ? 401 : res.status === 429 ? 429 : 502;
  if (res.status === 401) err.message = "OPENAI_API_KEY inválida ou sem permissão (401).";
  throw err;
}

async function downloadToBase64(url) {
  const imgRes = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!imgRes.ok) throw new Error(`Falha ao descarregar imagem da OpenAI (HTTP ${imgRes.status}).`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const mime = (imgRes.headers.get("content-type") || "image/png").split(";")[0].trim();
  return { base64: buf.toString("base64"), mimeType: mime };
}

/**
 * Interface comum: ({ model, prompt, refs }) -> { base64, mimeType, warnings }.
 */
export async function generate({ model, prompt, refs = [] }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    const err = new Error("OPENAI_API_KEY em falta. Define no .env (vê .env.example).");
    err.httpStatus = 503;
    throw err;
  }
  const warnings = [];
  let text = String(prompt);
  if (text.length > MAX_PROMPT_CHARS) {
    text = text.slice(0, MAX_PROMPT_CHARS);
    warnings.push(`Prompt truncado a ${MAX_PROMPT_CHARS} caracteres.`);
  }

  const chosen = String(model || "").trim() || process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const headers = { Authorization: `Bearer ${apiKey}` };

  // ---- Caminho A: com referências -> edits (continuidade visual) ----
  if (refs.length && !chosen.startsWith("dall-e")) {
    const usable = refs.filter((r) => r?.base64).slice(0, MAX_EDIT_IMAGES);
    if (refs.length > usable.length) {
      warnings.push(`Só as primeiras ${MAX_EDIT_IMAGES} referências foram enviadas (limite do edits).`);
    }
    const form = new FormData();
    form.append("model", chosen);
    form.append("prompt", `Edit/regenerate as a 16:9 2D TV cartoon frame. Keep the identity, faces, costumes and location of the attached reference images. New scene action: ${text}`);
    for (const [i, r] of usable.entries()) {
      const buf = Buffer.from(r.base64, "base64");
      const ext = (r.mimeType || "").includes("png") ? "png" : "jpg";
      form.append("image[]", new Blob([buf], { type: r.mimeType || "image/jpeg" }), `ref${i}.${ext}`);
    }
    form.append("size", SIZE_16_9);

    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers,
      body: form,
      signal: AbortSignal.timeout(180000),
    });
    if (!res.ok) throwOpenAIError(res, await res.text().catch(() => ""));
    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (b64) return { base64: b64, mimeType: "image/png", warnings };
    const url = data?.data?.[0]?.url;
    if (!url) throw new Error("A OpenAI não devolveu imagem (edits sem dados).");
    const dl = await downloadToBase64(url);
    return { ...dl, warnings };
  }

  // ---- Caminho B: text-to-image (generations) ----
  const body = { model: chosen, prompt: text, n: 1 };
  if (chosen.startsWith("gpt-image")) {
    body.size = SIZE_16_9;
    body.quality = process.env.OPENAI_IMAGE_QUALITY || "medium";
  } else {
    body.size = "1792x1024"; // dall-e-3 16:9 (sem response_format: devolve URL)
  }

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180000),
  });
  if (!res.ok) throwOpenAIError(res, await res.text().catch(() => ""));
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (b64) return { base64: b64, mimeType: "image/png", warnings };
  const url = data?.data?.[0]?.url;
  if (!url) throw new Error("A OpenAI não devolveu imagem (resposta sem dados).");
  const dl = await downloadToBase64(url);
  return { ...dl, warnings };
}
