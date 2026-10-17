# Guião Unificado OS LESADOS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar a ficha de cada episódio em `Temporadas/Temporada-1/episodio-##-slug.md` o guião completo e único do episódio (narrativa + frames + secção técnica), eliminando a duplicação entre fichas, decupagens e contexto.

**Architecture:** Fonte única por episódio. O ficheiro da temporada passa a conter cenas (`## CENA NN — INT./EXT. LOCAL — PERÍODO`), frames identificados por `NN<LETRA>` (ex.: `1A`, `1B`, `2A`), diálogo em formato de guião e uma secção final fixa `## ESTADO E NOTAS DE PRODUÇÃO`. Os ficheiros `docs/episodios/T1E##-…-decupagem.md` e os duplicados em `context/episodes/season-1/` são absorvidos e removidos. O `scripts/sync-episode-index.mjs` valida a ficha única e escreve o manifesto; `index.html` lê e importa o novo formato.

**Tech Stack:** Markdown versionado, Node ESM (`scripts/sync-episode-index.mjs`), HTML/JS num único ficheiro (`index.html`), GitHub Actions, `node:test`-style asserções manuais em `tools/test-backend.mjs` / `tools/test-narrative.mjs`.

**Decisões já tomadas pelo autor:**
- Ficha = documento único.
- Âmbito: formato + E1/E3/E9 a fundo; E2/E4–E8 convertidos e marcados "por desenvolver" (sem inventar história).
- Adaptar app (`index.html`) e sync.
- Incluir o **master angle do gabinete do Capitão Gancho** (`master-angle-gabinete-capitao.jpeg`) como terceiro ângulo canónico do gabinete, usado no frame `A` das cenas do gabinete.

**Regra de preservação:** diálogos, acontecimentos, ordem, relações e finais aprovados de E1, E3 e E9 **não** podem ser alterados. Só muda a estrutura, a distribuição em frames e acrescenta-se a secção técnica.

---

## Spec do formato (fonte de verdade)

`docs/episodios/ESTRUTURA-DO-GUIAO.md` descreve exatamente isto; os episódios seguem-no.

```markdown
<!-- OS_LESADOS_GUIAO: COMPLETO -->            <- só em guiões completos

# OS LESADOS — Temporada 1 · Episódio N — Título do Episódio

> Contexto breve opcional (1–2 linhas). Não é um resumo da história.

---

## CENA 01 — INT. RECEÇÃO DA TVI — DIA

Descrição da ação, do espaço e da posição inicial das personagens, em prosa visual.

**1A · MASTER FRAME**
**Enquadramento:** plano geral; composição e eixo.
**Personagens e posições:** quem está onde, o que faz.
**Olhares e objetos:** direção dos olhares, adereços relevantes.
**Prompt de imagem:** «…»
**Prompt de animação:** «…»

**TERESA:** «Fala.»
*(indicação de interpretação, só quando necessária)*

**1B · REFRAME — RECECIONISTA** · origem 1A
**O que muda:** aproxima para o balcão.
**O que a imagem mostra:** só o necessário para legibilidade.
**Razão narrativa:** a reação que não lê no master.
**Ação/reação:** o que acontece concretamente.
**Prompt de imagem:** «…»
**Prompt de animação:** «…»

---

## CENA 02 — INT. GABINETE DO CAPITÃO GANCHO — DIA

…

---

## ESTADO E NOTAS DE PRODUÇÃO

- **Estado:** guião em revisão | aprovado | pronto para produção | argumento | ideia
- **Duração estimada:** ~X min Y s (soma de durações + pausas + transições)
- **Cenas e frames:** N cenas · M frames (x master + y reframes)
- **Personagens presentes:** apenas quem aparece
- **Locais utilizados:** lista de espaços
- **Regras específicas do episódio:**
  - restrições de continuidade, elementos intocáveis, notas de realização
```

