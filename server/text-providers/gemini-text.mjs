// Camada de geração de TEXTO narrativo (independente dos providers de imagem).
// Implementação: Google Gemini, modelo configurável via TEXT_MODEL.
// Chave via env: GEMINI_API_KEY (a mesma; texto tem quota própria).
// Sem chave/quota -> ERRO explícito. Sem fallback silencioso, nunca.

export const id = "gemini-text";
export const DEFAULT_MODEL = process.env.TEXT_MODEL || "gemini-2.5-flash";
// Uma história completa com 4–7 beats precisa de ~3500 tokens; 2048 corta o
// JSON a meio (confirmado em teste). Default folgado, configurável.
const MAX_TOKENS = Number(process.env.TEXT_MAX_TOKENS || 8192);

function getApiKey() {
  const key = String(process.env.GEMINI_API_KEY || "").trim();
  return !key || key === "replace_with_your_real_key_here" ? null : key;
}

// Rotação de chaves: GEMINI_API_KEY + GEMINI_API_KEYS (separadas por vírgula).
// Em 429, passa à próxima; chaves arrefecem 5 min antes de reutilizar.
const keyCooldown = new Map();
function getApiKeys() {
  const extra = String(process.env.GEMINI_API_KEYS || "").split(",").map(s => s.trim()).filter(Boolean);
  const all = [getApiKey(), ...extra].filter(Boolean);
  return [...new Set(all)];
}
function cooledKey() {
  const now = Date.now();
  return getApiKeys().filter(k => (keyCooldown.get(k) || 0) < now);
}

export function isConfigured() {
  return getApiKeys().length > 0;
}

/**
 * Gera JSON estruturado com validação de schema.
 * @param {object} args - { system, user, schemaName }
 * @returns {Promise<object>} objeto validado (parseado)
 */
export async function generateJSON({ system, user, schemaName = "story", schema = null }) {
  const keys = cooledKey();
  if (!keys.length) {
    const err = getApiKeys().length
      ? new Error("Todas as chaves em arrefecimento (429 recente). Espera ~5 min ou adiciona outra chave em GEMINI_API_KEYS.")
      : new Error("GEMINI_API_KEY em falta no .env — geração narrativa por IA indisponível.");
    err.httpStatus = getApiKeys().length ? 429 : 503;
    throw err;
  }
  const { GoogleGenAI } = await import("@google/genai");
  const useSchema = schema || storySchema();
  const validate = schema ? (() => []) : validateStory;
  let lastErr = null;
  for (const apiKey of keys) {
    const ai = new GoogleGenAI({ apiKey });
    let response;
    try {
      response = await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: [
          { role: "user", parts: [{ text: `${system}\n\nResponde APENAS com JSON válido conforme o schema. Sem markdown, sem comentários.` }] },
          { role: "user", parts: [{ text: user }] },
        ],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: useSchema,
          maxOutputTokens: MAX_TOKENS,
          temperature: 0.9,
        },
      });
    } catch (e) {
      const mapped = mapError(e);
      if (mapped.httpStatus === 429) {
        keyCooldown.set(apiKey, Date.now() + 5 * 60 * 1000);
        lastErr = mapped;
        continue; // tenta a próxima chave
      }
      throw mapped;
    }
    let parsed;
    try {
      parsed = JSON.parse(response.text || "");
    } catch {
      const cut = (response.candidates || []).some((c) => c.finishReason === "MAX_TOKENS");
      const err = new Error(cut
        ? `Resposta cortada por limite de tokens (${MAX_TOKENS}). Aumenta TEXT_MAX_TOKENS no .env.`
        : "O modelo devolveu JSON inválido — tenta de novo.");
      err.httpStatus = 502;
      throw err;
    }
    const problems = validate(parsed);
    if (problems.length) {
      const err = new Error(`Schema inválido do modelo: ${problems.join("; ")}`);
      err.httpStatus = 502;
      throw err;
    }
    return parsed;
  }
  throw lastErr || new Error("Falha na geração de texto.");
}

