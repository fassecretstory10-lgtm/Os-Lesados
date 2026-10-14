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
    get state() { return state; }, setState(v) { state = v; },
    charById, VERSION
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

test("storyToScenes: timecodes sequenciais, clamp de duração, reframe só com função", () => {  const { api } = loadApp();
  const story = {
    stars: ["capitao", "tininha"], premise: "p",
    beats: [
      { kind: "setup", who: "capitao", with: "tininha", loc: "Estúdio Central", want: "w", does: "A faz X", obstacle: "o", result: "r", change: "c", link: "l", comic: "k", dialogue: { char: "capitao", paren: "", line: "Está decidido." }, dur: 6 },
      { kind: "incident", who: "tininha", with: "capitao", loc: "Estúdio Central", want: "w", does: "B faz Y", obstacle: "o", result: "r", change: "c", link: "l", comic: "k", dialogue: { char: "tininha", paren: "", line: "Claro." }, dur: 99 },
      { kind: "resolution", who: "capitao", with: null, loc: "Estúdio Central", want: "w", does: "C fecha", obstacle: "o", result: "r", change: "c", link: "l", comic: "k", dialogue: null, dur: 1, reframe: true },
    ],
  };
  const scenes = api.storyToScenes(story);
  assert.equal(scenes.length, 4); // 3 masters + 1 reframe
  assert.ok(scenes[1].duration <= 8); // clamp
  assert.ok(scenes[2].duration >= 4);
  const rf = scenes.find((s) => s.reframeOf);
  assert.equal(rf.location, "Estúdio Central");
  // timecodes sem overlap: fim[i] <= início[i+1]
  const tc = scenes.map((s) => s.timecode.split(" - ").map((t) => t.split(":").reduce((a, b) => a * 60 + Number(b), 0)));
  for (let i = 1; i < tc.length; i++) assert.ok(tc[i][0] >= tc[i - 1][1], `overlap em ${scenes[i].id}`);
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
