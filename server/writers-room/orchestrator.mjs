// Sala dos Argumentistas — orquestrador.
// Máquina de estados sequencial com paralelismo interno onde é independente:
// research(1 fetch) -> analista(1 IA) -> argumentista(1 IA) ->
// improvisador(3 IA em paralelo) -> crítico(3 IA em paralelo) ->
// revisão(≤2 IA em paralelo) -> showrunner(determinístico).
// Limites: MAX_AI_CALLS=12, timeout 150s/chamada, rondas de revisão ≤2.
// Sessões persistem em server/writers-room/sessions/*.json após cada etapa.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { research } from "./search.mjs";
import {
  AGENTS, investigatorQueries, runAnalista, runArgumentista,
  runImprovisador, runCritico, runRevisao, runShowrunner,
} from "./agents.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = path.join(__dirname, "sessions");
const MAX_AI_CALLS = 10;
const CALL_TIMEOUT_MS = 150000;
const MAX_REVISIONS = 2;

function ensureDir() { fs.mkdirSync(SESSIONS_DIR, { recursive: true }); }
function fileOf(id) { return path.join(SESSIONS_DIR, `${id}.json`); }

export function newSession(topic) {
  ensureDir();
  const id = `wr-${Date.now().toString(36)}`;
  const s = {
    id, topic: String(topic || "atualidade televisiva"), version: 1,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    status: "running", stage: "queued", stopped: false,
    agents: Object.fromEntries(AGENTS.map((a) => [a.id, { state: "espera", detail: "" }])),
    messages: [], sources: [], sourceErrors: [], combos: [],
    proposals: [], twists: [], critiques: [], ranking: [], shortlist: [],
    errors: [], stats: { aiCalls: 0, startedAt: Date.now() },
  };
  save(s);
  return s;
}

export function load(id) {
  const f = fileOf(String(id).replace(/[^a-z0-9-]/gi, ""));
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, "utf8"));
}

export function list() {
  ensureDir();
  return fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        const s = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), "utf8"));
        return { id: s.id, topic: s.topic, status: s.status, stage: s.stage, updatedAt: s.updatedAt, proposals: s.proposals.length, shortlist: s.shortlist.length };
      } catch { return null; }
    }).filter(Boolean)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

function save(s) {
  s.updatedAt = new Date().toISOString();
  fs.writeFileSync(fileOf(s.id), JSON.stringify(s, null, 1));
}

function setAgent(s, id, state, detail = "") {
  s.agents[id] = { state, detail };
  save(s);
}

function say(s, from, to, task, content, state = "ok") {
  s.messages.push({
    from, to: Array.isArray(to) ? to : [to], task,
    at: new Date().toISOString(), state,
    content: String(content).slice(0, 1200),
  });
  save(s);
}

