# Conclusões para OS LESADOS (por aprovar)

Os nossos episódios têm ~80 segundos em 14 takes — já são "curtos" em
duração, mas LONGOS em estrutura (5 blocos de ato + subplot + reframes).
As lições americanas sugerem: menos blocos, mais densidade, fim separado.

## C1. MODO CURTO (11 takes + tag) — revisto: cortam-se BLOCOS, não ângulos

- Correção importante: os **reframes ficam todos** (1b/1c/2b/2c/3b/6b) —
  a variedade de ângulos é a identidade visual; não se mexe.
- O que cai no modo curto: os blocos "fora" — **gabinete (4a/4b) e subplot
  (5a/5b)** — exceto se a premissa os pedir (aí cai o outro):
  premissa de poder → cai o subplot; premissa de bastidores → cai o gabinete.
- Estrutura curta: COLD OPEN → setup (1a/1b/1c) → incidente (2a/2b/2c) →
  perseguição (3a/3b) → clímax (6a/6b) → TAG. ~11 takes, todos com
  cobertura completa. Poupança ~25% + episódios mais tensos.
- Implementação: toggle "Episódio curto" na sidebar + `buildScenesCurto()`
  (filtra blocos, nunca reframes).

## C2. TAG final separada do clímax

- Hoje o 6b fecha com IRIS OUT = clímax prolongado. Criar take TAG real:
  5s, 1 gag de callback (ex. Perpétua ao telefone a resumir o episódio
  mal), sem resolver nada.
- Implementação: take `tag` após 6b em ambos os modos.

## C3. Botões de ato (regra nova R11)

- Cada bloco de ato fecha com button auditável: hoje só takes têm
  `reversal`; propor `actButton` por bloco (setup/incidente/escalada/
  subplot/clímax) + auditoria "bloco sem button".
- Barato: 5 linhas novas por episódio, reutiliza `reversal`.

## C4. Auditoria de densidade cómica

- Nova regra: cada take precisa ≥1 de {diálogo, reversal, gag na ação}.
  Takes "vazios" (ex. 4b sem diálogo quando a visita é muda) chumbam com
  aviso — ou ganham linha de assinatura automática.
- Implementação: 1 função + 1 regra no `audit()`.

## C5. A/B stories formais

- Marcar takes com `story: "A" | "B"`: A = protagonistas da premissa,
  B = subplot (hoje 5a/5b, amanhã Perpétua/Patribunal ou Covil).
- A aba VIDEO e o guião podem filtrar/agrupar por story; a B comenta a A.
- Implementação: campo novo + CSS no guião. Sem custo de geração.

## Ordem sugerida

C4 (1h, só auditoria) → C2 (tag, muda o fim) → C3 (buttons) → C1 (modo
curto, a grande) → C5 (organização). Dizer qual avança.