**Regras duras (validadas por script):**
1. Cabeçalhos de cena `^## CENA \d{2} — ` obrigatórios.
2. Frames `^\*\*\d+[A-Z] · (MASTER FRAME|REFRAME)`; letra inicial `A` é sempre master.
3. `reframeOf` implícito: frame `NB` pertence ao master `NA` da mesma cena.
4. Secção `## ESTADO E NOTAS DE PRODUÇÃO` obrigatória com os 6 campos.
5. Diálogo `**NOME:** «…»` (nome em maiúsculas) — mantém compatibilidade com o importador.
6. Sem narração automática da Abelha Maia.

**Ângulos do gabinete do Capitão Gancho (3, canónicos):** o guião usa o **master angle largo** (`master-angle-gabinete-capitao.jpeg`) no frame `A` das cenas do gabinete, para estabelecer o espaço; os reframes usam o lado corporativo (visitas) ou o lado secretária/muro de TVs (SOLO). Nunca inventar um quarto ângulo.

---

## File structure

**Criar:**
- `docs/episodios/ESTRUTURA-DO-GUIAO.md` — spec do formato (a fonte de verdade acima).
- `context/episodes/season-1/README.md` — ponteiro para a fonte única.
- `tools/test-guiao-format.mjs` — validador do formato (novo, `node:test`).
- `docs/superpowers/plans/2026-10-17-estrutura-guiao-unificado.md` — este plano.

**Reescrever (conteúdo canónico):**
- `Temporadas/Temporada-1/episodio-01-a-rainha-dos-reality-shows.md`
- `Temporadas/Temporada-1/episodio-03-monte-do-coxa.md`
- `Temporadas/Temporada-1/episodio-09-o-lancamento-naval.md`
- `Temporadas/Temporada-1/episodio-02-roda-capitao.md`
- `Temporadas/Temporada-1/episodio-04-o-casting-dos-desesperados.md`
- `Temporadas/Temporada-1/episodio-05-a-roda-esta-viciada.md`
- `Temporadas/Temporada-1/episodio-06-edicao-especialissima.md`
- `Temporadas/Temporada-1/episodio-07-a-espia.md`
- `Temporadas/Temporada-1/episodio-08-o-barco-da-tvi.md`

**Adicionar (asset):**
- `context/backgrounds/master-angle-gabinete-capitao.jpeg` — **já adicionado** (1376×768, 16:9): master angle largo do gabinete do Capitão Gancho (porta, secretária, muro de TVs). Terceiro ângulo, a par de `-secretaria.jpg` (SOLO) e `-corporativo.jpg` (visitas).

**Modificar:**
- `scripts/sync-episode-index.mjs` — valida a ficha única, escreve novo manifesto.
- `Temporadas/Temporada-1/manifest.json` — gerado (não editar à mão).
- `context/backgrounds/manifest.json` — entrada do master angle (já feito, chave `Gabinete do Diretor - master angle (plano-mestre largo: porta, secretária e muro de TVs)`).
- `index.html` — cast secundário, `dialogue.name`, Arquivo com documento único, parser de frames no import, master angle do gabinete em `resolveOfficeSide`.
- `Temporadas/Temporada-1/README.md` — estados e fluxo.
- `docs/episodios/REGRA-AUTOMATICA-DO-INDICE.md` — reflete o novo fluxo.
- `.github/workflows/sync-episode-index.yml` — paths observados.

**Remover (após absorver):**
- `docs/episodios/T1E01-a-rainha-dos-reality-shows-decupagem.md`
- `docs/episodios/T1E03-monte-do-coxa-decupagem.md`
- `context/episodes/season-1/episode-01-a-rainha-dos-reality-shows.md`
- `context/episodes/season-1/episode-03-monte-do-coxa.md`
- `context/episodes/season-1/episode-09-o-lancamento-naval.md`

---

## Task 1: Escrever a spec do formato

**Files:**
- Create: `docs/episodios/ESTRUTURA-DO-GUIAO.md`

- [ ] **Step 1:** Escrever o ficheiro com a estrutura da secção "Spec do formato" acima, incluindo um exemplo curto comentado de uma cena com 1 master + 1 reframe.
- [ ] **Step 2:** Verificar que o ficheiro abre com `# Estrutura do guião OS LESADOS` e contém as seis regras duras.
- [ ] **Step 3:** Commit: `git add docs/episodios/ESTRUTURA-DO-GUIAO.md && git commit -m "docs: define a estrutura unificada do guião OS LESADOS"`

