// TOP DO PIPELINE — configuração do fornecedor de geração de imagem.
//
// Como escolher o fornecedor (por ordem de prioridade):
//   1. Campo "provider" no corpo do pedido (POST /api/generate-image, /api/test)
//   2. Variável de ambiente IMAGE_PROVIDER no .env
//   3. Default: "gemini"
//
// Valores válidos: "gemini" | "openai" | "huggingface" | "cloudflare"
// Para adicionar um fornecedor novo: criar server/providers/<nome>.mjs com a
// mesma interface (id, label, keyEnvVar, isConfigured(), generate()) e
// registá-lo no PROVIDERS abaixo. Nada mais precisa de mudar.

import * as gemini from "./gemini.mjs";
import * as openai from "./openai.mjs";
import * as huggingface from "./huggingface.mjs";
import * as cloudflare from "./cloudflare.mjs";

const PROVIDERS = { gemini, openai, huggingface, cloudflare };

export const PROVIDER_IDS = Object.keys(PROVIDERS);
export const DEFAULT_PROVIDER = "gemini";

export function activeProviderName() {
  const raw = String(process.env.IMAGE_PROVIDER || "").trim().toLowerCase();
  return PROVIDERS[raw] ? raw : DEFAULT_PROVIDER;
}

/** Resolve e valida o fornecedor (override do pedido > env > default). */
export function resolveProvider(requested) {
  const name = String(requested || "").trim().toLowerCase() || activeProviderName();
  const provider = PROVIDERS[name];
  if (!provider) {
    const err = new Error(`Fornecedor desconhecido: "${requested}". Válidos: ${PROVIDER_IDS.join(", ")}.`);
    err.httpStatus = 400;
    throw err;
  }
  return provider;
}

/** Estado dos fornecedores para /api/health (só booleanos — nunca valores de chaves). */
export function providerStatus() {
  const status = {};
  for (const [name, p] of Object.entries(PROVIDERS)) {
    status[name] = { label: p.label, keyConfigured: Boolean(p.isConfigured?.()) };
  }
  return status;
}
