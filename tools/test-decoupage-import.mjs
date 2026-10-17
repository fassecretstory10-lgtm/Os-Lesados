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
    shotLoadWarning, shotAngleWarning, charById, REPO_EPISODES,
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
    ["1a", "2a", "2b", "2c", "3a", "4a", "5a", "6a", "6b", "7a", "8a", "9a"],
    "os planos são os da decupagem aprovada, com a receção e o título divididos"
  );

  const by = Object.fromEntries(ep.scenes.map((s) => [s.id, s]));
  // Establishing de exterior sem personagens, com zoom in.
  assert.deepEqual(by["1a"].characters, []);
  assert.equal(by["1a"].camera, "SLOW ZOOM IN");
  // Receção: Teresa e a rececionista, nada mais — em nenhum dos três planos.
  assert.deepEqual(by["2a"].characters, ["teresa", "rececionista"]);
  assert.deepEqual(by["2b"].characters, ["teresa", "rececionista"]);
  assert.deepEqual(by["2c"].characters, ["teresa", "rececionista"]);
  assert.equal(by["2a"].location, "Hall TVI (receção)");
  assert.equal(by["2b"].location, "Hall TVI (receção)");
  assert.equal(by["2b"].reframeOf, "2a");
  // Gabinete: master + continuações do mesmo master angle.
  assert.equal(by["4a"].reframeOf, null);
  assert.equal(by["5a"].reframeOf, "4a");
  // Zoom in final sobre Teresa.
  assert.equal(by["9a"].camera, "SLOW ZOOM IN");

  // As falas aprovadas chegam intactas, com o português exato, e a divisão não
  // as repete: cada fala pertence a um só plano.
  const linesOf = (id) => api.sceneLines(by[id]).map((l) => l.line);
  assert.deepEqual(linesOf("2a"), [
    "Desculpe, tem marcação?",
    "Tenho assuntos a tratar com o Capitão Gancho.",
  ]);
  assert.deepEqual(linesOf("2b"), [
    "Sem marcação não pode passar.",
    "Sabe quem eu sou? Ou já apagaram a memória desta casa?",
  ]);
  // O salto dos torniquetes é ação, não fala.
  assert.equal(linesOf("2c").length, 0);
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

  // O resultado da ação vai para o prompt de animação, não para o still: o still
  // de um plano de ação mostra o momento do salto, não o que vem depois.
  assert.doesNotMatch(by["2a"].imagePrompt, /airborne|mid-jump|jump/);
  assert.match(by["2c"].imagePrompt, /airborne mid-jump/);
  assert.doesNotMatch(by["2c"].imagePrompt, /continues on her way|left behind/);
  assert.match(by["2c"].animationPrompt, /clears the turnstile/);
  assert.match(by["2c"].animationPrompt, /left behind/);
  // As falas entram no prompt de vídeo exatamente como no guião, em PT-PT.
  assert.match(api.buildVideoPrompt(by["2a"]), /Spoken dialogue \(European Portuguese PT-PT, exact words, lip-synced/);
  assert.match(api.buildVideoPrompt(by["2a"]), /"Tenho assuntos a tratar com o Capitão Gancho\."/);
});

