// Testes do motor narrativo (frontend) — determinísticos, sem rede, sem quota.
// Uso: node --test tools/test-narrative.mjs
// Carrega o <script> do index.html com stubs mínimos de DOM/storage.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function makeEl(id) {
  return {
    id, innerHTML: "", textContent: "", value: "", disabled: false,
    dataset: {}, style: {}, innerText: "",
    addEventListener() {}, querySelectorAll: () => [], appendChild() {},
  };
}

function loadApp({ search = "", protocol = "http:" } = {}, presetStore = null) {
  const els = {};
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  assert.ok(m, "bloco <script> existe no index.html");
  const store = presetStore || {};
  const sandbox = {
    document: {
      getElementById: (id) => els[id] || (els[id] = makeEl(id)),
      querySelectorAll: () => [],
      querySelector: () => makeEl("q"),
      addEventListener: (ev, fn) => { if (ev === "DOMContentLoaded") sandbox.__ready = fn; },
      createElement: () => makeEl("x"),
    },
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    location: { protocol, href: "http://localhost:8787/" + search, search },
    navigator: {},
    confirm: () => true,
    setTimeout: (fn) => { fn(); return 0; },
    clearTimeout: () => {},
    fetch: async () => { throw new Error("rede bloqueada nos testes"); },
  };
  const names = Object.keys(sandbox);
  const fn = new Function(...names, `${m[1]}; return {
    detectCast, normalizeAIStory, storyToScenes, auditStory, audit, currentEpisode,
    sanitize, normalize, buildTagScene, pickColdOpen, validateImported,
    classifyFormat, estimateDuration, FORMATS, EP_MAX_SECONDS,
    touchTake, pushRevision, restoreRevision, approveScript,
    get state() { return state; }, setState(v) { state = v; },
    charById, VERSION, EPISODE_SCHEMA
  };`);
  const api = fn(...names.map((k) => sandbox[k]));
  api.__ready?.();
  return { api, els, store, sandbox };
}

test("detectCast encontra elenco por keywords", () => {
  const { api } = loadApp();
  assert.deepEqual(api.detectCast("O Capitão veta a grelha da Tininha"), ["capitao", "tininha"]);
  assert.deepEqual(api.detectCast("Abelha Maia em direto"), ["abelha"]);
  assert.deepEqual(api.detectCast("UM DIA NORMAL SEM NOMES CONHECIDOS"), []);
});

test("normalizeAIStory mapeia nomes→ids e valida estrutura", () => {
  const { api } = loadApp();
  const raw = {
    comicIdea: "x", protagonist: "Capitão Gancho", protagonistGoal: "y",
    incident: "veto", conflict: "a vs b",
    beats: [
      { who: "Capitão Gancho", want: "mandar", does: "Veta", obstacle: "o", result: "r", change: "c", link: "l", comic: "k", dialogue: "Capitão: Está decidido.", location: "Gabinete do Diretor" },
      { who: "Tininha", want: "w", does: "d", obstacle: "o", result: "r", change: "c", link: "l", comic: "k", dialogue: "Tininha: Claro.", location: "Gabinete do Diretor" },
      { who: "Desconhecido Total", want: "w", does: "d", obstacle: "o", result: "r", change: "c", link: "l", comic: "k", dialogue: "", location: "Lua" },
    ],
    climax: "c", resolution: "r", punchline: "p",
  };
  const s = api.normalizeAIStory(raw, "premissa", ["capitao", "tininha"]);
  assert.equal(s.beats[0].who, "capitao");
  assert.equal(s.beats[2].who, "capitao"); // desconhecido -> stars[0]
  assert.equal(s.beats[2].loc, "Estúdio Central"); // fallback: local anterior conhecido
  assert.equal(s.beats[0].dialogue.char, "capitao");
  assert.ok(!s.beats[0].dialogue.line.startsWith("Capitão"));
});

