# REVISÃO GLOBAL DO MOTOR NARRATIVO E DA ARQUITETURA — OS LESADOS

**Data:** 2026-10-14. **Natureza:** revisão crítica, sem implementação.
**Método:** leitura direta do código (`index.html`, 2153 linhas; `server/` na íntegra),
`grep` de referências cruzadas, `node --check` em todos os módulos, chamadas HTTP seguras
sem custo. **Nenhum ficheiro de produção alterado, nada apagado, nenhuma quota de IA consumida.**
Ver também `OS_LESADOS_AUDITORIA_INTEGRAL.md` (raiz) para o inventário exaustivo; este documento
foca o motor narrativo e a arquitetura futura. Convenções: **[EVIDÊNCIA]** = visto no código;
**[HIPÓTESE]** = inferência a validar; **[DECISÃO NECESSÁRIA]** = escolha do responsável.

---

## 1. Resumo executivo

1. O sistema atual **não é uma equipa de argumentistas: é um funil de uma IA com pós-processamento
   determinístico**. Uma chamada gera beats; o resto é mapeamento, render e auditoria formal.
   Funciona e é honesto nos erros — mas a "escrita" acontece quase toda dentro de uma caixa-preta.
2. O código morto do motor clássico (~350 linhas) está **comprovadamente morto**: sem `eval`,
   sem `new Function`, sem `setTimeout` com strings, sem handlers inline, sem acesso dinâmico
   que o alcance (verificado por `grep`). Pode ser removido com risco baixo após migração.
3. A separação história→realização **existe em intenção mas não em dados**: não há objeto cena,
   tudo é "MASTER SHOT", reframes nascem só mudos, durações são fixas (6s/5s) e a cobertura
   nunca é decidida — é herdada.
4. A auditoria narrativa deteta, mas **não corrige nem prioriza por gravidade real**; e deixa
   de correr nos reloads.
5. O caminho viável sem reescrita total: **classificador premissa→formato + beats com decisão
   + cobertura por regras + edição humana obrigatória antes do visual**, por trás de flag,
   com o fluxo atual intacto como fallback.
6. Nada aqui exige mais agentes, mais providers ou mais UI nova para a v1 da reforma.

---

## 2. Arquitetura atual verificada

```
Sidebar (nome+premissa) ──► aiGenerateEpisode ──► POST /api/story/generate
  → textRouter (openai→anthropic→gemini) → validateStory → {story}
  → normalizeAIStory → storyToScenes → narration/tagScene/coldOpen
  → auditStory + audit → localStorage["osLesados_html"] → 5 abas
Takes aprovados ──► POST /api/generate-image (prompt editável + refs disco+reframe)
  → dataURL → aprovar → Video (prompts OMNI FLASH, só cópia p/ ferramenta externa)
Sala ──► 6 agentes → sessões JSON → approve → "Usar no guião" (só preenche campos)
```

- **Frontend:** `index.html` monolítico; estado em `localStorage` (chaves: `osLesados_html`,
  `osLesados_salaAuto`, `osLesados_salaTopicIdx`); sem framework; sem testes.
- **Backend:** Express, 13 rotas, sem `express.static` (fotos do canon nunca servidas;
  separador Canon é texto puro); sem retries; timeouts 120–180s; erros explícitos.
- **Persistência:** sem export/import/backup; `save()` em `try/catch` com toast genérico.

---

## 3. Problemas confirmados e hipóteses

### Confirmados ([EVIDÊNCIA] com localização)

- **P1. Motor clássico morto no fluxo.** `buildScenes`, `patchCast`, `SIG_LINES`,
  `sigDialogue`, `DIALOGUE_BANK`, `consumeLine`, `GOALS`, `premiseSlots`,
  `buildStoryLocal`: 1 ocorrência cada (só definição). A UI só chama `aiGenerateEpisode`.
- **P2. `hook` órfão.** Criado apenas no `normalize` (fallback por número); nunca na geração.
- **P3. Durações fixas.** `dur: 6` em `normalizeAIStory`, reframe 5s; total = 6×beats.
- **P4. Voz descartada.** `paren: ""` sistemático; `with` por rotação de elenco.
- **P5. Sem objeto cena; tudo "MASTER SHOT"; reframes só mudos; ramo `pair` morto no Video;
  `updateVideoTab` definida 2×; `transitionFor` cego a takes `nX`; "Season 1" hardcoded.**
- **P6. Edição inexistente** onde importa: beats, takes, falas e ações só via re-geração total;
  só o prompt de imagem é editável. Sem aprovação da história antes do visual; sem aprovação
  de clips (só stills); sem versões (revisão da Sala sobrescreve).
- **P7. Auditoria sem ação e sem re-execução:** `auditStory` corre na criação, nunca em reload
  (só `audit()` formal); sem severidades (só error/warning/success); sem botão "corrigir".
