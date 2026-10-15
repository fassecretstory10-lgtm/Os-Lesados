// Sala dos Argumentistas — os 6 papéis lógicos.
// Cada agente tem instruções próprias e devolve dados estruturados distintos.
// Nada é simulado: cada resultado vem de pesquisa real ou de chamada IA real.

export const AGENTS = [
  { id: "investigador", name: "Investigador", icon: "🔎", desc: "Pesquisa factos reais na web." },
  { id: "analista", name: "Analista", icon: "🧩", desc: "Cruza factos com o canon e monta combinações." },
  { id: "argumentista", name: "Argumentista", icon: "✍️", desc: "Cria 10 premissas curtas." },
  { id: "improvisador", name: "Improvisador Absurdo", icon: "🤪", desc: "Leva situações ao absurdo cómico." },
  { id: "critico", name: "Crítico", icon: "🔪", desc: "Ataca clichés e finais previsíveis." },
  { id: "showrunner", name: "Showrunner", icon: "🎬", desc: "Seleciona a shortlist final." },
];

const EP_RULES = `Episódios de 60-90 segundos: 1 premissa clara, 1 conflito central, escalada rápida, 1 momento memorável, payoff ou cliffhanger. Máximo 3 personagens e 2 cenários por ideia. Sem subtramas.`;

// Extrai o primeiro array de objetos da resposta, seja qual for a chave.
// Os modelos variam os nomes das chaves; isto evita pipelines vazios.
function pickArray(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  for (const v of Object.values(data)) {
    if (Array.isArray(v) && v.length && v.every((x) => x && typeof x === "object")) return v;
  }
  for (const v of Object.values(data)) {
    if (Array.isArray(v) && v.length) return v;
  }
  return [];
}

function str(x, fb = "") {
  return x === undefined || x === null ? fb : String(x);
}

const S = () => ({ type: "string" });
const arrObj = (properties, required) => ({
  type: "array", items: { type: "object", properties, required },
});

// Schemas por agente (passados à API — sem isto o modelo adivinha o formato).
export const SCHEMAS = {
  combos: arrObj({
    chars: { type: "array", items: { type: "string" } },
    fact: S(), conflict: S(), engine: S(),
    sourceUrls: { type: "array", items: { type: "string" } },
  }, ["chars", "fact", "conflict", "engine"]),
  premissas: arrObj({
    title: S(), premise: S(),
    chars: { type: "array", items: { type: "string" } },
    scenario: S(), payoff: S(), absurdo: { type: "boolean" },
  }, ["title", "premise", "chars", "scenario", "payoff"]),
  twists: arrObj({ twist: S() }, ["twist"]),
  critica: {
    type: "object",
    properties: { score: { type: "number" }, flaw: S(), fix: S() },
    required: ["score", "flaw", "fix"],
  },
  revisao: {
    type: "object",
    properties: { title: S(), premise: S(), payoff: S() },
    required: ["title", "premise", "payoff"],
  },
};
export function investigatorQueries(topic) {
  // Agenda em 3 frentes: SITES TVI, FOFOCAS PT e TÉCNICA (histórias
  // cativantes, humor, caricatura). Cada fonte sai com kind facto|tecnica.
  const base = String(topic || "").trim();
  const qs = [];
  if (base) qs.push({ query: base, topic: "tópico", kind: "facto" });
  qs.push(
    { query: "site:tvi.iol.pt Dois às 10 momento insólito direto", topic: "sites TVI", kind: "facto" },
    { query: "site:tviplayer.iol.pt Secret Story Big Brother gala expulsão", topic: "sites TVI", kind: "facto" },
    { query: "CMTV manhãs polémica direto comentadores", topic: "fofocas PT", kind: "facto" },
    { query: "Passadeira Vermelha polémica comentadores famosos", topic: "fofocas PT", kind: "facto" },
    { query: "como escrever premissa cómica escalada payoff comédia", topic: "técnica", kind: "tecnica" },
    { query: "comedy writing premise escalation payoff rule of three caricature", topic: "técnica", kind: "tecnica" }
  );
  return qs.slice(0, 7);
}