test("storyToScenes: timecodes sequenciais, clamp de duração, reframe só com função", () => {
  const { api } = loadApp();
  const beat = (over = {}) => ({
    kind: "setup", who: "capitao", with: "tininha", loc: "Estúdio Central", want: "w", does: "A faz X",
    obstacle: "o", result: "r", change: "c", link: "l", comic: "k",
    dialogue: { char: "capitao", paren: "", line: "Está decidido." }, dur: 6, ...over,
  });
  const story = {
    stars: ["capitao", "tininha"], premise: "p",
    beats: [
      beat(),
      beat({ kind: "incident", who: "tininha", with: "capitao", does: "B faz Y", dur: 99, dialogue: { char: "tininha", paren: "", line: "Claro." } }),
      beat({ kind: "resolution", who: "capitao", with: null, does: "C fecha", dur: 1, dialogue: null, reframe: true }),
    ],
  };
  const scenes = api.storyToScenes(story);
  // Uma bandeira solta não chega: o reframe só existe com função (razão + ação).
  assert.equal(scenes.length, 3);
  assert.ok(scenes[1].duration <= 8); // clamp
  assert.ok(scenes[2].duration >= 4);
  // Com função, entra um plano próprio, no mesmo cenário do master.
  const comFuncao = {
    ...story,
    beats: story.beats.map((b, i) => i === 2
      ? { ...b, needsReframe: true, reframeReason: "fecho", reframeAction: "Aproximar no gancho sobre a mesa." }
      : b),
  };
  const comReframe = api.storyToScenes(comFuncao);
  assert.equal(comReframe.length, 4); // 3 masters + 1 reframe
  const rf = comReframe.find((s) => s.reframeOf);
  assert.ok(rf, "o reframe tem master de origem");
  assert.equal(rf.location, "Estúdio Central");
  // timecodes sem overlap: fim[i] <= início[i+1]
  const tc = comReframe.map((s) => s.timecode.split(" - ").map((t) => t.split(":").reduce((a, b) => a * 60 + Number(b), 0)));
  for (let i = 1; i < tc.length; i++) assert.ok(tc[i][0] >= tc[i - 1][1], `overlap em ${comReframe[i].id}`);
});

test("auditStory deteta repetição, ação igual e objetivo em falta", () => {
  const { api } = loadApp();
  const ep = {
    story: {
      premise: "barco no estúdio central", incident: "barco parte-se",
      stars: ["perpetua", "mario"],
      beats: [
        { who: "perpetua", want: "passear de barco", does: "Pede um barco", obstacle: "não há", result: "dizem que não", change: "a", link: "b", comic: "c" },
        { who: "mario", want: "", does: "Pede um barco", obstacle: "não há", result: "dizem que não", change: "a", link: "b", comic: "c" },
      ],
      resolution: "tudo arde no estúdio central",
    },
    scenes: [
      { id: "n1", location: "Estúdio Central", action: "Pede um barco", prompt: "x Estúdio Central y", dialogue: { char: "perpetua", line: "MESMA FALA" }, duration: 5 },
      { id: "n2", location: "Estúdio Central", action: "Pede um barco", prompt: "x Estúdio Central y", dialogue: { char: "mario", line: "MESMA FALA" }, duration: 5 },
    ],
  };
  const msgs = api.auditStory(ep).map((i) => i.msg).join(" | ");
  assert.match(msgs, /repetido/i);
  assert.match(msgs, /sem progressão|repetida/i);
  assert.match(msgs, /sem objetivo/i);
});

test("currentEpisode sem fallback silencioso + validateImported", () => {
  const { api } = loadApp();
  api.setState({ version: api.VERSION, seasons: [{ id: "s1", name: "S1", episodes: [{ id: "e1", number: 1, scenes: [] }] }], currentSeason: "s1", currentEpisode: "zzz", currentScene: null });
  assert.equal(api.currentEpisode(), null);
  assert.equal(api.validateImported(null), "ficheiro inválido (não é objeto)");
  assert.equal(api.validateImported({ seasons: [{ episodes: [{ id: 1 }] }] }), "episódio inválido (id/scenes)");
  assert.equal(api.validateImported({ seasons: [{ id: "s1", episodes: [{ id: "e1", scenes: [] }] }] }), null);
});