---

## Task 2: Escrever o validador do formato

**Files:**
- Create: `tools/test-guiao-format.mjs`

- [ ] **Step 1: Escrever o teste (falha primeiro)**

```js
// tools/test-guiao-format.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEASON_DIR = path.join(ROOT, "Temporadas", "Temporada-1");

export function validateGuiao(content) {
  const scenes = [...content.matchAll(/^## CENA (\d{2}) — .+$/gm)].map(m => Number(m[1]));
  const frames = [...content.matchAll(/^\*\*(\d+)([A-Z]) · (MASTER FRAME|REFRAME)/gm)]
    .map(m => ({ n: Number(m[1]), letter: m[2], kind: m[3] }));
  const checks = {
    title: /^# OS LESADOS — Temporada 1 · Episódio \d+ — .+$/m.test(content),
    scenes: scenes.length >= 3,
    sceneOrder: scenes.every((n, i) => n === i + 1),
    frameLetters: frames.every(f => /^[A-Z]$/.test(f.letter)),
    masterFirst: true,
    technical: /^## ESTADO E NOTAS DE PRODUÇÃO$/m.test(content),
    fields: ["Estado", "Duração estimada", "Cenas e frames", "Personagens presentes", "Locais utilizados", "Regras específicas do episódio"]
      .every(f => content.includes(`**${f}:**`)),
  };
  // masterFirst: dentro de cada cena, o primeiro frame é A e é MASTER FRAME.
  const byScene = {};
  for (const f of frames) (byScene[f.n] ||= []).push(f);
  checks.masterFirst = Object.values(byScene).every(list => list[0].letter === "A" && list[0].kind === "MASTER FRAME");
  return { checks, scenes: scenes.length, frames: frames.length, complete: Object.values(checks).every(Boolean) };
}

test("formato: todos os episódios completos respeitam a estrutura", () => {
  const files = fs.readdirSync(SEASON_DIR).filter(n => /^episodio-\d{2}-.+\.md$/.test(n));
  assert.ok(files.length >= 9, "esperados 9 episódios");
  for (const name of files) {
    const content = fs.readFileSync(path.join(SEASON_DIR, name), "utf8");
    const r = validateGuiao(content);
    if (/OS_LESADOS_GUIAO: COMPLETO/.test(content)) {
      assert.ok(r.complete, `${name}: guião completo com estrutura inválida -> ${JSON.stringify(r.checks)}`);
    }
  }
});
```

- [ ] **Step 2:** Correr `node --test tools/test-guiao-format.mjs` → deve **passar** com 0 guiões marcados (todos ainda são fichas antigas) e imprimir `# tests 1`.
- [ ] **Step 3:** Commit: `git add tools/test-guiao-format.mjs && git commit -m "test: validador do formato unificado do guião"`

---

## Task 3: Reformular E1 — A Rainha dos Reality-Shows

**Files:**
- Modify: `Temporadas/Temporada-1/episodio-01-a-rainha-dos-reality-shows.md`
- Source: `docs/episodios/T1E01-a-rainha-dos-reality-shows-decupagem.md` (texto e prompts aprovados)

**Preservar literalmente:** todas as falas de Teresa, Rececionista, Capitão Gancho, Tininha e Fã; ordem dos acontecimentos; o final («Há quem nunca se esqueça.»).

**Mudanças permitidas:** agrupar os 16 `PLANO` em 4 `CENA`; reduzir reframes (a decupagem atual cria um reframe por fala — viola a regra nova); renumerar frames por cena.

