# Regra automática do índice de episódios

## Como funciona

A página principal lê o arquivo através de `GET /api/episodes`. O backend lê `Temporadas/Temporada-1/manifest.json` e devolve o conteúdo das fichas. Esta automação acrescenta a decupagem completa ao mesmo registo e disponibiliza-a na página **Arquivo de guiões**.

Quando uma decupagem nova ou atualizada é enviada para `main`:

1. GitHub Actions executa `node scripts/sync-episode-index.mjs`.
2. O script associa `docs/episodios/T1E##-slug-decupagem.md` à ficha `Temporadas/Temporada-1/episodio-##-slug.md`.
3. Só marca a decupagem como completa se encontrar o marcador `<!-- OS_LESADOS_DECOUPAGE_STATUS: COMPLETE -->`, pelo menos três cenas, prompts de imagem, prompts de animação e controlo de continuidade.
4. O manifesto recebe `decoupagePath`, `decoupageStatus` e o estado de produção.
5. O backend entrega o conteúdo da decupagem ao índice; a página apresenta automaticamente o botão **Ler decupagem**.
6. O workflow faz commit automático do manifesto, se este tiver mudado.

O workflow não corre em resposta ao commit do manifesto, evitando um ciclo infinito. A regra é baseada em ficheiros versionados, não em dados guardados apenas no browser.

## Convenção de nomes

- Ficha: `Temporadas/Temporada-1/episodio-03-monte-do-coxa.md`
- Decupagem: `docs/episodios/T1E03-monte-do-coxa-decupagem.md`

O número do episódio tem de coincidir nos dois nomes. Para um episódio novo, criar primeiro a ficha na pasta da temporada e depois a decupagem.

## Prompt de produção para reutilizar

> Trabalha no repositório OS LESADOS e cria/atualiza a decupagem completa do episódio indicado usando a ficha do episódio e o contexto canónico como fontes de verdade.
>
> **Não alteres a história aprovada, os diálogos aprovados, a ordem dos acontecimentos, as relações, o final ou a continuidade sem autorização explícita.** Em caso de conflito, a instrução mais recente do utilizador prevalece e a ficha e o contexto canónico devem ser sincronizados.
>
> Entrega um único ficheiro `docs/episodios/T1E##-slug-decupagem.md` com:
> - estado e duração-alvo;
> - cenas em ordem, cada uma com um plano-mestre;
> - reframes apenas quando necessários para diálogo, reação, ação ou composição;
> - origem explícita de cada reframe;
> - diálogos completos em português europeu (PT-PT);
> - prompt de imagem e prompt de animação para cada plano-mestre e cada reframe que precise de produção própria;
> - continuidade de personagens, roupa, cenário, eixo de câmara e posições;
> - regras de som, transições e final;
> - controlo final de continuidade.
>
> Não acrescentes planos decorativos para aumentar a contagem. Não inventes narradores, falas, biografias, figurinos, personagens ou gags. Usa as referências canónicas do repositório. Sempre que um reframe puder ser obtido a partir do plano-mestre sem perder legibilidade, indica que deve ser um reframe digital.
>
> **Só quando o documento estiver completo e validado**, coloca exatamente este marcador no início do Markdown: `<!-- OS_LESADOS_DECOUPAGE_STATUS: COMPLETE -->`. Nunca uses o marcador para um rascunho.
>
> Depois, atualiza a ficha em `Temporadas/Temporada-1/` e o contexto em `context/episodes/season-1/` para refletirem a mesma versão aprovada. Não edites o manifesto manualmente: o script e o workflow sincronizam-no. Verifica que o episódio aparece no Arquivo de guiões com o botão **Ler decupagem**.