- **P8. Recursos quebrados silenciosos:** `sala-controlo.jpg`, `zona-catering.jpg`,
  `exterior-estacao.webp`, `camarim.jpg`, `tininha.jpg`, `perpetua.jpg` referenciados e
  inexistentes (a chave "Camarim" aponta para o vazio embora `camarim-espelho.jpg` exista).
- **P9. Validação da Sala desligada** com schemas custom (`validate = schema ? noop : ...`);
  normalizadores tolerantes; sessões "done" ocas; 11 sessões sem limpeza.
- **P10. Quotas = ponto único de falha funcional** (sem degradação além de erro explícito);
  `checkStop` não cancela chamadas em curso; comentários/stale-docs (3 vs 4 providers).

### Hipóteses a validar ([HIPÓTESE])

- **H1.** A taxa real de JSON inválido/retries manuais é alta (temperature 0.9 + schemas
  frouxos) — medir com log de tentativas antes de baixar a temperatura.
- **H2.** `sanitize()` em reload pode corromper texto aprovado se um dia ganhar regras —
  hoje idempotente; teste de idempotência deve existir.
- **H3.** DataURLs no `localStorage` aproximam episódios com muitas imagens do teto de 5MB —
  medir tamanho real por episódio antes de atacar.

---

## 4. Decisões de produto que preciso que tomes ([DECISÃO NECESSÁRIA])

1. **Modo offline:** apagar o cluster morto ou ressuscitá-lo como fallback sem rede?
2. **Protagonismo da IA:** a IA propõe e o humano reescreve, ou a IA só varia beats humanos?
3. **Duração:** teto 120s configurável já, ou esperar pelos 5 minutos?
4. **Real names:** tolerância zero absoluta, mesmo que uma R-qualquer peça exceção?
5. **Sala→episódio:** shortlist cria rascunho automaticamente ou continua manual?
6. **Clips multi-take:** o ramo `pair` volta (com que semântica) ou apaga-se?
7. **Quotas:** aceitar "sem saldo = sem episódios" ou investir em fila/cache/degradação?
8. **Covil/Rui da Coxa/novos:** entram no canon runtime ou ficam em research?

---

## 5. Arquitetura recomendada

Módulos pequenos, cada um com schema versionado; IA dentro de orçamentos; humano aprova
história, stills e clips; regras vetam o resto.

```
premissa ──► INTENÇÃO (ideia + elenco + duração-alvo + formato classificado)
  ──► HISTÓRIA (beats: quem/quê/obstáculo/mudança + DECISÃO registada)
  ──► REVISÃO HUMANA OBRIGATÓRIA (editar tudo; nada visual sem aprovar história)
  ──► CENAS (1 contexto; elenco explícito; multi-personagem decomposta)
  ──► COBERTURA (master → reações/inserts por regra + orçamento de takes)
  ──► PROMPTS → STILLS (aprovar) → ANIMAÇÃO (clips, aprovar) → MONTAGEM
  ╰──► CONTINUIDADE (log de eventos → próxima história + Sala)
```

- **Determinístico:** classificação de formato, orçamentos, auditorias, timecodes,
  migrações, cobertura por regras, persistência.
- **IA:** texto, diálogos, quantidade de beats/takes dentro do orçamento, alternativas.
- **Humano:** história, stills, clips, shortlist→episódio, canon.

---

## 6. Modelo de dados ilustrativo

```json
{
  "schemaVersion": 2,
  "episode": { "id": "e s1-3-…", "number": 3, "title": "", "premise": "", "hook": null },
  "story": { "beats": [{ "id": "b1", "who": ["capitao"], "want": "…", "does": "…",
    "obstacle": "…", "result": "…", "change": "…", "decision": { "by": "capitao",
    "options": ["…"], "taken": "…", "why": "…" }, "dialogue": [{"char": "capitao",
    "paren": "…", "line": "…", "fn": "decidir"}] }] },
  "scenes": [{ "id": "s1", "beatId": "b1", "location": "…", "cast": ["capitao", "tininha"],
    "action": "…", "stateIn": {}, "stateOut": {} }],
  "takes": [{ "id": "t1", "sceneId": "s1", "kind": "master|reaction|insert|reframe",
    "function": "estabelecer espaço", "duration": 5, "imageUrl": null, "approved": false,
    "clipApproved": false }]
}
```

Guardar: beats com decisão, cenas com elenco e estados, takes com função e aprovações
separadas (still vs clip). Derivar: prompts, timecodes, contadores, auditorias.

---

## 7. Exemplo: reunião de produção com 5 sentados

Premissa: "Tininha impõe a grelha do Desafio Final; o Capitão veta sem olhar."