export async function runAnalista({ geminiText, sources, bible, scenarios, continuity = "" }) {
  const facts = sources.slice(0, 10).map((s) => `- ${s.title} (${s.source}): ${s.snippet.slice(0, 160)} [${s.url}]`).join("\n");
  const cast = bible.map((c) => `- ${c.name} (${c.id}): ${c.role}. Quer: ${(c.goals || []).join("; ")}`).join("\n");
  const { data } = await geminiText.generateJSON({
    system: `Analista de formatos. Recebes FACTOS REAIS e o ELENCO. Devolves combinações personagem×facto com conflito e motor cómico. Devolves EXATAMENTE um array JSON de 6 objetos com as chaves chars, fact, conflict, engine e sourceUrls. Responde APENAS JSON. Sem markdown.`,
    user: `FACTOS:\n${facts}\n\nELENCO:\n${cast}\n\nCENÁRIOS DISPONÍVEIS: ${scenarios.join(", ")}.\n${continuity ? continuity + "\n" : ""}Devolve 6 combinações.`,
    schemaName: "analise",
    schema: SCHEMAS.combos,
  });
  return normalizeCombos(data);
}

function normalizeCombos(data) {
  return pickArray(data).slice(0, 6).map((c, i) => ({
    id: `c${i + 1}`,
    chars: [c.chars, c.elenco, c.personagens].find(Array.isArray)?.slice(0, 3) || [],
    fact: str(c.fact || c.facto || c.factoid || c.descoberta),
    conflict: str(c.conflict || c.conflito),
    engine: str(c.engine || c.motor),
    sourceUrls: [c.sourceUrls, c.fontes, c.urls].find(Array.isArray) || [],
  })).filter((c) => c.chars.length && c.conflict);
}

export async function runArgumentista({ geminiText, combos, bible, techniques = [] }) {
  const brief = combos.map((c) => `(${c.chars.join("+")}) ${c.conflict} Motor: ${c.engine}`).join("\n");
  const craft = techniques.slice(0, 3).map((t) => `- ${t.title}: ${String(t.snippet || "").slice(0, 200)}`).join("\n") || "(sem fontes de técnica; usa regra dos três, escalada e payoff)";
  const { data } = await geminiText.generateJSON({
    system: `Argumentista de sitcom PT-PT. 10 premissas de episódios de 60-90s: 1 frase de premissa + título + elenco (2-3) + cenário + payoff numa linha. Aplica estas TÉCNICAS de escrita cómica: ${craft} DUAS delas levadas ao ABSURDO total (objeto impossível, escala desproporcional, lógica de sonho) — marca-as com absurdo true. Devolves EXATAMENTE um array JSON de 10 objetos com as chaves title, premise, chars, scenario, payoff e absurdo. Responde APENAS JSON. Sem markdown.`,
    user: `Começa destas combinações (podes variar):\n${brief}\n\n${EP_RULES}`,
    schemaName: "premissas",
    schema: SCHEMAS.premissas,
  });
  const arr = pickArray(data);
  return arr.slice(0, 10).map((p, i) => ({
    id: `p${i + 1}`,
    title: str(p.title || p.titulo, `Ideia ${i + 1}`),
    premise: str(p.premise || p.premissa || p.logline || p.sinopse),
    chars: [p.chars, p.elenco, p.personagens].find(Array.isArray)?.slice(0, 3) || [],
    scenario: str(p.scenario || p.cenario),
    payoff: str(p.payoff || p.final),
    absurdo: Boolean(p.absurdo),
    state: "proposta",
  })).filter((p) => p.premise);
}