**Plano de cenas/frames:**
- CENA 01 — INT./EXT. RECEÇÃO DA TVI — DIA → `1A` exterior, `1B` receção (com Rececionista + Teresa), `1C` torniquetes, `1D` pedido de segurança.
- CENA 02 — INT. GABINETE DO CAPITÃO GANCHO — DIA → `2A` **master angle largo** (`master-angle-gabinete-capitao.jpeg`) a estabelecer o gabinete, `2B` dois-planos do confronto (lado corporativo), `2C` reframe Capitão, `2D` reframe Teresa (frase central).
- CENA 03 — INT. GABINETE DO CAPITÃO GANCHO — DIA (contínuo) → `3A` master angle largo com a entrada da Tininha, `3B` decisão sobre o Secret Story, `3C` reação de Teresa.
- CENA 04 — INT. CORREDOR DA TVI — CONTÍNUO → `4A` saída, `4B` o fã, `4C` reconhecimento final.

- [ ] **Step 1:** Escrever o ficheiro completo no formato da spec, com `<-- OS_LESADOS_GUIAO: COMPLETO -->` no topo (sem o `<`).
- [ ] **Step 2:** Correr `node --test tools/test-guiao-format.mjs` → PASS.
- [ ] **Step 3:** Verificação de preservação: `grep -c '«' Temporadas/Temporada-1/episodio-01-a-rainha-dos-reality-shows.md` e comparar as falas com a decupagem de origem; todas as falas têm de existir.
- [ ] **Step 4:** Commit: `git add Temporadas/Temporada-1/episodio-01-a-rainha-dos-reality-shows.md && git commit -m "feat(E1): guião completo no formato unificado"`

---

## Task 4: Reformular E3 — Monte do Coxa

**Files:**
- Modify: `Temporadas/Temporada-1/episodio-03-monte-do-coxa.md`
- Source: `docs/episodios/T1E03-monte-do-coxa-decupagem.md`

**Preservar:** as 6 cenas, todas as falas (Caseiro, Gancho, Coxa), a voz-off de abertura, o corte para preto final, a regra de não mostrar como Coxa chega à mala.

**Plano:** manter as 6 `CENA`; frames: `1A`; `2A` master + `2B` reframe galinhas; `3A` master + `3B`/`3C` reframes; `4A` master + `4B` reframe da queda; `5A` master; `6A` master + `6B` partida.

- [ ] **Step 1:** Escrever o ficheiro no formato (marcador COMPLETO).
- [ ] **Step 2:** `node --test tools/test-guiao-format.mjs` → PASS.
- [ ] **Step 3:** Confirmar que «Não mostrar como Coxa vai parar à mala» consta nas Regras específicas.
- [ ] **Step 4:** Commit: `git commit -am "feat(E3): guião completo no formato unificado"`

---

## Task 5: Reformular E9 — O Lançamento Naval

**Files:**
- Modify: `Temporadas/Temporada-1/episodio-09-o-lancamento-naval.md`

**Preservar:** as 6 cenas já existentes e todas as falas (Mário, Capitão, Tininha, Produtor, Assistente). Já tem `## CENA NN — …`; falta acrescentar frames, prompts e a secção técnica. As "Notas de realização" migram para "Regras específicas do episódio".

**Plano:** frames `1A` exterior aéreo; `2A` chegada ao corredor + `2B` reframe maquete; `3A` **master angle largo** do gabinete + `3B` reframe decisão; `4A` estúdio (painel dos navios) + `4B` reframe Capitão/Tininha; `5A` revelação do monitor; `6A` fecho.

- [ ] **Step 1:** Reordenar as cenas para `## CENA 0N — INT./EXT. LOCAL — PERÍODO`, acrescentar frames e prompts.
- [ ] **Step 2:** Acrescentar `## ESTADO E NOTAS DE PRODUÇÃO` com `Estado: guião em revisão` (não aprovado).
- [ ] **Step 3:** `node --test tools/test-guiao-format.mjs` → só valida se marcado COMPLETO; como E9 não está aprovado, **não** colocar o marcador.
- [ ] **Step 4:** Commit: `git commit -am "feat(E9): guião em formato unificado (por aprovar)"`

---

## Task 6: Converter E2, E4–E8 para a estrutura

**Files:** Modify os 6 ficheiros de episódio.