function mapError(e) {
  const status = e?.status || e?.response?.status;
  const msg = String(e?.message || "");
  if (status === 429 || /quota|rate limit|429/i.test(msg)) {
    const err = new Error("Quota de texto esgotada (429). Tenta mais tarde ou verifica https://ai.dev/rate-limit.");
    err.httpStatus = 429;
    return err;
  }
  if (status === 401 || status === 403 || /API key|API_KEY/i.test(msg)) {
    const err = new Error("GEMINI_API_KEY inválida ou sem permissão para texto.");
    err.httpStatus = 401;
    return err;
  }
  const err = new Error(`Falha na geração de texto: ${msg.slice(0, 250)}`);
  err.httpStatus = 502;
  return err;
}

// JSON Schema (subset suportado pela API) do objeto story.
export function storySchema() {
  const strArr = { type: "array", items: { type: "string" } };
  return {
    type: "object",
    properties: {
      comicIdea: { type: "string" },
      protagonist: { type: "string" },
      protagonistGoal: { type: "string" },
      incident: { type: "string" },
      conflict: { type: "string" },
      beats: {
        type: "array",
        items: {
          type: "object",
          properties: {
            who: { type: "string" },
            want: { type: "string" },
            does: { type: "string" },
            obstacle: { type: "string" },
            result: { type: "string" },
            change: { type: "string" },
            link: { type: "string" },
            comic: { type: "string" },
            dialogue: { type: "string" },
            location: { type: "string" },
          },
          required: ["who", "want", "does", "obstacle", "result", "change", "link", "comic"],
        },
      },
      climax: { type: "string" },
      resolution: { type: "string" },
      punchline: { type: "string" },
      guestLines: strArr,
    },
    required: ["comicIdea", "protagonist", "protagonistGoal", "incident", "conflict", "beats", "climax", "resolution", "punchline"],
  };
}

// Validação server-side (não confia só no schema da API).
export function validateStory(s) {
  const problems = [];
  if (!s || typeof s !== "object") return ["resposta não é objeto"];
  if (!s.protagonist || typeof s.protagonist !== "string" || s.protagonist.length < 2) {
    problems.push("protagonist em falta");
  }
  for (const f of ["comicIdea", "protagonistGoal", "incident", "conflict", "climax", "resolution", "punchline"]) {
    if (!s[f] || typeof s[f] !== "string" || s[f].length < 10) problems.push(`${f} em falta/curto`);
  }
  if (!Array.isArray(s.beats) || s.beats.length < 3 || s.beats.length > 9) {
    problems.push("beats deve ter 3–9 elementos");
  } else {
    s.beats.forEach((b, i) => {
      for (const f of ["who", "want", "does", "obstacle", "result", "change", "link", "comic"]) {
        if (!b?.[f] || typeof b[f] !== "string" || b[f].length < 3) problems.push(`beats[${i}].${f} em falta`);
      }
    });
    const lines = s.beats.map((b) => (b.dialogue || "").trim()).filter(Boolean);
    const seen = new Set();
    for (const l of lines) {
      if (seen.has(l)) problems.push(`diálogo repetido: "${l.slice(0, 40)}"`);
      seen.add(l);
    }
  }
  return problems;
}

// Prompt de sistema: fixa regras do universo sem colar a bíblia inteira.
export function storySystemPrompt(castCards) {
  const cards = castCards.map((c) =>
    `- ${c.name} (${c.id}): ${c.role}. Quer: ${c.goals.join("; ")}. Humor: ${c.humor} Limites: ${c.limits.join("; ")}`
  ).join("\n");
  return `Escreves episódios da sitcom de animação portuguesa OS LESADOS (2D TV cartoon).
ELENCO DISPONÍVEL (usa SÓ estes IDs em beats[].who e começa falas com o nome):
${cards}
REGRAS ABSOLUTAS:
- Escreve em PT-PT. Nunca nomes reais (Goucha, Moniz, Cristina Ferreira, Teresa Guilherme).
- beats[] contam a história por ordem causal: cada beat muda o estado (change) e liga ao seguinte (link).
- Diálogos curtos (1-2 frases), na voz de cada um; NUNCA repetir a mesma fala.
- resolution decorre obrigatoriamente de incident+beats (causa→efeito).
- punchline inverte ou faz callback (nunca moral séria).
- locations: escolhe entre Estúdio Central, Corredor de Bastidores, Gabinete do Diretor, Camarim, Hall TVI, Exterior da Estação.`;
}
