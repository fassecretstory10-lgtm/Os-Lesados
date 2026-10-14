// OS LESADOS — pipeline unificado de geração de imagem.
//
// Fluxo (igual para qualquer fornecedor):
//   1. buildFullPrompt()  — prompt base + regras de produção + estilo (context.mjs)
//   2. collectRefs()      — refs do disco (personagens/cenário) + refs do frontend
//   3. provider.generate() — chamada ao fornecedor ativo (providers/index.mjs)
//   4. Normalização       — { base64, mimeType, model, provider, referenceCount, warnings }

import { buildFullPrompt, loadDiskRefs } from "./context.mjs";
import { resolveProvider } from "./providers/index.mjs";

const IMAGE_SIZE = process.env.IMAGE_SIZE || "1K";

function collectRefs(sceneContext = {}, references = []) {
  // 1. Refs do disco (personagens + cenário) — em falta = warning, não erro
  const { refs: diskRefs, warnings } = loadDiskRefs(sceneContext);

  // 2. Refs vindas do frontend (ex: continuidade de reframes com dataURL já gerado)
  const frontendRefs = (Array.isArray(references) ? references : [])
    .filter((r) => r?.base64)
    .map((r) => ({ label: r.label || "frontend-ref", mimeType: r.mimeType || "image/png", base64: r.base64 }));

  return { allRefs: [...diskRefs, ...frontendRefs], warnings };
}

/**
 * Corre o pipeline completo.
 * @param {object} args - { provider?, model?, prompt, sceneContext?, references? }
 */
export async function runImagePipeline({ provider: requestedProvider, model, prompt, sceneContext = {}, references = [] }) {
  if (!prompt || !String(prompt).trim()) {
    const err = new Error("Campo 'prompt' é obrigatório.");
    err.httpStatus = 400;
    throw err;
  }
  const provider = resolveProvider(requestedProvider);
  const fullText = buildFullPrompt(String(prompt));
  const { allRefs, warnings } = collectRefs(sceneContext, references);

  const img = await provider.generate({ model, prompt: fullText, refs: allRefs, imageSize: IMAGE_SIZE });
  if (!img?.base64) throw new Error("O fornecedor não devolveu imagem.");

  return {
    ok: true,
    provider: provider.id,
    model: model || null,
    mimeType: img.mimeType || "image/png",
    base64: img.base64,
    referenceCount: allRefs.length,
    warnings: [...warnings, ...(img.warnings || [])],
  };
}

/** Geração de teste ("Hello World") — sem refs, prompt fixo. */
export async function runTestPipeline({ provider: requestedProvider, model }) {
  const provider = resolveProvider(requestedProvider);
  const img = await provider.generate({
    model,
    prompt: "2D satirical animation test frame, thick black outlines, vibrant colors, empty TV studio, 16:9, no people, no text.",
    refs: [],
    imageSize: IMAGE_SIZE,
  });
  if (!img?.base64) throw new Error("O fornecedor não devolveu imagem.");
  const bytes = Buffer.from(img.base64, "base64").length;
  return { ok: true, provider: provider.id, model: model || null, bytes, mimeType: img.mimeType, warnings: img.warnings || [] };
}