test("um take aguenta duas falas e 8 s, e ângulos seguidos não se repetem", () => {
  const { api } = loadApp();
  const ep = importEpisode(api, 1);
  const by = Object.fromEntries(ep.scenes.map((s) => [s.id, s]));

  // A receção era um só plano de 12–16 s com quatro falas: passou a três planos,
  // cada um com o seu enquadramento.
  assert.notEqual(by["2b"].shot, by["2a"].shot, "o plano médio muda o enquadramento face ao master");
  assert.notEqual(by["2c"].shot, by["2b"].shot, "o plano de ação muda o enquadramento face ao anterior");
  // O salto é uma ação legível num plano próprio, com eixo lateral.
  assert.match(by["2c"].animationPrompt, /lateral wide angle/);
  // Nenhum take passa de duas falas nem de 8 s.
  for (const s of ep.scenes) {
    assert.ok(api.sceneLines(s).length <= 2, `plano ${s.id} leva no máximo duas falas`);
    assert.ok(Number(s.duration) <= 8, `plano ${s.id} cabe nos 8 s do take`);
  }
  // O aviso dispara num take carregado e fica calado nos que foram divididos.
  const loaded = { ...by["2a"], dialogueLines: [{ char: "teresa", line: "a" }, { char: "teresa", line: "b" }, { char: "teresa", line: "c" }] };
  assert.match(api.shotLoadWarning(loaded), /3 falas/);
  assert.equal(api.shotLoadWarning(by["2b"]), "");
  assert.match(api.shotLoadWarning({ duration: 12 }), /pode cortar/);
  // Repetir enquadramento e câmara no plano seguinte é sempre sinalizado.
  assert.match(api.shotAngleWarning({ sceneId: "4", shot: "WIDE SHOT", camera: "STATIC" }, { sceneId: "4", shot: "WIDE SHOT", camera: "STATIC" }), /muda o ângulo/);
  assert.equal(api.shotAngleWarning({ sceneId: "4", shot: "MEDIUM SHOT", camera: "STATIC" }, { sceneId: "4", shot: "WIDE SHOT", camera: "STATIC" }), "");
  // Cenas diferentes podem repetir o eixo: são setups distintos.
  assert.equal(api.shotAngleWarning({ sceneId: "5", shot: "WIDE SHOT", camera: "STATIC" }, { sceneId: "4", shot: "WIDE SHOT", camera: "STATIC" }), "");
});

test("o prompt de vídeo diz quem fala, o tipo de voz, e separa a voz-off", () => {
  const { api } = loadApp();
  const ep = importEpisode(api, 1);
  const by = Object.fromEntries(ep.scenes.map((s) => [s.id, s]));

  // Cada fala leva quem a diz, o tipo de voz dessa personagem e o texto exato.
  const v2a = api.buildVideoPrompt(by["2a"]);
  assert.match(v2a, /- Rececionista \[[^\]]+\]: "Desculpe, tem marcação\?"/);
  assert.match(v2a, /- Teresa \[[^\]]+\]: "Tenho assuntos a tratar com o Capitão Gancho\."/);
  const vox = v2a.match(/- Teresa \[([^\]]+)\]/);
  assert.ok(vox && /PT-PT/.test(vox[1]), "o tipo de voz aparece entre parênteses retos e diz PT-PT");
  // No prompt de vídeo ela é só «Teresa» (o still já traz a folha de referência);
  // o nome completo continua no elenco e no prompt de imagem.
  assert.doesNotMatch(v2a, /Teresa Guilhermina I de Portugal/);
  assert.match(by["2a"].imagePrompt, /Teresa Guilhermina I de Portugal/);

  // A voz-off não é lip-sync: bloco próprio, sem ninguém em cena a falar.
  const v9a = api.buildVideoPrompt(by["9a"]);
  const offIdx = v9a.indexOf("Off-screen voice-over (European Portuguese PT-PT, exact words, NOT lip-synced");
  assert.ok(offIdx > 0, "a voz-off tem bloco próprio e não é marcada como lip-sync");
  assert.match(v9a.slice(offIdx), /- Voz Off \[[^\]]+\]: "/);
  const onIdx = v9a.indexOf("Spoken dialogue");
  if (onIdx >= 0) {
    assert.ok(onIdx < offIdx && !v9a.slice(onIdx, offIdx).includes("Voz Off"), "a voz-off não entra no bloco do lip-sync");
  }
});

test("o índice publica a decupagem aprovada do episódio 1", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "Temporadas", "Temporada-1", "manifest.json"), "utf8"));
  const ep = (manifest.episodes || []).find((e) => e.number === 1);
  assert.ok(ep, "episódio 1 está no índice");
  assert.equal(ep.decoupagePath, "docs/episodios/T1E01-a-rainha-dos-reality-shows-decupagem.md");
  assert.equal(ep.decoupageStatus, "Completa");
  assert.ok(fs.existsSync(path.join(ROOT, ep.decoupagePath)), "o ficheiro da decupagem existe");
});