async function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: timeout após ${Math.round(ms / 1000)}s`)), ms);
  });
  try { return await Promise.race([promise, timeout]); }
  finally { clearTimeout(timer); }
}

async function aiCall(s, geminiText, fn, label) {
  if (s.stats.aiCalls >= MAX_AI_CALLS) {
    throw new Error(`Limite de ${MAX_AI_CALLS} chamadas IA por sessão atingido (${label} não correu).`);
  }
  s.stats.aiCalls += 1;
  save(s);
  return withTimeout(fn(), CALL_TIMEOUT_MS, label);
}

function checkStop(s) {
  const disk = load(s.id);
  if (disk?.stopped) {
    s.status = "stopped";
    save(s);
    throw new Error("Sessão interrompida pelo utilizador.");
  }
}

function scenariosOf(root) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(root, "context", "backgrounds", "manifest.json"), "utf8"));
    return Object.keys(m);
  } catch { return ["Estúdio Central", "Corredor de Bastidores", "Gabinete do Diretor"]; }
}

function bibleOf(root) {
  const raw = fs.readFileSync(path.join(root, "context", "canon", "personagens.json"), "utf8");
  return (JSON.parse(raw).characters || []).map((c) => ({
    id: c.id, name: c.name, role: c.role, goals: c.goals || [], humor: c.humor || "", limits: c.limits || [],
  }));
}

/** Corre a sessão do início (ou continua de onde parou, saltando etapas feitas). */
export async function run(s, { root, geminiText }) {
  s.status = "running";
  save(s);
  const done = new Set(s.completedStages || []);
  const mark = (st) => { done.add(st); s.completedStages = [...done]; s.stage = st; save(s); };

  try {
    // 1. INVESTIGADOR (pesquisa real)
    if (!done.has("research")) {
      setAgent(s, "investigador", "pesquisar", "pesquisa web em curso");
      say(s, "showrunner", "investigador", "briefing", `Investiga: ${s.topic}. TVI, realities, daytime, polémicas recentes.`, "ok");
      const { sources, errors } = await research(investigatorQueries(s.topic));
      s.sources = sources;
      s.sourceErrors = errors;
      say(s, "investigador", "analista", "dossiê", `${sources.length} fontes (${errors.length} falhas).`, sources.length ? "ok" : "erro");
      if (!sources.length) throw new Error("Investigação sem fontes: verifica rede/bloqueios. Ver sourceErrors.");
      setAgent(s, "investigador", "concluído", `${sources.length} fontes`);
      mark("research");
    }
    checkStop(s);

    // 2. ANALISTA (1 IA)
    if (!done.has("analyze")) {
      setAgent(s, "analista", "gerar", "cruza factos × canon");
      const bible = bibleOf(root);
      const combos = await aiCall(s, geminiText,
        () => runAnalista({ geminiText, sources: s.sources, bible, scenarios: scenariosOf(root) }),
        "analista");
      if (!combos.length) throw new Error("Analista devolveu 0 combinações — resposta do modelo fora do formato.");
      s.combos = combos;
      say(s, "analista", ["argumentista", "improvisador"], "combinações", `${combos.length} combinações personagem×facto.`);
      setAgent(s, "analista", "concluído", `${combos.length} combinações`);
      mark("analyze");
    }
    checkStop(s);

    // 3. ARGUMENTISTA (1 IA, 10 premissas)
    if (!done.has("write")) {
      setAgent(s, "argumentista", "gerar", "10 premissas em curso");
      const proposals = await aiCall(s, geminiText,
        () => runArgumentista({
          geminiText,
          combos: s.combos,
          techniques: s.sources.filter((x) => x.kind === "tecnica"),
        }),
        "argumentista");
      if (!proposals.length) throw new Error("Argumentista devolveu 0 premissas — resposta do modelo fora do formato.");
      s.proposals = proposals;
      say(s, "argumentista", ["improvisador", "critico"], "premissas prontas", `${proposals.length} premissas (${proposals.filter((p) => p.absurdo).length} absurdas).`);
      setAgent(s, "argumentista", "concluído", `${proposals.length} premissas`);
      mark("write");
    }
    checkStop(s);

    // 4. IMPROVISADOR (paralelo, ≤4 IA)
    if (!done.has("twists")) {
      setAgent(s, "improvisador", "gerar", "reviravoltas absurdas em paralelo");
      const twists = await aiCallBurst(s, geminiText, "improvisador");
      s.twists = twists;
      say(s, "improvisador", "critico", "twists prontos", `${twists.length} pacotes de twists.`);
      setAgent(s, "improvisador", "concluído", `${twists.length} pacotes`);
      mark("twists");
    }
    checkStop(s);

    // 5. CRÍTICO (paralelo, ≤5 IA)
    if (!done.has("critique")) {
      setAgent(s, "critico", "criticar", "ataca as 5 melhores em paralelo");
      const critiques = await aiCallBurst(s, geminiText, "critico");
      s.critiques = critiques;
      say(s, "critico", "argumentista", "críticas prontas", `${critiques.length} críticas com defeito fatal + correção.`);
      setAgent(s, "critico", "concluído", `${critiques.length} críticas`);
      mark("critique");
    }
    checkStop(s);

    // 6. REVISÃO (≤3 IA em paralelo)
    if (!done.has("revise")) {
      setAgent(s, "argumentista", "rever", "revê as piores com correção");
      const revised = await aiCallBurst(s, geminiText, "revisao");
      applyRevisions(s, revised);
      say(s, "argumentista", "showrunner", "revisões prontas", `${revised.length} premissas revistas.`);
      setAgent(s, "argumentista", "concluído", "revisão feita");
      mark("revise");
    }

    // 7. SHOWRUNNER (determinístico)
    setAgent(s, "showrunner", "rever", "seleciona shortlist");
    const { ranking, shortlist } = runShowrunner({ proposals: s.proposals, critiques: s.critiques });
    s.ranking = ranking;
    s.shortlist = shortlist;
    s.proposals.forEach((p) => { p.state = shortlist.includes(p.id) ? "shortlist" : "proposta"; });
    say(s, "showrunner", "todos", `Shortlist: ${shortlist.join(", ") || "(vazia — revê critérios)"}.`);
    setAgent(s, "showrunner", "concluído", `${shortlist.length} na shortlist`);
    s.status = "done";
    s.stage = "done";
    save(s);
    return s;
  } catch (e) {
    if (s.status !== "stopped") {
      s.status = "error";
      s.errors.push(`${s.stage}: ${e.message}`);
      Object.keys(s.agents).forEach((id) => {
        if (s.agents[id].state !== "concluído") s.agents[id] = { state: "erro", detail: e.message.slice(0, 160) };
      });
      save(s);
    }
    throw e;
  }
}

// Rajadas paralelas com contagem exata de chamadas IA.
async function aiCallBurst(s, geminiText, kind) {
  if (kind === "improvisador") {
    const targets = s.proposals.filter((p) => !p.absurdo).slice(0, 3);
    const jobs = targets.map((p) => (async () => {
      if (s.stats.aiCalls >= MAX_AI_CALLS) throw new Error("Limite de chamadas IA atingido a meio da rajada.");
      s.stats.aiCalls += 1; save(s);
      const out = await withTimeout(
        runImprovisador({ geminiText, proposals: [p] }).then((r) => r[0]),
        CALL_TIMEOUT_MS, `improvisador[${p.id}]`
      );
      return out;
    })());
    return Promise.all(jobs);
  }
  if (kind === "critico") {
    const tops = s.proposals.slice(0, 3);
    const jobs = tops.map((p) => (async () => {
      if (s.stats.aiCalls >= MAX_AI_CALLS) throw new Error("Limite de chamadas IA atingido a meio da rajada.");
      s.stats.aiCalls += 1; save(s);
      const out = await withTimeout(
        runCritico({ geminiText, proposals: [p] }).then((r) => r[0]),
        CALL_TIMEOUT_MS, `critico[${p.id}]`
      );
      return out;
    })());
    return Promise.all(jobs);
  }
  if (kind === "revisao") {
    const byId = Object.fromEntries(s.critiques.map((c) => [c.proposalId, c]));
    const worst = [...s.proposals]
      .map((p) => ({ p, score: byId[p.id]?.score ?? 5 }))
      .sort((a, b) => a.score - b.score)
      .slice(0, MAX_REVISIONS);
    const jobs = worst.map(({ p }) => (async () => {
      if (s.stats.aiCalls >= MAX_AI_CALLS) throw new Error("Limite de chamadas IA atingido a meio da rajada.");
      s.stats.aiCalls += 1; save(s);
      const twist = (s.twists.find((t) => t.proposalId === p.id)?.twists || [])[0] || "";
      const out = await withTimeout(
        runRevisao({ geminiText, proposal: p, critique: byId[p.id] || { flaw: "", fix: "" }, twist }),
        CALL_TIMEOUT_MS, `revisao[${p.id}]`
      );
      return { proposalId: p.id, ...out };
    })());
    return Promise.all(jobs);
  }
  return [];
}

function applyRevisions(s, revised) {
  for (const r of revised) {
    const p = s.proposals.find((x) => x.id === r.proposalId);
    if (!p) continue;
    p.title = r.title || p.title;
    p.premise = r.premise || p.premise;
    p.payoff = r.payoff || p.payoff;
    p.state = "revista";
    p.revised = true;
  }
  save(s);
}

export function approveProposal(s, proposalId, verdict) {
  const p = s.proposals.find((x) => x.id === proposalId);
  if (!p) throw new Error("Proposta inexistente.");
  p.state = verdict === "reject" ? "rejeitada" : "aprovada";
  if (verdict === "approve" && !s.shortlist.includes(p.id)) s.shortlist.push(p.id);
  if (verdict === "reject") s.shortlist = s.shortlist.filter((id) => id !== p.id);
  save(s);
  return p;
}
