// Fornecedor: Google Gemini — Nano Banana (SDK oficial @google/genai, Interactions API v2).
// Chave via env: GEMINI_API_KEY (placeholder seguro em .env.example).

import { GoogleGenAI } from "@google/genai";

export const id = "gemini";
export const label = "Google Gemini (Nano Banana)";
export const keyEnvVar = "GEMINI_API_KEY";

// Aliases usados no frontend -> modelos reais da Gemini API.
// Qualquer outro "gemini-*" passa direto (passthrough).
const MODEL_MAP = {
  "gemini-nano-banana-2.1": "gemini-2.5-flash-image",
  "gemini-3-pro-image": "gemini-3-pro-image-preview",
};

export function resolveModel(aliasOrReal) {
  const raw = String(aliasOrReal || "").trim() || "gemini-nano-banana-2.1";
  return MODEL_MAP[raw] || raw;
}

function getApiKey() {
  const key = String(process.env.GEMINI_API_KEY || "").trim();
  return !key || key === "replace_with_your_real_key_here" ? null : key;
}

export function isConfigured() {
  return Boolean(getApiKey());
}

export function isRateLimitError(e) {
  const status = e?.status || e?.response?.status;
  if (status === 429) return true;
  const msg = String(e?.message || "").toLowerCase();
  return msg.includes("429") || msg.includes("quota") || msg.includes("rate limit") || msg.includes("resource_exhausted");
}

function extractImageFromInteraction(interaction) {
  // SDK >= 2.0: interaction.output_image = { data, mime_type }
  const oi = interaction?.output_image || interaction?.outputImage;
  if (oi?.data) {
    return { base64: oi.data, mimeType: oi.mime_type || oi.mimeType || "image/png" };
  }
  // Alternativa v2: steps[] -> { type:'model_output', content:[{type:'image',...}] }
  const steps = interaction?.steps;
  if (Array.isArray(steps)) {
    for (const s of steps) {
      const contents = s?.content;
      if (Array.isArray(contents)) {
        for (const c of contents) {
          const inline = c?.inlineData || c?.inline_data;
          if ((c?.type === "image" || inline) && (c?.data || inline?.data)) {
            return {
              base64: c?.data || inline?.data,
              mimeType: c?.mime_type || c?.mimeType || inline?.mimeType || inline?.mime_type || "image/png",
            };
          }
        }
      }
    }
  }
  return null;
}

function extractImageFromGenerateContent(response) {
  const candidates = response?.candidates || [];
  for (const c of candidates) {
    const parts = c?.content?.parts || [];
    for (const p of parts) {
      if (p?.inlineData?.data) {
        return { base64: p.inlineData.data, mimeType: p.inlineData.mimeType || "image/png" };
      }
      if (p?.inline_data?.data) {
        return { base64: p.inline_data.data, mimeType: p.inline_data.mime_type || "image/png" };
      }
    }
  }
  return null;
}

/**
 * Gera uma imagem. Interface comum a todos os fornecedores:
 * @param {object} args - { model, prompt (já final), refs: [{label,mimeType,base64}], imageSize }
 * @returns {Promise<{base64, mimeType, warnings: string[]}>}
 */
export async function generate({ model, prompt, refs = [], imageSize = "1K" }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    const err = new Error("GEMINI_API_KEY em falta. Define no .env (vê .env.example).");
    err.httpStatus = 503;
    throw err;
  }
  const ai = new GoogleGenAI({ apiKey });
  const resolved = resolveModel(model);

  // Input Interactions API: mistura de texto + imagens base64
  const input = [{ type: "text", text: prompt }];
  for (const r of refs) {
    if (r?.base64) {
      input.push({ type: "image", data: r.base64, mime_type: r.mimeType || "image/jpeg" });
    }
  }

  // 1) Interactions API v2 (caminho oficial Nano Banana)
  if (ai.interactions?.create) {
    try {
      const interaction = await ai.interactions.create({
        model: resolved,
        input,
        response_format: { type: "image", aspect_ratio: "16:9", image_size: imageSize },
      });
      const img = extractImageFromInteraction(interaction);
      if (img?.base64) return { ...img, warnings: [] };
      throw new Error("A API não devolveu imagem (outputs vazio).");
    } catch (e) {
      const msg = String(e?.message || "").toLowerCase();
      const notFound = msg.includes("not found") || msg.includes("not_found") || String(e?.status) === "404";
      if (!notFound) throw e;
      console.warn(`[gemini] modelo ${resolved} não encontrado via interactions, a tentar generateContent... (${e.message})`);
    }
  }

  // 2) Fallback: models.generateContent
  const contents = [
    { text: prompt },
    ...refs.filter((r) => r?.base64).map((r) => ({
      inlineData: { mimeType: r.mimeType || "image/jpeg", data: r.base64 },
    })),
  ];
  const response = await ai.models.generateContent({
    model: resolved,
    contents,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: { aspectRatio: "16:9", imageSize: imageSize },
    },
  });
  const img = extractImageFromGenerateContent(response);
  if (img?.base64) return { ...img, warnings: [] };
  throw new Error("A API não devolveu imagem (generateContent sem inlineData).");
}
