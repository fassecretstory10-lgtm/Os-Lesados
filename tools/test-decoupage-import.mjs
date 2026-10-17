// Teste de regressão do import a partir da decupagem aprovada.
// Uso: node --test tools/test-decoupage-import.mjs
//
// Garante três coisas que já partiram em produção:
// 1. um episódio com decupagem no arquivo importa OS PLANOS APROVADOS (o id, o
//    enquadramento, a câmara e as falas da decupagem), não uma decomposição
//    inventada do guião;
// 2. cada prompt só menciona quem está VISÍVEL nesse plano;
// 3. o bloco positivo do prompt é inglês e não descreve o resultado da ação
//    (o still é o primeiro momento do plano, não o seu fim).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function makeEl(id) {
  return {
    id, innerHTML: "", textContent: "", value: "", disabled: false,
    dataset: {}, style: {}, innerText: "", classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {}, querySelectorAll: () => [], appendChild() {},
  };
}

function loadApp() {
  const els = {};
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  assert.ok(m, "bloco <script> existe no index.html");
  const store = {};
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
    location: { protocol: "http:", href: "http://localhost:8787/", search: "" },
    navigator: {},
    confirm: () => true,
    setTimeout: (fn) => { fn(); return 0; },
    clearTimeout: () => {},
    fetch: async () => { throw new Error("rede bloqueada nos testes"); },
  };
  const names = Object.keys(sandbox);
  const fn = new Function(...names, `${m[1]}; return {
    importRepoEpisode, buildPrompt, buildVideoPrompt, sceneLines, promptNeedsEnglish,
    charById, REPO_EPISODES,
    get state() { return state; }
  };`);
  const api = fn(...names.map((k) => sandbox[k]));
  api.__ready?.();
  return { api, els };
}

function importEpisode(api, number) {
  api.importRepoEpisode(number);
  const ep = api.state.seasons.flatMap((s) => s.episodes).find((e) => Number(e.repoEpisodeNumber) === number);
  assert.ok(ep, "episódio importado existe na produção");
  return ep;
}

test("um episódio com decupagem no arquivo importa os planos aprovados", () => {
  const { api } = loadApp();
  assert.ok(api.REPO_EPISODES.length, "o arquivo embebido tem episódios");
  const ep = importEpisode(api, 1);

  assert.equal(ep.fromDecoupage, true, "o import usa a decupagem, não o guião");
  assert.deepEqual(
    ep.scenes.map((s) => s.id),
    ["1a", "2a", "3a", "4a", "5a", "6a", "7a", "8a", "9a"],
    "os nove planos são os da decupagem aprovada"
  );

  const by = Object.fromEntries(ep.scenes.map((s) => [s.id, s]));
  // Establishing de exterior sem personagens, com zoom in.
  assert.deepEqual(by["1a"].characters, []);
  assert.equal(by["1a"].camera, "SLOW ZOOM IN");
  // Receção: Teresa e a rececionista, nada mais.
  assert.deepEqual(by["2a"].characters, ["teresa", "rececionista"]);
  assert.equal(by["2a"].location, "Hall TVI (receção)");
  // Gabinete: master + continuações do mesmo master angle.
  assert.equal(by["4a"].reframeOf, null);
  assert.equal(by["5a"].reframeOf, "4a");
  // Zoom in final sobre Teresa.
  assert.equal(by["9a"].camera, "SLOW ZOOM IN");

  // As falas aprovadas chegam intactas, com o português exato.
  const line2a = api.sceneLines(by["2a"]).map((l) => l.line);
  assert.deepEqual(line2a, [
    "Desculpe, tem marcação?",
    "Tenho assuntos a tratar com o Capitão Gancho.",
    "Sem marcação não pode passar.",
    "Sabe quem eu sou? Ou já apagaram a memória desta casa?",
  ]);
});

test("os prompts só mencionam quem está visível no plano", () => {
  const { api } = loadApp();
  const ep = importEpisode(api, 1);
  const by = Object.fromEntries(ep.scenes.map((s) => [s.id, s]));

  // A rececionista não tem folha de referência: tem de ser descrita por
  // palavras, com sexo explícito — foi daqui que saiu um homem que não existe.
  assert.match(by["2a"].imagePrompt, /Rececionista — young woman/);
  assert.doesNotMatch(by["2a"].imagePrompt, /young man|a man|male/);
  // Ninguém que não esteja no plano entra na lista de quem está em frame.
  assert.doesNotMatch(by["2a"].imagePrompt.slice(by["2a"].imagePrompt.indexOf("In frame:")), /Tininha|Capitão|Fã/);
  // Establishing sem personagens não pode ganhar pessoas.
  assert.match(by["1a"].imagePrompt, /nobody — environment only, no people/);
  // A voz off não é desenhada.
  assert.doesNotMatch(by["9a"].imagePrompt, /Voz Off/);
});

test("o bloco positivo do prompt é inglês e mostra o início do plano", () => {
  const { api } = loadApp();
  const ep = importEpisode(api, 1);
  const by = Object.fromEntries(ep.scenes.map((s) => [s.id, s]));

  for (const scene of ep.scenes) {
    assert.equal(api.promptNeedsEnglish(scene), false, `plano ${scene.id} tem o prompt em inglês`);
    // Sanitização (AGENTS.md): o positivo descreve só o que é visível. Nada de
    // «sem porta», «fora de frame» ou do texto português da ação.
    assert.doesNotMatch(scene.imagePrompt, /\b(sem|fora de frame|out of frame|without|no closet)\b/);
    assert.doesNotMatch(scene.imagePrompt, /torniquete|receção|salta|gabinete|corredor/);
  }

  // O resultado da ação vai para o prompt de animação, não para o still.
  assert.doesNotMatch(by["2a"].imagePrompt, /jump over the turnstile/);
  assert.match(by["2a"].animationPrompt, /jump over the turnstile/);
  // As falas entram no prompt de vídeo exatamente como no guião, em PT-PT.
  assert.match(api.buildVideoPrompt(by["2a"]), /Spoken dialogue \(European Portuguese, exact words, lip-synced/);
  assert.match(api.buildVideoPrompt(by["2a"]), /"Sabe quem eu sou\? Ou já apagaram a memória desta casa\?"/);
});

test("o índice publica a decupagem aprovada do episódio 1", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "Temporadas", "Temporada-1", "manifest.json"), "utf8"));
  const ep = (manifest.episodes || []).find((e) => e.number === 1);
  assert.ok(ep, "episódio 1 está no índice");
  assert.equal(ep.decoupagePath, "docs/episodios/T1E01-a-rainha-dos-reality-shows-decupagem.md");
  assert.equal(ep.decoupageStatus, "Completa");
  assert.ok(fs.existsSync(path.join(ROOT, ep.decoupagePath)), "o ficheiro da decupagem existe");
});