**Regra:** não inventar história. Onde o episódio já tem cenas/premissa, manter o texto existente reorganizado em `## CENA NN`; onde é apenas ficha, manter «Direção atual» / «Próximo passo» numa cena única `## CENA 01 — A DEFINIR` e `Estado: ideia`/`argumento`. **Nenhum** destes leva o marcador COMPLETO nem o bloco de frames com prompts.

- [ ] **Step 1:** Aplicar a estrutura mínima: título no formato spec, corpo existente reorganizado, secção `## ESTADO E NOTAS DE PRODUÇÃO` com os 6 campos (valores «por definir» quando não existem).
- [ ] **Step 2:** `node --test tools/test-guiao-format.mjs` → PASS (não marcados, não validados em profundidade).
- [ ] **Step 3:** Commit: `git commit -am "refactor(E2,E4-E8): adota a estrutura unificada mantendo o estado real"`

---

## Task 7: Reescrever o sync do índice

**Files:**
- Modify: `scripts/sync-episode-index.mjs`
- Test: `tools/test-guiao-format.mjs` (reutiliza `validateGuiao`)

- [ ] **Step 1:** Substituir `validateDecoupage` por `validateGuiao` (importado de `tools/test-guiao-format.mjs`) e deixar de varrer `docs/episodios/*-decupagem.md`.
- [ ] **Step 2:** Campos do manifesto por episódio: `number`, `title`, `status`, `path`, `complete` (bool), `frames` (nº), `durationText` (do campo Duração estimada), `scenes` (nº). Remover `decoupagePath`/`decoupageStatus`/`kind`.
- [ ] **Step 3:** `status` = valor do campo `Estado:` da secção técnica, capitalizado.
- [ ] **Step 4:** Correr `node scripts/sync-episode-index.mjs` e inspecionar `Temporadas/Temporada-1/manifest.json`.
- [ ] **Step 5:** Commit: `git commit -am "refactor(sync): índice a partir da ficha única"`

---

## Task 8: app — cast secundário e nomes de fala

**Files:** Modify `index.html` (~340 e `importRepoEpisode`)

- [ ] **Step 1:** Depois do array `characters`, acrescentar as personagens secundárias com `secondary: true`:

```js
    // Papéis secundários citados em guiões (sem referência de imagem gerada).
    const SECONDARY_CHARACTERS = [
      { id: "rececionista", name: "Rececionista", visual: "Funcionária da receção da TVI.", voice: "Feminina neutra PT-PT." },
      { id: "fa", name: "Fã", visual: "Fã no corredor da TVI.", voice: "Masculina emocionada PT-PT." },
      { id: "seguranca", name: "Segurança", visual: "Segurança da estação.", voice: "Masculina seca PT-PT." },
      { id: "caseiro", name: "Caseiro", visual: "Caseiro do Monte do Coxa.", voice: "Masculina rural alentejana PT-PT." },
      { id: "produtor", name: "Produtor de Continuidade", visual: "Produtor de bastidores.", voice: "Masculina administrativa PT-PT." },
      { id: "assistente", name: "Assistente", visual: "Assistente de produção.", voice: "Masculina apressada PT-PT." }
    ].map(c => ({ ...c, secondary: true }));
    characters.push(...SECONDARY_CHARACTERS);
```

- [ ] **Step 2:** `charById` é calculado depois de push; confirmar que a linha `const charById = Object.fromEntries(...)` vem **depois** do push (mover se necessário).
- [ ] **Step 3:** Em `renderCanon`, filtrar secundárias da grelha de retratos: `characters.filter(c => !c.secondary).forEach(...)` e mostrar uma nota com a lista das secundárias.
- [ ] **Step 4:** Em `renderScript`, o nome da fala aceita `dialogue.name` como fallback: trocar `charById[s.dialogue.char]?.name || s.dialogue.char` por `charById[s.dialogue.char]?.name || s.dialogue.name || s.dialogue.char` (3 ocorrências).
- [ ] **Step 5:** `node --check` no script extraído: `sed -n '329,$p' index.html | sed '$d' > /tmp/i.js && node --check /tmp/i.js` → OK.
- [ ] **Step 6:** Commit: `git commit -am "feat(app): papéis secundários e nomes de fala no guião"`