test("sanitize idempotente e sem nomes reais", () => {
  const { api } = loadApp();
  const once = api.sanitize("Goucha e Moniz na Cristina Ferreira");
  assert.ok(!/Goucha|Moniz|Cristina Ferreira/i.test(once));
  assert.equal(api.sanitize(once), once);
});

test("Fase 3: classifyFormat explica + estimateDuration por conteúdo + teto", () => {
  const { api } = loadApp();
  const f1 = api.classifyFormat("O Capitão veta a grelha em reunião de emergência", ["capitao"]);
  assert.equal(f1.id, "confronto");
  assert.ok(f1.why.includes("vet"));
  const f2 = api.classifyFormat("Um dia normal sem marcadores óbvios aqui", ["coxa"]);
  assert.equal(f2.id, "situacao");
  const scenes = [
    { location: "Estúdio Central", action: "Age com calma total", dialogue: { char: "coxa", line: "Olá a todos bem vindos ao direto de hoje" } },
    { location: "Estúdio Central", action: "Reage", dialogue: null },
    { location: "Corredor de Bastidores", action: "Corre", dialogue: { char: "coxa", line: "Espera" } },
  ];
  const est = api.estimateDuration(scenes);
  assert.ok(est.seconds > 0 && est.breakdown.dialogue > 0 && est.breakdown.action > 0);
  assert.equal(est.over, false);
  const long = api.estimateDuration(new Array(40).fill(scenes[0]));
  assert.equal(long.over, true);
  assert.equal(long.ceiling, api.EP_MAX_SECONDS);
});
test("Fase 4: edição localizada só toca no take; revisões guardam/restauram com imagens", () => {
  const { api } = loadApp();
  const ep = {
    id: "e1", number: 1, name: "T", premise: "P", schemaVersion: 2, storyVersion: 1,
    scriptApproved: false, revisions: [],
    story: {
      premise: "P", incident: "I", stars: ["coxa", "claudio"],
      beats: [
        { kind: "setup", who: "coxa", with: "claudio", loc: "Estúdio Central", want: "q", does: "A faz X", obstacle: "o", result: "r", change: "c", link: "l", comic: "k", dialogue: { char: "coxa", paren: "", line: "Olá." }, dur: 6 },
        { kind: "resolution", who: "coxa", with: null, loc: "Estúdio Central", want: "q", does: "B fecha Y", obstacle: "o", result: "r", change: "c", link: "l", comic: "k", dialogue: null, dur: 5 },
      ],
      resolution: "fecha Y",
    },
    scenes: api.storyToScenes({
      stars: ["coxa", "claudio"], premise: "P",
      beats: [
        { kind: "setup", who: "coxa", with: "claudio", loc: "Estúdio Central", want: "q", does: "A faz X", obstacle: "o", result: "r", change: "c", link: "l", comic: "k", dialogue: { char: "coxa", paren: "", line: "Olá." }, dur: 6 },
        { kind: "resolution", who: "coxa", with: null, loc: "Estúdio Central", want: "q", does: "B fecha Y", obstacle: "o", result: "r", change: "c", link: "l", comic: "k", dialogue: null, dur: 5 },
      ],
    }, 1),
  };
  const before = ep.scenes[1].action;
  // usa a função real de toque localizado
  ep.scenes[1].action = "B fecha Z de outra maneira";
  api.touchTake(ep, ep.scenes[1]);
  assert.ok(ep.scenes[0].action.includes("A faz X"));
  assert.notEqual(ep.scenes[1].action, before);
  assert.ok(Array.isArray(ep.audit) && ep.audit.length > 0); // revalidado
  // revisão guarda e restaura preservando imagens por id
  ep.scenes[0].imageUrl = "data:image/png;base64,AAA";
  ep.scenes[0].approved = true;
  api.pushRevision(ep, "teste");
  assert.equal(ep.revisions.length, 1);
  ep.scenes[0].action = "DESTRUÍDO";
  ep.scenes[0].imageUrl = null;
  assert.equal(api.restoreRevision(ep, 0), true);
  assert.ok(ep.scenes[0].action.includes("A faz X"));
  assert.equal(ep.scenes[0].imageUrl, "data:image/png;base64,AAA"); // imagem preservada
  assert.equal(ep.scenes[0].approved, true);
  assert.equal(ep.revisions.length, 2); // restauro guarda snapshot primeiro
  assert.equal(api.restoreRevision(ep, 99), false);
});
test("Fase 5: cobertura por cena com teto + preserve de assets + staleness", () => {
  const { api } = loadApp();
  const story = {
    stars: ["coxa", "claudio"], premise: "P",
    beats: [
      { kind: "setup", who: "coxa", with: "claudio", loc: "Estúdio Central", want: "querer algo", does: "A faz X", obstacle: "trava", result: "muda", change: "a", link: "b", comic: "k", dialogue: { char: "coxa", paren: "", line: "Olá." }, dur: 6 },
      { kind: "resolution", who: "coxa", with: null, loc: "Estúdio Central", want: "querer algo", does: "B fecha Y", obstacle: "trava", result: "muda", change: "a", link: "b", comic: "k", dialogue: null, dur: 5 },
    ],
  };
  const scenes = api.storyToScenes(story, 2);
  assert.ok(scenes.every((s) => s.sceneId === "s1"));
  assert.deepEqual(scenes.map((s) => s.function), ["master", "group"]);
  // teto de 4: forçar 5 takes na mesma cena dispara warning
  const clones = [0, 1, 2].map((i) => {
    const base = scenes[i % scenes.length];
    return { ...base, id: "x" + i, dialogue: null, action: base.action + " (variação " + i + ")" };
  });
  const ep = { story: { ...story, stars: ["coxa", "claudio"], premise: "P barco", incident: "I" }, scenes: [...scenes, ...clones] };
  const msgs = api.auditStory(ep).map((i) => i.msg).join(" | ");
  assert.match(msgs, /cobertura acima do teto/);
});
test("Fase 2: takes levam sv + clipApproved; migração preenche sem reescrever", () => {
  const { api, store } = loadApp();
  const story = {
    stars: ["coxa", "claudio"], premise: "p",
    beats: [
      { kind: "setup", who: "coxa", with: "claudio", loc: "Estúdio Central", want: "querer", does: "faz", obstacle: "trava", result: "muda", change: "a", link: "b", comic: "c", dialogue: { char: "coxa", paren: "", line: "Olá." }, dur: 6 },
      { kind: "resolution", who: "coxa", with: null, loc: "Estúdio Central", want: "querer", does: "fecha", obstacle: "trava", result: "muda", change: "a", link: "b", comic: "c", dialogue: null, dur: 5 },
    ],
  };
  const scenes = api.storyToScenes(story, 3);
  assert.ok(scenes.every((s) => s.sv === 3 && s.clipApproved === false));
  // legacy sem campos novos -> normalize preenche, sem tocar em conteúdo
  const legacy = {
    "osLesados_html": JSON.stringify({
      version: "os-lesados-html-unico-v1",
      seasons: [{ id: "s1", name: "S1", episodes: [{ id: "e1", number: 1, name: "Velho", premise: "P", scenes: [{ id: "1a", location: "Estúdio Central", action: "Age", characters: [], duration: 5 }] }] }],
      currentSeason: "s1", currentEpisode: "e1", currentScene: null,
    }),
  };
  const holder = loadApp({}, legacy);
  holder.sandbox.__ready?.();
  const ep = holder.api.state.seasons[0].episodes[0];
  assert.equal(ep.schemaVersion, 1);
  assert.equal(ep.storyVersion, 1);
  assert.equal(ep.scenes[0].clipApproved, false);
  assert.equal(ep.scenes[0].sv, 1);
  assert.equal(ep.scenes[0].action, "Age"); // conteúdo intacto
  assert.equal(ep.story, null); // legacy sem história continua sem história
});
