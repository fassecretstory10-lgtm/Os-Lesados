# HANDOFF — Motor narrativo OS LESADOS (para outro agente)

Documento de autoria para análise externa: o que existe, o que mudou,
exemplo real de saída e o que está mal. Data: 2026-10-14.

## 1. Objetivo do sistema

Gerador de episódios de sitcom de animação 2D (sátira à TV daytime
portuguesa, TVI). Episódios curtos (60–90s): cold open + takes + tag.
Pipeline: ideia → história (beats) → takes → prompts de imagem (Nano
Banana/providers) → stills aprovados → prompts de vídeo OMNI FLASH.

## 2. Estrutura ANTIGA (clássica, ainda no código)

- Template fixo de **14 takes** (`1a…6b`), sempre os mesmos sets/planos.
- `buildScenes(premise)`: injeta a premissa em 1 linha da 2a; `patchCast`
  recasta por keywords; `premiseSlots` escolhe cenários.
- **8 dos 14 takes são reframes** sem progressão (57% de repetição de setup).
- 1 fala-assinatura por personagem (`SIG_LINES`) — repetição medida:
  6×/4× por episódio.
- Duração fixa: 78s. Resolução fixa: IRIS OUT.
- Auditoria só formal (nomes banidos, ≤8s, ALERTA MEL, reframe↔local).

## 3. Estrutura NOVA (base PTSD, em vigor no fluxo IA)

Gramática: AMBIENTE → master + zoom + pontual; 8–10 takes; reframe só
com função; take longo só no clímax; tag agridoce; fio de temporada.

Camadas (`index.html`, sem framework):
1. `detectCast` + `premiseSlots` + `salientKeys` — interpretação.
2. `buildStoryLocal` — 6 beats `{who, want, does, obstacle, result,
   change, link, comic, dialogue, loc, dur}` + ideia, clímax, resolução,
   punchline. Falas de `DIALOGUE_BANK` (9×4) consumidas sem repetir;
   reframe continua a fala com "(cont.)".
3. `storyToScenes` — 1 beat = 1 master; reframe só reativo e mudo-ou-cont.
4. `auditStory` + `audit` — repetições, ações sem progressão, objetivos,
   setup/payoff e causalidade (heurísticos), canon, guião-vs-prompt.
5. Render: Guião (narração Abelha, timecards, transições por destino,
   cold open, TAG), Pipeline, Video (OMNI FLASH), Canon.

## 4. Exemplo REAL de saída (motor novo, premissa do barco)

STARS: perpetua, patribunal
IDEIA: "Perpétua quer saber tudo sem ser vista — e [premissa]"

- BEAT1 setup (Estúdio): Perpétua prepara o dia; Patribunal traz a história.
- BEAT2 incident (Estúdio): confronto em direto pela história.
- BEAT3 complication (Corredor): Patribunal persegue Perpétua.
- BEAT4 complication (Corredor): ela refugia-se e telefona (COM reframe).
- BEAT5 climax (Estúdio): confrontação final, decisão ao contrário.
- BEAT6 resolution (Estúdio): recolhe os cacos; caso encerrado.
- PUNCHLINE: remate + "a culpa foi do direto".

Takes: n1 6s, n2 7s, n3 6s, n4 6s, n4r 5s (cont.), n5 7s, n6 5s (mudo).
Falas: 6/6 únicas. Auditoria: limpa.

## 5. Técnicas em vigor (checklist)

- [x] Reframe continua diálogo com "(cont.)"; sem banco → take visual.
- [x] Initial/final frame por take com movimento; cobertura A/B/C por set.
- [x] ALERTA MEL amarelo-mel obrigatório com Abelha.
- [x] Transições por destino; cold opens rotativos; TAG temática (só Teresa
      tem cena; resto narração).
- [x] Fio de temporada rotativo; narração abre/fecha; timecards.
- [ ] Jingle pré-clímax; catchphrase em coro.

## 6. Backend / produção da história ("system" no back)

- `server/nano-banana-proxy.mjs` (Express :8787): rotas `/api/health`,
  `/api/test`, `/api/generate-image`, `/api/context/status`,
  `/api/canon/bible`, `/api/story/generate`, `/api/writers/*`.
- Texto narrativo: `server/text-providers/` — router `openai > anthropic
  > gemini` (`TEXT_PROVIDER`, default auto), JSON validado, erros explícitos.
  Modelos: `gpt-4o-mini` / `claude-haiku-4-5` / `gemini-2.5-flash`.
- Imagem: `server/providers/` — gemini (Nano Banana), openai (gpt-image),
  huggingface, cloudflare (FLUX). Chaves SÓ no `.env` (gitignored).
- **Quotas reais (2026-10-14):** OpenAI sem créditos (2 chaves), Anthropic
  sem créditos, Gemini texto com quota intermitente (429 diário). Sem
  saldo, a IA falha explicitamente; o modo local continua.
- Contexto: `context/{characters,backgrounds+manifests,skills,style,canon}`.
  Manifests mapeiam IDs→ficheiros; backend lê e anexa como referência.
- Persistência: episódios em `localStorage` (sem migração além de v2);
  sessões da Sala em `server/writers-room/sessions/*.json`.
- Sala dos Argumentistas: 6 agentes (investigador→analista→argumentista→
  improvisador→crítico→showrunner), pesquisa real (Wikipedia+DDG),
  10 chamadas IA/sessão, polling 3s, temas, Habbo-room, modo automático.

## 7. Problemas conhecidos (para o próximo agente atacar)

1. **Keys literais nas ações** ("Caso (perpétua, confunde, passeio)") —
   soa a template; ver exemplo §4, beats 4–6.
2. **Beat4 telefona a si própria** quando o elenco tem 2 (C=A) — precisa
   de terceiro interveniente ou beat sem telefonema.
3. **Resolução muda** (n6 sem fala) por esgotamento do banco — aceitável,
   mas o clímax (n5) devia guardar a melhor fala, não a 4.ª.
4. **AI sem normalização de tom**: `normalizeAIStory` mapeia nomes→ids
   mas não impõe voz por personagem.
5. **`normalize()` re-sanitiza histórico** a cada load (frágil).
6. **`currentEpisode()` + numeração**: corrigidos (null honesto, por season),
   mas sem testes automatizados — só harness manual.
7. **Sem suite de testes**: tudo verificado por `node -e` ad hoc; propor
   `tools/test-*.mjs` com assertions.