export async function runImprovisador({ geminiText, proposals }) {
  const targets = proposals.filter((p) => !p.absurdo).slice(0, 4);
  const out = [];
  for (const p of targets) {
    const { data } = await geminiText.generateJSON({
      system: `Improvisador absurdo. Recebes UMA premissa e devolves 2 reviravoltas inesperadas: gag visual impossível, troca de papéis, objeto que ganha vontade própria, escalada ilógica mas inevitável. Devolves EXATAMENTE um array JSON de 2 objetos com a chave twist. Responde APENAS JSON. Sem markdown.`,
      user: `Premissa: ${p.title} — ${p.premise} Elenco: ${p.chars.join(", ")}.`,
      schemaName: "twists",
    schema: SCHEMAS.twists,
    });
    const arr = pickArray(data);
    out.push({ proposalId: p.id, twists: arr.slice(0, 2).map((t) => str(t.twist || t.texto || t, "")).filter(Boolean) });
  }
  return out;
}

export async function runCritico({ geminiText, proposals }) {
  const tops = proposals.slice(0, 5);
  const out = [];
  for (const p of tops) {
    const { data } = await geminiText.generateJSON({
      system: `Crítico implacável de comédia. Aponta: clichés, falta de escalada, final previsível, personagem fora da voz, premissa que não cabe em 90 segundos. Uma nota 0-10 e UM defeito fatal + UMA correção concreta. Devolves EXATAMENTE um objeto JSON com as chaves score, flaw e fix. Responde APENAS JSON. Sem markdown.`,
      user: `Premissa: ${p.title} — ${p.premise} Payoff: ${p.payoff}`,
      schemaName: "critica",
    schema: SCHEMAS.critica,
    });
    const c = pickArray(data)[0] || data;
    out.push({
      proposalId: p.id,
      score: Math.max(0, Math.min(10, Number(c?.score ?? c?.nota ?? 5))),
      flaw: str(c?.flaw || c?.defeito),
      fix: str(c?.fix || c?.correcao),
    });
  }
  return out;
}

export async function runRevisao({ geminiText, proposal, critique, twist }) {
  const { data } = await geminiText.generateJSON({
    system: `Argumentista a rever. Recebes premissa + crítica + reviravolta opcional. Devolve a premissa REESCRITA (mesma alma, defeito corrigido, twist integrado se ajudar) + payoff novo. Responde APENAS JSON. Sem markdown.`,
    user: `Premissa: ${proposal.title} — ${proposal.premise}\nCrítica: ${critique.flaw} Correção: ${critique.fix}\nTwist disponível: ${twist || "(nenhum)"}`,
    schemaName: "revisao",
    schema: SCHEMAS.revisao,
  });
  const r = pickArray(data)[0] || data;
  return {
    title: str(r?.title || r?.titulo, proposal.title),
    premise: str(r?.premise || r?.premissa, proposal.premise),
    payoff: str(r?.payoff || r?.final, proposal.payoff),
  };
}

// Showrunner determinístico: ordena por score do crítico + bónus absurdo com
// payoff + penalização sem fontes. Seleção explicável, sem IA.
export function runShowrunner({ proposals, critiques, minScore = 6, max = 5 }) {
  const byId = Object.fromEntries(critiques.map((c) => [c.proposalId, c]));
  const scored = proposals.map((p) => {
    const c = byId[p.id];
    let score = c ? c.score : 5;
    let why = c ? `crítica ${c.score}/10` : "sem crítica";
    if (p.absurdo && p.payoff) { score += 1; why += " + bónus absurdo com payoff"; }
    if (!p.payoff) { score -= 2; why += " − sem payoff"; }
    return { id: p.id, score: Math.min(10, score), why, flaw: c?.flaw || "", fix: c?.fix || "" };
  });
  scored.sort((a, b) => b.score - a.score);
  return { ranking: scored, shortlist: scored.filter((s) => s.score >= minScore).slice(0, max).map((s) => s.id) };
}
