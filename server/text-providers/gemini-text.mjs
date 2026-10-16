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
      // Entradas tardias: [{who, fromBeat (1-based), where}] — a personagem
      // NÃO pode aparecer (who/diálogo) nos beats anteriores.
      lateEntries: {
        type: "array",
        items: { type: "object", properties: { who: S(), fromBeat: { type: "number" }, where: S() }, required: ["who", "fromBeat"] },
      },
      // Tag final opcional (cena extra integrada, com duração contada).
      tag: {
        type: "object",
        properties: { where: S(), setup: S(), payoff: S(), dialogue: S() },
      },
      // Voice-over opcional de abertura/fecho (conta na duração).
      voiceOver: {
        type: "object",
        properties: { open: S(), close: S() },
      },
    },
    required: ["comicIdea", "protagonist", "protagonistGoal", "incident", "conflict", "beats", "climax", "resolution", "punchline"],
  };
}

const S = () => ({ type: "string" });

// Estimativa de duração (segundos), calibrada para comédia (não leitura de
// notícias): diálogo PT ~11 chars/s; cada beat tem 3s base de ação; pausas e
// silêncios +1,5s; transições 1,5s; tag e voice-overs contabilizados.
// Tolerância do validador: ±15s.
export function estimateDuration(s) {
  const CPS = 11;
  const secs = (t) => (t && typeof t === "string" ? t.length / CPS : 0);
  let total = 0;
  const beats = Array.isArray(s?.beats) ? s.beats : [];
  beats.forEach((b) => {
    total += 3 + secs(b?.dialogue);
    if (/pausa|silêncio|silencio|freeze|congel/i.test(`${b?.does || ""} ${b?.dialogue || ""}`)) total += 1.5;
  });
  if (beats.length > 1) total += (beats.length - 1) * 1.5;
  if (s?.tag && typeof s.tag === "object") total += 3 + secs(s.tag.dialogue) + secs(s.tag.setup) * 0.3;
  if (s?.voiceOver && typeof s.voiceOver === "object") total += secs(s.voiceOver.open) + secs(s.voiceOver.close);
  return Math.round(total);
}

// Validação server-side (não confia só no schema da API).
export function validateStory(s, target = 75) {
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
  // Entradas tardias: who não pode aparecer (who/diálogo) antes de fromBeat.
  if (Array.isArray(s.lateEntries)) {
    for (const le of s.lateEntries) {
      const who = String(le?.who || "").toLowerCase();
      const from = Number(le?.fromBeat || 1);
      if (!who || !(Number.isFinite(from) && from > 1)) continue;
      const beats = Array.isArray(s.beats) ? s.beats : [];
      beats.slice(0, from - 1).forEach((b, i) => {
        const hay = `${b?.who || ""} ${b?.dialogue || ""}`.toLowerCase();
        if (hay.includes(who)) problems.push(`${who} aparece no beat ${i + 1} mas só entra no beat ${from} (lateEntries)`);
      });
    }
  }
  // Duração: estimativa vs alvo (tolerância ±15s).
  const est = estimateDuration(s);
  if (Math.abs(est - target) > 15) {
    problems.push(`duração estimada ${est}s fora do alvo ${target}s ±15 (beats+tag+VOs contabilizados)`);
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
- locations: escolhe entre Estúdio Central, Corredor de Bastidores, Gabinete do Diretor, Camarim, Hall TVI, Exterior da Estação.
ESTRUTURA E ELENCO:
- Presença serve a estrutura: personagens só entram nos beats onde a história precisa delas. Revelações tardias usam lateEntries [{who, fromBeat, where}] e NÃO aparecem antes.
- Abelha Maia é OCASIONAL: só entra se tiver função narrativa ou cómica própria. Sem voice-over obrigatório; o episódio pode abrir a frio (cena/ação/conflito) e fechar em reação, payoff visual ou consequência.
- Diálogo natural e específico da personagem; nada de jargão corporativo genérico ("pivot para nicho premium").
- Números de audiência: só com métrica explícita (rating/share) ou formulação claramente ficcional; nunca misturar conceitos.
- Decisões importantes (sobretudo do Capitão) em linguagem clara com consequência compreensível; conciso não é críptico. Capitão decide e veta recursos; Patribunal processa e sentencia — não confundir.
- Ações filmáveis: o que se vê e ouve (expressões, gestos, objetos, reações), nunca instruções abstratas ("narrativa desmontada").
- Tag final opcional em tag {where, setup, payoff, dialogue} — integrada e contada na duração.`;
}