- **História (3 beats):** b1 Tininha apresenta (quer aprovar sem ler); b2 Capitão veta
  sem levantar os olhos (decisão registada); b3 Abelha transforma o veto em direto.
- **Cena única** (Sala de Reuniões): cast [tininha, capitao, abelha, claudio, coxa],
  posições fixas (cabeceira Capitão; Tininha de pé com o dossier).
- **Cobertura decidida, não automática:** master `1` (WIDE: mesa + dossier + placar);
  `1a` close-up Tininha (fala); `1b` close-up Capitão, imóvel (reação que é a piada);
  `1c` insert no dossier carimbado "VETADO" (revelação); sem `1d`/`1e` porque Cláudio e
  Coxa só respiram — reação coletiva dispensada por irrelevante. Se a Abelha interrompesse,
  ganhava `1d`. Identificadores ilustrativos, sem numeração fixa.

---

## 8. Lista de código: preservar, refatorar ou eliminar

- **Preservar:** `normalizeAIStory` (com validação a sério), `storyToScenes` (após durações
  por função), `audit`+`auditStory` (como base da auditoria com ação), pipeline de imagem,
  router de texto, sessões/retoma da Sala, `currentEpisode` null-safe, nav com delete.
- **Refatorar:** `renderScript/renderPipeline/renderVideo` (aceitar cenas+tipos novos);
  `buildVideoPrompt` (voz/paren reais); orchestrator (custos em dinheiro, cancelamento);
  `normalize` (sem re-sanitize destrutivo; migração versionada).
- **Eliminar (após §9 do integral + decisão 1):** cluster morto do §3; `updateVideoTab`
  duplicada; ramo `pair`; comentários de designs mortos; docs superados carimbados.
- **Não ressuscitar como fallback** sem decidir: `buildStoryLocal`/`DIALOGUE_BANK`
  (útil só como modo offline explícito, nunca silencioso).

---

## 9. Plano de testes

Determinísticos, sem quota (`tools/test-*.mjs`, `node --test`): elenco/deteção e parceiros;
`normalizeAIStory` com mocks (nomes→ids, locais→8 chaves, `paren` preservado, reframe
só sem-fala-mesmo-local); timecodes sequenciais sem overlap; clamp e teto de duração;
auditoria (repetição, progressão, causalidade partida, guião-vs-prompt); migração v1→v2;
rotas com providers mockados (ordem, erros agregados, 400/401 quebram cadeia);
respostas inválidas; compatibilidade de episódios antigos. Narrativa por modelos só com
quota dedicada e thresholds (nunca prova de qualidade). Humana: grelha cega A/B em 3
premissas fixas. Produção visual: 1 piloto fim-a-fim.

---

## 10. Plano faseado de implementação

- **F0 Segurança (horas):** commit inicial real; export/import JSON de episódios.
  Aceitação: repo versionado + round-trip de 1 episódio. Fora: código.
- **F1 Higiene (C1–C4 do integral):** duplicados, ramos mortos, comentários, docs.
  Aceitação: `grep` limpo + `node --check` + smoke das 5 abas.
- **F2 Validação (maior ROI):** validadores por agente; falhar em vazio; histórico em
  `applyRevisions`; shortlist→rascunho preservando elenco/payoff/crítica.
- **F3 Motor (coração, por flag):** classificador→formatos; beats com decisão;
  cobertura orçamentada; durações por função; edição + aprovação de história;
  auditoria com ação. Manter fallback atual até T1–T6 verdes.
- **F4 Escala:** continuidade (log de eventos), teto 300s, testes, export.
- Sem reformulação visual; sem novos providers; sem modo offline total (decidir antes).

---

## 11. Riscos, dependências e questões em aberto

- Quotas/creditos como dependência única; temperature 0.9 + schemas frouxos = amanhã
  diferente de hoje (testes só com mocks); figuras reais em research (risco editorial se
  avançarem sem sala); sem verificação em browser real (render, polling, clipboard,
  `confirm`); `localStorage` sem backup (`catch` vazio = perda silenciosa total);
  dependência externa não versionada (bíblias V2); 120s vs 300s (decisão 3);
  `hook`/`tagScene`/`coldOpen` fora de qualquer schema (fragilidade de evolução).

---

## 12. O que NÃO devemos implementar ainda

- Modo offline ressuscitado sem decisão explícita (§4.1).
- Clips multi-take / montagem automática (decidir semântica primeiro).
- Novos providers de texto ou imagem.
- Reformulação visual da interface.
- Tetos de 5 minutos e respetivos formatos longos.
- Fusão de abas ou novos separadores.
- Qualquer escrita automática em `research/` pela app.
- Pontuação de qualidade por IA como prova.
- Qualquer migração destrutiva de `localStorage` sem export/import pronto.

---

*Fim. Revisão assente em factos verificados no código em 2026-10-14; nada foi alterado.*