---

## Task 9: app — parser de frames no import

**Files:** Modify `index.html` (`importRepoEpisode`)

- [ ] **Step 1:** Antes do `blocks.map(...)`, acrescentar um parser de frames por cena:

```js
      const sceneHeadings = [...source.content.matchAll(/^## CENA (\d{2}) — (.+)$/gm)];
      const frameRe = /^\*\*(\d+)([A-Z]) · (MASTER FRAME|REFRAME)(?: — ([\p{L} ']+))?\*\*(?: · origem (\d+)([A-Z]))?/gmu;
```

- [ ] **Step 2:** Construir `frameScenes`: para cada cena, os frames no seu intervalo; `id = n.toLowerCase() + letter.toLowerCase()`; `reframeOf` = `origem` (ex.: `1A` → `1a`); `location` = 2.º segmento do cabeçalho da cena; `characters` = ids encontrados no corpo do frame ou no bloco de diálogo; `action` = linhas de descrição; `dialogue` = primeiro `**NOME:** «…»` do frame.
- [ ] **Step 3:** Se `frameScenes.length`, usar essas cenas em vez do `blocks.map` atual (fallback mantém-se para fichas "por desenvolver").
- [ ] **Step 4:** Smoke test no browser simulado: arrancar backend (`PORT=8899 node server/nano-banana-proxy.mjs`) e confirmar `curl -s localhost:8899/api/episodes` devolve 9 episódios com `content` não vazio.
- [ ] **Step 5:** Commit: `git commit -am "feat(app): importa cenas e frames do guião unificado"`

---

## Task 10: app — Arquivo com documento único

**Files:** Modify `index.html` (`renderArchive`)

- [ ] **Step 1:** Remover o botão `.archive-decoupage` e o handler; manter um único botão **Ler guião** que mostra `ep.content`.
- [ ] **Step 2:** No cartão, mostrar `Estado`, `Duração` e `Frames` quando existirem; retirar `decoupageStatus`.
- [ ] **Step 3:** Smoke test manual: `curl -s localhost:8899/ | grep -c archive-decoupage` → `0`.
- [ ] **Step 4:** Commit: `git commit -am "feat(app): Arquivo passa a mostrar o guião único"`

---

## Task 10b: app — master angle do gabinete do Capitão

**Files:** Modify `index.html` (`resolveOfficeSide`, ~432-443)

- [ ] **Step 1:** Acrescentar a variante do master angle junto das existentes:

```js
    const OFFICE_MASTER = "Gabinete do Diretor - master angle (plano-mestre largo: porta, secretária e muro de TVs)";
    const OFFICE_SOLO = "Gabinete do Diretor - secretária e muro de TVs (SOLO, a monitorizar e decidir)";
    const OFFICE_VISIT = "Gabinete do Diretor - lado corporativo (RECEBE VISITAS, diálogos e confrontos, estilo 1a/1b)";
```

- [ ] **Step 2:** Em `resolveOfficeSide`, preservar o master angle quando o guião o pede explicitamente:

```js
    function resolveOfficeSide(scene) {
      if (String(scene.location || "").indexOf("Gabinete do Diretor") !== 0) return;
      if (scene.location.indexOf("master angle") !== -1) { scene.location = OFFICE_MASTER; return; }
      const others = (scene.characters || []).filter(id => id !== "capitao");
      scene.location = others.length ? OFFICE_VISIT : OFFICE_SOLO;
    }
```

- [ ] **Step 3:** Verificar que a chave está no manifest e o ficheiro existe:
  `node -e 'const m=require("./context/backgrounds/manifest.json"),fs=require("fs");const k=Object.keys(m).find(x=>x.includes("master angle"));console.log(k,"->",m[k],fs.existsSync("context/backgrounds/"+m[k]))'` → `true`.
- [ ] **Step 4:** `sed -n '329,$p' index.html | sed '$d' > /tmp/i.js && node --check /tmp/i.js` → OK.
- [ ] **Step 5:** Commit: `git commit -am "feat(app): master angle do gabinete do Capitão"`

