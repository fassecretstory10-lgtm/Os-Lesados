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

function loadApp(seed = {}) {
  const els = {};
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  assert.ok(m, "bloco <script> existe no index.html");
  const store = Object.assign({}, seed);
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
    shotLoadWarning, shotAngleWarning, archiveDecoupageDrift, archiveDriftBanner,
    charById, REPO_EPISODES,
    voiceForPrompt, buildVideoClips, clipKey, clipVideoPrompt, clipVideoNote, joinsVideoTake, switchTab,
    bootStep, bootErrors,
    get state() { return state; }
  };`);
  const api = fn(...names.map((k) => sandbox[k]));
  // O arranque (DOMContentLoaded) só corre quando o teste o pede: assim há um
  // teste que o exercita a sério, com o estado que quiser.
  return { api, els, boot: () => sandbox.__ready?.() };
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
  // O salto usa a barreira que JÁ existe no primeiro frame (os torniquetes de
  // vidro atrás dela no master), nunca uma barreira inventada.
  assert.match(by["2c"].animationPrompt, /clears the glass turnstile that is already in the first frame/);
  assert.match(by["2c"].animationPrompt, /same barrier/);
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

test("a voz de Teresa é de uma mulher de setenta anos, com o timbre aprovado", () => {
  const { api } = loadApp();
  const ep = importEpisode(api, 1);
  const by = Object.fromEntries(ep.scenes.map((s) => [s.id, s]));

  const vox = api.voiceForPrompt("teresa");
  assert.match(vox, /woman in her seventies/, "a direção vocal diz a idade: mulher de setenta anos");
  assert.match(vox, /PT-PT/);
  // O timbre, a projeção, o ritmo, as micro-pausas e a mudança de registo
  // aprovados têm de chegar ao prompt, não só à ficha.
  assert.match(vox, /mezzo-soprano/, "diz o timbre");
  assert.match(vox, /broadcast-projected/, "diz a projeção de antena");
  assert.match(vox, /fast and urgent/, "diz o ritmo");
  assert.match(vox, /theatrical micro-pauses/, "diz as micro-pausas teatrais");
  assert.match(vox, /warm-to-commanding/, "diz a mudança de registo");
  assert.ok(vox.length <= 150, "a direção vocal cabe numa linha de prompt");
  assert.match(api.buildVideoPrompt(by["2a"]), /- Teresa \[[^\]]*woman in her seventies/);
  // A descrição completa fica na ficha de personagem (bloco entregue ao modelo
  // e ao utilizador); o prompt leva só a direção curta.
  assert.match(api.charById.teresa.voice, /mezzo-soprano timbre with sharp frontal placement/);
  assert.match(api.charById.teresa.voice, /crisp consonants/);
  assert.doesNotMatch(vox, /crisp consonants/);
});

test("dois planos seguidos podem animar num só take, com as falas pela ordem", () => {
  const { api } = loadApp();
  const ep = importEpisode(api, 1);
  const by = Object.fromEntries(ep.scenes.map((s) => [s.id, s]));

  // Por omissão ninguém se junta: os planos do E1 têm enquadramentos diferentes
  // (a câmara teria de resolver a passagem) e a soma não cabe no take.
  const solo = api.buildVideoClips(ep.scenes);
  assert.equal(solo.length, ep.scenes.length);
  assert.ok(solo.every((c) => !c.chained), "sem pedido explícito, um plano = um clip");

  // Só se junta o que é continuação pura (mesmo enquadramento e mesma câmara).
  const base = { id: "a", sceneId: "s", shot: "WIDE SHOT", camera: "STATIC", duration: 4 };
  const mesmo = { ...base, id: "b" };
  assert.equal(api.joinsVideoTake(mesmo, base), true, "continuação pura junta-se por omissão");
  assert.equal(api.joinsVideoTake({ ...mesmo, duration: 5 }, base), false, "acima dos 8 s do take não junta");
  assert.equal(api.joinsVideoTake({ ...mesmo, camera: "PAN LEFT" }, base), false, "câmara diferente não junta");
  assert.equal(api.joinsVideoTake({ ...mesmo, sceneId: "outro" }, base), false, "cenário diferente não junta");
  assert.equal(api.joinsVideoTake({ ...mesmo, joinWithPrev: false }, base), false, "quem pediu para separar fica separado");

  // O utilizador força a junção de 2a+2b (a soma cabe no teto de 12 s de um take
  // de dois frames): passa a UM clip, animado de uma só vez.
  const total = Number(by["2a"].duration) + Number(by["2b"].duration);
  assert.ok(total <= 12, "2a e 2b caberiam num take de dois frames");
  by["2b"].joinWithPrev = true;
  const clips = api.buildVideoClips(ep.scenes);
  const joined = clips.find((c) => c.takes.length > 1);
  assert.ok(joined, "2a e 2b passam a um só clip");
  assert.equal(api.clipKey(joined), "2a+2b");

  const prompt = api.clipVideoPrompt(joined);
  assert.match(prompt, /shot 2a as the FIRST FRAME/);
  assert.match(prompt, /shot 2b as the FINAL FRAME/);
  assert.match(prompt, new RegExp(`One continuous take, ${total}s`));
  assert.match(prompt, /no cuts/);
  // As quatro falas entram pela ordem dos planos, cada uma com quem a diz.
  const i1 = prompt.indexOf('"Desculpe, tem marcação?"');
  const i2 = prompt.indexOf('"Tenho assuntos a tratar com o Capitão Gancho."');
  const i3 = prompt.indexOf('"Sem marcação não pode passar."');
  const i4 = prompt.indexOf('"Sabe quem eu sou? Ou já apagaram a memória desta casa?"');
  assert.ok(i1 > -1 && i1 < i2 && i2 < i3 && i3 < i4, "as falas entram pela ordem dos planos");
  assert.match(api.clipVideoNote(joined), /o still do take 2a como INITIAL FRAME/);
  assert.match(api.clipVideoNote(joined), /do take 2b como FINAL FRAME/);
  assert.match(api.clipVideoNote(joined), /de 2a para 2b \(11s\)|de 2a para 2b \(\d+s\)/);
  assert.match(api.clipVideoNote(joined), /refazer o enquadramento/, "a nota avisa que a câmara tem de refazer o enquadramento");
  // Um clip de um só plano continua a usar o prompt normal.
  assert.equal(api.clipVideoPrompt(clips.find((c) => c.takes[0].id === "2c")), api.buildVideoPrompt(by["2c"]));
});

test("estado guardado corrompido não deixa a página sem botões", () => {
  // O arranque tem de aguentar um estado inválido: se rebentar antes de ligar os
  // botões, a app fica muda e sem nada clicável («não dá para carregar em nada»).
  const { api, boot } = loadApp({
    osLesados_html: JSON.stringify({ version: 99999, seasons: [null, { id: "s1", name: "Temporada 1" }] }),
  });
  assert.doesNotThrow(() => boot(), "o arranque não pode rebentar com um estado inválido");
  assert.equal(api.state.seasons.length, 1, "as entradas inválidas do estado são descartadas");
  assert.equal(api.state.seasons[0].id, "s1", "a temporada válida sobrevive");
  assert.deepEqual(api.state.seasons[0].episodes, [], "sem episódios, pronta a usar");
  // E o separador continua a responder a cliques com esse estado.
  assert.doesNotThrow(() => api.switchTab("canon"));

  // A rede de segurança: um passo de arranque que rebente é registado e os
  // seguintes correm à mesma.
  let seguinteCorreu = false;
  api.bootStep("passo avariado", () => { throw new Error("boom"); });
  api.bootStep("passo seguinte", () => { seguinteCorreu = true; });
  assert.equal(seguinteCorreu, true, "os passos seguintes correm depois de um falhar");
  assert.match(api.bootErrors.join(" "), /passo avariado \(boom\)/, "o erro fica registado para ser mostrado");
});

test("a app avisa quando o arquivo já tem outra decupagem", () => {
  const { api } = loadApp();
  const ep = importEpisode(api, 1);
  // O import guarda a assinatura do texto que usou: é o que permite detetar
  // depois se o arquivo mudou.
  assert.ok(ep.decoupageSignature, "o import guarda a assinatura da decupagem");
  assert.equal(api.archiveDecoupageDrift(ep), false, "sem alterações no arquivo não há aviso");
  assert.equal(api.archiveDriftBanner(ep), "", "e não aparece faixa nenhuma");

  // O caso real que fez a divisão em frames não aparecer no Pipeline: episódio
  // importado antes de a decupagem existir. Sem assinatura, o arquivo manda.
  const antigo = { ...ep, fromDecoupage: false, decoupageSignature: null };
  assert.equal(api.archiveDecoupageDrift(antigo), true);
  assert.match(api.archiveDriftBanner(antigo), /Recarregar do arquivo/);

  // Decupagem reescrita depois do import também é sinalizada.
  assert.equal(api.archiveDecoupageDrift({ ...ep, decoupageSignature: "1-1" }), true);
  // Episódio local, sem espelho no arquivo, nunca é sinalizado.
  assert.equal(api.archiveDecoupageDrift({ ...ep, repoEpisodeNumber: null }), false);
});

test("o índice publica a decupagem aprovada do episódio 1", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "Temporadas", "Temporada-1", "manifest.json"), "utf8"));
  const ep = (manifest.episodes || []).find((e) => e.number === 1);
  assert.ok(ep, "episódio 1 está no índice");
  assert.equal(ep.decoupagePath, "docs/episodios/T1E01-a-rainha-dos-reality-shows-decupagem.md");
  assert.equal(ep.decoupageStatus, "Completa");
  assert.ok(fs.existsSync(path.join(ROOT, ep.decoupagePath)), "o ficheiro da decupagem existe");
});

test("o episódio 10 importa os takes com título, ambiente e elenco certos", () => {
  const { api } = loadApp();
  const ep = importEpisode(api, 10);
  assert.ok(ep.fromDecoupage, "o episódio 10 usa a decupagem aprovada");
  // Os IDs e a ordem dos takes são preservados.
  assert.deepEqual(
    ep.scenes.map((s) => s.id),
    ["1a", "1b", "2a", "2b", "2c", "2d", "3a", "3b", "3c", "4a", "4b"],
    "os takes do episódio 10 mantêm os IDs e a ordem"
  );
  const by = Object.fromEntries(ep.scenes.map((s) => [s.id, s]));

  // Cada take declara o seu próprio ambiente (não herda o do cabeçalho da cena
  // quando está noutro espaço).
  assert.equal(by["1a"].location, "Estúdio Central", "palco de Secret Story");
  assert.equal(by["2a"].location, "Sala de Controlo", "régie de emissão");
  assert.equal(by["3a"].location, "Gabinete do Diretor", "gabinete do Capitão");
  assert.equal(by["3b"].location, "Sala de Reuniões Secret Story", "sala de reuniões");
  assert.equal(by["3c"].location, "Sala de Controlo", "regresso à régie");
  assert.equal(by["4a"].location, "Escritório Secreto da Guilhermina", "sala secreta de Teresa");
  assert.equal(by["4b"].location, by["4a"].location, "o 4b fica no mesmo espaço do 4a");

  // O título de cada take corresponde ao que acontece nele: o Capitão só
  // aparece no 3a — o título do 3b e do 3c não pode sugerir a presença dele.
  assert.match(by["3a"].title, /Capitão/, "o 3a é sobre o Capitão");
  assert.doesNotMatch(by["3b"].title, /Capitão/i, "o 3b é a sala de reuniões, sem o Capitão");
  assert.doesNotMatch(by["3c"].title, /Capitão/i, "o 3c é a régie, sem o Capitão");
  assert.match(by["3b"].title, /reuniões/i);
  // E o elenco bate com o espaço: o Capitão não entra na sala de reuniões nem na régie.
  assert.ok(by["3a"].characters.includes("capitao"), "o 3a tem o Capitão");
  assert.ok(!by["3b"].characters.includes("capitao"), "o 3b não tem o Capitão");
  assert.ok(!by["3c"].characters.includes("capitao"), "o 3c não tem o Capitão");
  // Sanitização: o bloco positivo de um take sem o Capitão não o menciona.
  assert.doesNotMatch(by["3b"].animationPrompt, /Hook|Capit[ãa]o/i);
  assert.doesNotMatch(by["3c"].animationPrompt, /Hook|Capit[ãa]o/i);
  assert.doesNotMatch(by["3b"].imagePrompt, /Hook|Capit[ãa]o/i);
  assert.doesNotMatch(by["3c"].imagePrompt, /Hook|Capit[ãa]o/i);
  // Mudar de espaço dentro da mesma cena = master próprio, não reframe do 3a.
  assert.equal(by["3b"].type, "MASTER FRAME", "o 3b é o master da sala de reuniões");
  assert.equal(by["3c"].type, "MASTER FRAME", "o 3c é o master do regresso à régie");
  assert.equal(by["3b"].reframeOf, null);
  assert.equal(by["3c"].reframeOf, null);
});

test("a cena final da Teresa anima entre as duas imagens fixas, com as falas novas", () => {
  const { api } = loadApp();
  const ep = importEpisode(api, 10);
  const by = Object.fromEntries(ep.scenes.map((s) => [s.id, s]));

  // 4a (imagem inicial) + 4b (imagem final) animam num só clip: INITIAL + FINAL.
  assert.equal(by["4b"].joinWithPrev, true, "o 4b junta-se ao 4a num só take");
  const joined = api.buildVideoClips(ep.scenes).find((c) => c.takes.length > 1);
  assert.ok(joined, "os dois takes da Teresa formam um clip de duas imagens");
  assert.equal(api.clipKey(joined), "4a+4b");
  const prompt = api.clipVideoPrompt(joined);
  assert.match(prompt, /shot 4a as the FIRST FRAME/);
  assert.match(prompt, /shot 4b as the FINAL FRAME/);

  // As três falas finais da Teresa, pela ordem exata, em PT-PT.
  const lines = ["4a", "4b"].flatMap((id) => api.sceneLines(by[id]).map((l) => l.line));
  assert.deepEqual(lines, [
    "Ai, Tininha, Tininha… tu não sabes com quem te foste meter!",
    "Eu… sim… sou a rainha dos reality shows!",
    "Ahahahahahahah!",
  ]);
  // A fala antiga («Sucessora em avaliação…») sai da cena final.
  assert.doesNotMatch(prompt, /Sucessora em avaliação/);
  assert.doesNotMatch(by["4a"].animationPrompt, /Sucessora em avaliação/);
  assert.doesNotMatch(by["4b"].animationPrompt, /Sucessora em avaliação/);

  // A revelação exata não leva «porque» nem outra frase, e o tremor e a luz
  // encarnada durante a gargalhada ficam no prompt de animação.
  assert.match(by["4b"].animationPrompt, /sou a rainha dos reality shows/);
  assert.doesNotMatch(by["4b"].animationPrompt, /porque/i);
  assert.match(by["4b"].animationPrompt, /shakes/);
  assert.match(by["4b"].animationPrompt, /red light/);
  // Sem música nem narração, e sempre em PT-PT.
  assert.match(prompt, /no music, no narration/);
  assert.match(prompt, /European Portuguese/);
});