---

## Task 11: Absorver e remover duplicados

**Files:** Remove os 5 ficheiros listados em "File structure".

- [ ] **Step 1:** Confirmar que o conteúdo útil já está nas fichas: `grep -c 'MÁRIO GALÁTICO' Temporadas/Temporada-1/episodio-09-o-lancamento-naval.md`.
- [ ] **Step 2:** `git rm docs/episodios/T1E01-a-rainha-dos-reality-shows-decupagem.md docs/episodios/T1E03-monte-do-coxa-decupagem.md context/episodes/season-1/episode-01-a-rainha-dos-reality-shows.md context/episodes/season-1/episode-03-monte-do-coxa.md context/episodes/season-1/episode-09-o-lancamento-naval.md`
- [ ] **Step 3:** Criar `context/episodes/season-1/README.md` a apontar para `Temporadas/Temporada-1/`.
- [ ] **Step 4:** Commit: `git commit -m "refactor: elimina decupagens e contexto duplicados (fonte única)"`

---

## Task 12: Atualizar README e regra do índice

**Files:** Modify `Temporadas/Temporada-1/README.md`, `docs/episodios/REGRA-AUTOMATICA-DO-INDICE.md`, `.github/workflows/sync-episode-index.yml`

- [ ] **Step 1:** README: substituir a tabela "Episódios" pelos estados reais derivados do manifesto; descrever o fluxo ficha única → Arquivo → import → decupagem na app → produção.
- [ ] **Step 2:** REGRA: descrever o novo fluxo (valida ficha, não decupagem; botão **Ler guião**), remover a referência a `context/episodes` como cópia e a `docs/episodios/T1E##-decupagem.md`.
- [ ] **Step 3:** Workflow: paths observados passam a `Temporadas/Temporada-1/episodio-*.md`, `scripts/sync-episode-index.mjs`, `tools/test-guiao-format.mjs`.
- [ ] **Step 4:** Commit: `git commit -am "docs: fluxo do guião único"`

---

## Task 13: Verificação final

- [ ] **Step 1:** `node --test tools/test-guiao-format.mjs` → PASS.
- [ ] **Step 2:** `node tools/test-narrative.mjs && node tools/test-backend.mjs` → 15/15.
- [ ] **Step 3:** `node scripts/sync-episode-index.mjs` → manifesto atualizado, sem warnings inesperados.
- [ ] **Step 4:** Smoke: `PORT=8899 node server/nano-banana-proxy.mjs &` + `curl -s localhost:8899/api/episodes` → 9 episódios, E1/E3 com `complete:true`.
- [ ] **Step 4b:** `curl -s localhost:8899/api/context/status` → 27 backgrounds, todos `true`, incluindo `Gabinete do Diretor - master angle (…): true`.
- [ ] **Step 5:** `git status` limpo; `git log --oneline -15`.
- [ ] **Step 6:** Commit final se restar algo; push só com autorização do autor.

---

## Self-review

- **Cobertura da spec:** §1 estrutura → Task 1/2/3; §2 frames/reframes → spec + Tasks 3–5; §3 abertura → regras de preservação e Task 3 (mantém a abertura nos torniquetes); §4 continuidade/PT-PT → regras específicas em cada ficha; §5 secção técnica → spec + validator (`fields`); §6 princípio → títulos e prompts; **master angle do gabinete** → spec ("ângulos do gabinete"), Task 10b, e Tasks 3/5 (frame `A` das cenas do gabinete).
- **Sem placeholders:** as Tasks 2, 7, 8, 9, 10 têm código completo; as Tasks 3–6 produzem prosa a partir de fontes citadas (o conteúdo é o próprio entregável).
- **Consistência de tipos:** `validateGuiao` devolve `{checks, scenes, frames, complete}` e é usado igualmente no sync (Task 7). Ids de frame `n+letter` minúsculos batem com o regex `^(\d+)([a-z])$` de `renderDecoupage.labelFor`.
