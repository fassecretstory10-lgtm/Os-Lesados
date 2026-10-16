# OS LESADOS — Backgrounds TO DO
## Objetivo
Lista de ambientes e assets a criar ou validar para a Temporada 1. **Não gerar tudo de novo:** reutilizar backgrounds aprovados sempre que possível e criar apenas os que faltam. Manter a geografia dos espaços, a paleta, o traço 2D e a escala entre planos.

## Regras de continuidade para TODOS os prompts
- **Estilo:** 2D sitcom cartoon, linhas limpas e consistentes, formas legíveis, cores planas com sombras suaves, acabamento igual aos backgrounds existentes de OS LESADOS. Sem fotorrealismo, sem 3D.
- **Formato:** 16:9 horizontal, cenário sem personagens, composição preparada para animação e para crops/reframes. Deixar espaço livre para personagens e diálogo.
- **Referências obrigatórias:** anexar pelo menos 1 background existente de OS LESADOS para estilo e arquitetura; anexar a imagem de referência da personagem relevante quando o cenário tiver de corresponder ao seu espaço; anexar o logótipo TVI existente (context/backgrounds/logo-tvi.png) quando o logótipo estiver visível. Para Secret Story, anexar o logótipo oficial/arte aprovada de Secret Story disponível no projeto. **Não inventar nem redesenhar logos.**
- **Texto legível:** não confiar na geração de texto para placas, logótipos, ecrãs ou documentos. Gerar a placa/ecrã limpo com espaço e aplicar o texto/logótipo correto na pós-produção, usando os assets aprovados.
- **Reframes:** sempre que o mesmo espaço suportar diálogo, gerar um master frame limpo e usar esse master como referência para os reframes. Não criar cenários visualmente diferentes para cada ângulo. Os reframes devem preservar secretária, cadeiras, portas, janelas, iluminação e posição dos adereços.
- **Não incluir:** personagens, mãos, texto aleatório, marcas inventadas, marcas de água, novos logótipos ou adereços que alterem o canon.

---

## PRIORIDADE 1 — Episódio 1: A Rainha dos Reality-Shows

### 1.1 Placa da porta do Capitão Gancho — close-up
**Estado:** criar como asset de detalhe; o corredor e os dois ângulos do gabinete já existem.

**Referências a anexar**
- context/backgrounds/corredor-bastidores.jpg — porta e corredor.
- context/backgrounds/gabinete-diretor-corporativo.jpg — estilo/identidade visual do gabinete.
- context/backgrounds/logo-tvi.png — apenas se o logo TVI estiver na porta/placa ou no corredor.
- Referência aprovada de Capitão Gancho — apenas para coerência do universo, não para o retratar no asset.

**Prompt (EN)**
> Create a clean 2D animated sitcom background detail shot for OS LESADOS, matching the exact linework, palette, materials and lighting of the provided existing TVI corridor reference. Tight cinematic close-up of the executive office door and its small brushed-metal nameplate, mounted at natural eye level. The nameplate must be blank and clearly readable as a physical surface, with enough clean space for the exact title “CAPITÃO GANCHO” to be added in post-production. Keep the door design, corridor colours and proportions consistent with the reference image. No characters, no hands, no extra signs, no generated lettering, no invented logos, no photorealism, no 3D. 16:9 horizontal composition, clean edges, animation-ready.

**Notas de continuidade**
- O texto final da placa deve ser exatamente CAPITÃO GANCHO, colocado em pós-produção se a geração não o reproduzir corretamente.
- Fazer o close-up a partir do mesmo corredor usado no master frame; não inventar outra porta.

### 1.2 Receção da TVI — validar antes de criar
**Estado:** reutilizar context/backgrounds/hall-tvi.jpg se já corresponder à receção com os torniquetes. Só criar uma versão específica se os torniquetes e o balcão não estiverem presentes.

**Referências a anexar**
- context/backgrounds/hall-tvi.jpg
- context/backgrounds/logo-tvi.png
- Referência aprovada da Teresa na sua aparência habitual (sem peruca).
- Referência aprovada da rececionista, se existir; caso contrário, personagem secundária genérica.

**Prompt (EN), only if the existing hall does not fit**
> Create a 2D animated sitcom background for the OS LESADOS TVI headquarters reception, using the provided existing TVI hall image as the primary architectural and style reference. Preserve the same entrance, glass doors, reception desk, lighting, colours and proportions. Add a believable row of electronic access turnstiles between the reception area and the internal corridor, with enough clear floor space for a character to jump over them. Include the existing TVI logo only as supplied in the reference asset; do not redraw or alter it. No people, no text except the supplied logo, no extra branding, no photorealism, no 3D. 16:9 horizontal, animation-ready, clear foreground and background layers.

### 1.3 Gabinete do Capitão Gancho — sem novo background
**Estado:** reutilizar os dois backgrounds existentes, sem os substituir:
- gabinete-diretor-secretaria.jpg — ângulo de Gancho atrás da secretária.
- gabinete-diretor-corporativo.jpg — ângulo de visita/confronto.

**Workflow**
1. Escolher o master frame mais fiel à disposição aprovada.
2. Para a conversa, gerar reframes dos dois ângulos a partir dos backgrounds existentes.
3. Anexar como refs os dois backgrounds do gabinete, a referência aprovada de Capitão Gancho e a referência aprovada da Teresa na aparência habitual.
4. Preservar secretária, cadeira, documentos, porta, luz e posição relativa das personagens. Não criar um novo gabinete para os planos de reação.
5. O logo TVI só deve ser incluído se estiver visível no cenário original; usar o asset oficial como referência.

**Correção de personagem para o Episódio 1:** Teresa aparece com a sua aparência habitual, **sem peruca**. A coroa e a sua atitude são suficientes para a identificação da personagem. Atualizar o guião para remover qualquer menção à peruca.

---

## PRIORIDADE 2 — Episódio 3: Monte do Coxa

### 2.1 Exterior do Monte do Coxa
**Estado:** novo background necessário, salvo se já existir noutro diretório local.

**Referências a anexar**
- Background aprovado de corredor-bastidores.jpg ou hall-tvi.jpg apenas como referência de estilo 2D (não de arquitetura).
- Referência aprovada de Coxa.
- Referência aprovada de Capitão Gancho.
- Referência visual do Mercedes-Benz Classe S pretendido; usar apenas para a forma do carro, sem logótipos inventados.
- Logótipo TVI não é necessário neste local rural.

**Prompt (EN)**
> Create a 2D animated sitcom environment for OS LESADOS: the exterior of “Monte do Coxa”, a quiet Portuguese countryside retreat with a modest, slightly old-fashioned country house, stone driveway, low stone wall, mature trees and green rolling hills. The location should feel peaceful and private, a place where a television presenter has escaped to rest. Leave a clear driveway and foreground where a black Mercedes-Benz S-Class can pull up. Use the supplied OS LESADOS background only as a strict reference for 2D linework, flat colours, shadows and proportions, not for its architecture. No people, no text, no signage, no logos, no photorealism, no 3D. 16:9 horizontal, animation-ready, establish a clear and reusable layout.

### 2.2 Mercedes-Benz — plano de chegada e bagageira
**Estado:** criar como variações/props consistentes, não como cenários independentes se for possível manter o mesmo carro através de reframes.

**Referências a anexar**
- O background aprovado do Monte do Coxa depois de criado.
- Referência visual do Mercedes-Benz Classe S escolhida para a série.
- Referências aprovadas de Coxa e Capitão Gancho para escala e continuidade.

**Prompt (EN)**
> Create a consistent 2D animated prop/reference sheet for the same black Mercedes-Benz S-Class arriving at Monte do Coxa in OS LESADOS. Show the exact same car in three matching views: front three-quarter view, side view, and rear view with the boot open. Keep body shape, colour, wheel design, window tint and proportions identical across all views. Match the supplied OS LESADOS cartoon linework and flat-colour style. No characters, no readable number plates, no invented branding or badges, no photorealism, no 3D. Plain neutral background, 16:9 sheet, clean silhouettes suitable for reuse.

**Notas**
- A sequência de meter Coxa na bagageira deve ser planeada com o utilizador antes de criar imagens finais; manter a ação cómica e claramente fictícia.
- O carro deve ser sempre o mesmo entre chegada, plano lateral e traseira.

---

## PRIORIDADE 3 — Episódio 4: O Casting dos Desesperados

### 3.1 Sala de casting
**Estado:** novo background provável. Verificar primeiro se existe um cenário de casting noutro diretório.

**Referências a anexar**
- context/backgrounds/sala-reunioes.jpg — estilo e ambiente de produção Secret Story.
- context/backgrounds/estudio-secretstory.jpg — identidade visual do formato.
- Logótipo/arte aprovada de Secret Story disponível no projeto.
- Referências de Tininha e Capitão Gancho, se aparecerem nos planos; os backgrounds devem ser gerados sem personagens.

**Prompt (EN)**
> Create a 2D animated sitcom background for a rushed reality-TV contestant casting room at the fictional TVI/Secret Story production. Match the provided OS LESADOS meeting-room and Secret Story studio references in linework, colour palette and production design. A compact casting space with a simple audition chair, a small table with clipboards and papers, a camera on a tripod, a ring light and a neutral backdrop. It should feel improvised and under pressure, but still part of the same television company. Leave open floor space for contestants to enter and sit. Use only supplied official TVI/Secret Story logo references where appropriate; do not invent or redraw logos. No people, no generated text, no photorealism, no 3D. 16:9 horizontal, animation-ready.

---

## PRIORIDADE 4 — Episódio 8: O Barco da TVI

### 4.1 Barco da Douro Azul no Tejo, junto à Ponte 25 de Abril
**Estado:** novo background necessário.

**Referências a anexar**
- Um background aprovado de OS LESADOS para manter o estilo 2D.
- Referência aprovada de Mário Galático.
- Referência visual do barco/cruzeiro da Douro Azul pretendido.
- Referência visual da Ponte 25 de Abril, para preservar a silhueta e proporções.
- Logótipo TVI apenas se fizer parte de um ecrã, bandeira ou grafismo da produção; usar o asset oficial existente.
- Não criar nem inventar logótipos da Douro Azul: anexar referência oficial se o nome/logo for visível.

**Prompt (EN)**
> Create a 2D animated sitcom establishing background for OS LESADOS: a large Douro Azul-style river cruise boat on the Tagus in Lisbon, with the 25 de Abril Bridge clearly visible in the background. Use the supplied bridge and boat references for recognisable silhouettes and keep the scene geographically coherent. The boat should have a broad passenger deck and enough visible windows and railings to support later shots of a comic onboard crisis. Match the supplied OS LESADOS cartoon style: clean outlines, readable shapes, flat colours and soft shadows. No characters, no sinking or damage yet, no invented logos, no random lettering, no photorealism, no 3D. 16:9 horizontal, wide establishing composition, animation-ready.

### 4.2 Interior/deck do barco
**Estado:** criar apenas depois de confirmar onde decorre a maior parte da ação no guião.

**Referências a anexar**
- O background exterior do barco aprovado em 4.1.
- A referência aprovada de Mário Galático.
- A mesma referência do barco usada em 4.1.
- Logos apenas se forem fornecidos como assets oficiais.

**Prompt (EN)**
> Create a 2D animated interior/deck environment belonging to the exact same river cruise boat shown in the supplied OS LESADOS exterior reference. Match its window shapes, railings, materials, colours and scale. The space should support a small group of characters arguing while the boat begins to tilt later in animation, with a clear floor plane and stable architectural landmarks for continuity. Do not show characters, water entering, damage or a tilted horizon in this base version. No invented logos or lettering, no photorealism, no 3D. 16:9 horizontal, clean sitcom staging, animation-ready.

### 4.3 Variação de emergência — só depois do master frame
**Estado:** não criar como novo cenário base. Criar como reframe/variação do barco aprovado quando o guião estiver fechado.

**Referências a anexar**
- Master frame exterior e/ou interior aprovado do barco.
- Referência aprovada de Mário Galático.
- Props e detalhes do barco aprovados.

**Prompt (EN)**
> Using the supplied approved OS LESADOS boat master frame as a strict image reference, create a later continuity version of the exact same shot after a comic emergency begins. Preserve the boat architecture, windows, railings, bridge placement, colour palette and camera geography exactly. Introduce only subtle, readable signs of trouble appropriate to the approved storyboard, such as a slight tilt and a few objects sliding; do not redesign the vessel or change the location. No new characters, no new logos, no random text, no photorealism, no 3D. 16:9 horizontal.

---

## EPISÓDIOS QUE NÃO PRECISAM DE NOVO BACKGROUND (POR AGORA)

- **Episódio 2 — O Ar Está Contra Mim:** reutilizar camarim-espelho.jpg. Só criar um insert/prop de ar condicionado se o aparelho não existir no cenário atual.
- **Episódio 5 — A Roda Está Viciada:** reutilizar gabinete-diretor-secretaria.jpg, gabinete-diretor-corporativo.jpg e escritorio-secreto-guilhermina.jpg. Criar relatórios/gráficos de audiências como props separados, não como novos backgrounds.
- **Episódio 6 — Edição Especialíssima:** reutilizar sala-reunioes.jpg. O cenário é uma sala de reuniões da produção, não uma régie/sala de controlo. Gerar reframes a partir do master frame; adicionar adereços de exaustão (copos de café, papéis, portátil) como props, sem mudar a arquitetura.
- **Episódio 7 — A Espia:** reutilizar o escritório secreto de Teresa e os cenários corporativos já aprovados. Só criar um novo espaço se o guião aprovado o exigir.

## VERIFICAÇÃO DE FICHEIROS / MANIFEST

A listagem atual do GitHub mostra que o manifest.json referencia alguns ficheiros que não aparecem na listagem atual de context/backgrounds: sala-controlo.jpg, camarim.jpg, zona-catering.jpg, exterior-estacao.webp e base-alerta-mel.jpeg. **Verificar se existem localmente antes de os voltar a criar.** Não alterar o manifest nem o código sem confirmar a localização dos ficheiros.

## Ordem de trabalho recomendada
1. Confirmar os assets existentes localmente e os ficheiros em falta no manifest.
2. Criar o close-up da placa “CAPITÃO GANCHO”.
3. Criar e aprovar o master frame do Monte do Coxa; depois preparar a referência consistente do Mercedes.
4. Criar e aprovar o casting room, caso não exista um equivalente.
5. Criar o master frame exterior do barco e só depois o interior/deck.
6. Só após os guiões estarem aprovados, criar reframes e variações de ação.


---

## REGRA NOVA — CADA TAREFA TEM DE TER UM PROMPT DE IDEIAS

Antes de gerar um background novo, ou uma variação de um background existente, começar por explorar opções. Não saltar diretamente para a geração final.

### Prompt para gerar ideias de cenário (usar no generator de texto/brainstorming)

**Prompt (EN)**
> You are the visual development artist for OS LESADOS, a 2D Portuguese television-industry satire sitcom. Based on the attached approved background references, character references, episode premise and location requirements, propose 5 distinct but production-practical visual ideas for this environment. Preserve the established OS LESADOS art style, architecture, palette, TVI/Secret Story branding and character canon. For each idea, provide: (1) a short concept name, (2) what makes it visually funny or useful for staging, (3) the main wide-shot composition, (4) two useful alternate camera angles, (5) continuity risks, (6) which existing references must be attached, and (7) a suggested asset filename and exact human-readable generator label. Do not invent logos, legible brand text, new canon locations or details that contradict the references. Prefer reusing existing sets and creating camera angles/reframes over designing new environments. Do not generate an image yet. Present options for approval first.

**Quando usar:** antes de criar qualquer cenário novo, prop importante ou novo ângulo. Escolher uma proposta e só depois executar o prompt de imagem.

---

## PROMPTS PARA NOVOS ÂNGULOS DOS BACKGROUNDS EXISTENTES

Criar novos ângulos só quando o guião precisar deles. Anexar sempre o background master aprovado como referência principal; anexar também um segundo ângulo existente do mesmo espaço, se houver, para explicar a geografia. O objetivo é mostrar outra câmara no mesmo espaço, não redesenhar o espaço.

### Prompt-base para gerar um novo ângulo (EN)

> Using the attached approved OS LESADOS background as the strict master reference, create a new camera angle of the exact same location for a 2D animated sitcom. This must be the same physical room, not a redesign. Preserve the architecture, wall colours, furniture, doors, windows, lighting direction, prop placement, materials, proportions and established art style. Move only the virtual camera to the requested angle: [INSERT CAMERA ANGLE AND SHOT SIZE]. Maintain screen direction and spatial continuity with the master frame. Keep the environment empty, with no characters or human silhouettes. Preserve all supplied logos exactly as they appear in the reference; do not redraw them. Do not generate new text, signs, logos or extra props. 16:9 horizontal, clean animation-ready background. Before finalising, compare the result against the master reference and correct any continuity mismatch.

### Prompt-base para reframe/crop, sem inventar novo ângulo (EN)

> Create a tighter reframe of the attached approved OS LESADOS background. Keep the exact same camera perspective and physical scene; only adjust framing and crop to [INSERT SHOT SIZE: medium / close-up / insert]. Preserve all visible geometry and the relative positions of furniture, doors, windows and props. Do not add, remove or move set elements. No characters, no new text or logos. Match the original 2D sitcom style. 16:9 horizontal unless the project explicitly requires another aspect ratio.

### Ângulos recomendados por background existente

#### Gabinete do Capitão Gancho
Já existem: gabinete-diretor-secretaria.jpg (Gancho atrás da secretária) e gabinete-diretor-corporativo.jpg (ângulo corporativo para visitas/confrontos).

- Não criar outro gabinete. Usar os dois existentes e gerar reframes dos mesmos.
- Para diálogo Teresa/Gancho, alternar entre: master de Gancho atrás da secretária; master corporativo de visita; reframe médio de Gancho; reframe médio de Teresa; close-up de reações; insert dos documentos ou do telefone.
- Para os reframes de personagens, anexar o background correspondente e as referências oficiais das personagens. Gerar as personagens como elementos separados quando esse for o pipeline do projeto; não incorporar personagens no background.
- Para o insert da placa, usar o prompt 1.1 e o corredor existente.

**Prompt para ângulo de visita, se o existente não cobrir o plano necessário (EN)**
> Using gabinete-diretor-corporativo.jpg as the primary reference and gabinete-diretor-secretaria.jpg as the spatial continuity reference, create only the missing camera angle needed for a dialogue scene. Preserve the exact same executive office, desk, chair, TV wall, doors, lighting and palette. Camera angle requested: [INSERT ANGLE]. Do not create a different room or alter the furniture layout. Empty set, no characters, no new text or logos, 16:9 horizontal, OS LESADOS 2D sitcom style.

#### Hall TVI / receção
Master existente: hall-tvi.jpg.

Ângulos possíveis, apenas se necessários:
- hall-tvi-wide — plano geral da receção e torniquetes.
- hall-tvi-turnstiles — plano médio dos torniquetes, com espaço de aterragem.
- hall-tvi-reception — plano médio do balcão da rececionista.
- hall-tvi-exit-corridor — ângulo do hall em direção ao corredor interior.

**Prompt (EN)**
> Using hall-tvi.jpg as the strict master reference, create the requested alternate camera angle: [INSERT ONE ANGLE FROM THE LIST]. Keep the same TVI reception, entrance, desk, turnstiles, floor, lighting, colours and exact supplied logo placement. This is a new view of the same location, not a redesign. Leave clear staging space for the action. No people, no new lettering, no invented branding, no 3D or photorealism. 16:9 horizontal, OS LESADOS 2D sitcom style.

#### Corredor de bastidores
Master existente: corredor-bastidores.jpg.

Ângulos possíveis:
- corredor-bastidores-wide — plano geral que estabelece a geografia.
- corredor-bastidores-door-cg — porta do gabinete de Gancho.
- corredor-bastidores-towards-offices — vista em direção às portas dos gabinetes.

Para o close-up da placa, usar a tarefa 1.1 em vez de gerar outro corredor completo.

#### Camarim
Masters existentes: camarim.jpg e camarim-espelho.jpg. Confirmar os nomes e ficheiros reais antes de usar; o manifest atual contém ambos.

Ângulos possíveis:
- camarim-wide — plano geral do camarim.
- camarim-mirror-medium — plano médio em direção ao espelho.
- camarim-mirror-closeup — close-up do espelho/lâmpadas e zona de maquilhagem.
- camarim-ac-unit — insert do aparelho de ar condicionado, apenas se não existir no cenário atual.

**Prompt (EN)**
> Using the approved OS LESADOS dressing-room master as the strict reference, create the requested shot: [INSERT ANGLE]. Preserve the same vanity mirror, bulbs, chair, countertop, cosmetics, wall details, air-conditioning unit if present, lighting and layout. The shot must belong to the exact same room. No characters, no additional furniture, no new text or logos. 2D sitcom cartoon, 16:9 horizontal, animation-ready.

#### Sala de reuniões Secret Story
Master existente: sala-reunioes.jpg.

Ângulos possíveis:
- sala-reunioes-wide — plano geral com toda a mesa e a equipa.
- sala-reunioes-capitao-end — vista a partir da cabeceira de Capitão Gancho.
- sala-reunioes-team-side — vista lateral da equipa.
- sala-reunioes-intern-closeup — reframe para o lugar do estagiário; não gerar personagem dentro do background.
- sala-reunioes-table-insert — insert da mesa com papéis, copos de café e portátil, se esses props forem necessários.

**Prompt (EN)**
> Using sala-reunioes.jpg as the strict master reference, create the requested alternate angle: [INSERT ANGLE]. Preserve the same production meeting room, table shape, chair positions, wall details, lighting, Secret Story visual identity and room geography. This is a room for a production team meeting, not a control room or broadcast gallery. Keep the set empty. Do not add people, random screens, invented logos or readable generated text. 2D OS LESADOS sitcom style, 16:9 horizontal.

#### Escritório secreto da Teresa
Master existente: escritorio-secreto-guilhermina.jpg.

Ângulos possíveis:
- escritorio-secreto-wide — plano geral do espaço e do trono.
- escritorio-secreto-monitors — ângulo dos monitores de vigilância.
- escritorio-secreto-phone — insert da secretária/telefone para a chamada.
- escritorio-secreto-reaction — reframe para a zona onde Teresa reage, mantendo o cenário vazio.

**Prompt (EN)**
> Using escritorio-secreto-guilhermina.jpg as the strict master reference, create the requested alternate angle: [INSERT ANGLE]. Preserve the same secret office, throne, monitor wall, desk, props, lighting and palette. Do not add new rooms or change the layout. Keep monitors consistent with the supplied reference and avoid legible generated text. Empty background, no characters, no new logos, 2D OS LESADOS sitcom style, 16:9 horizontal.

---

## NOMES DOS FICHEIROS E COMO O GENERATOR OS ENCONTRA

O generator usa as entradas do context/backgrounds/manifest.json para apresentar/identificar backgrounds. Por isso, um ficheiro dentro de TO_DO não passa automaticamente a ser um background disponível no generator.

### Regras de nome
1. Guardar os backgrounds finais aprovados diretamente em context/backgrounds/, salvo se a aplicação tiver uma convenção diferente para assets gerados.
2. Usar nomes curtos, descritivos, sem acentos nem espaços, por exemplo monte-do-coxa-exterior.jpg, casting-room.jpg, barco-tvi-exterior.jpg.
3. Para ângulos do mesmo espaço, manter um prefixo comum: gabinete-diretor-reframe-teresa.jpg, hall-tvi-turnstiles.jpg, sala-reunioes-team-side.jpg.
4. O nome apresentado ao utilizador no generator deve ser um rótulo claro em português. Exemplos:
   - Monte do Coxa — Exterior (master)
   - Sala de Casting — Plano Geral
   - Barco da TVI — Exterior (master)
   - Gabinete do Diretor — Reframe Teresa
5. Depois de o ficheiro final existir e estar aprovado, adicionar o respetivo rótulo e filename ao context/backgrounds/manifest.json. Não adicionar assets planeados ao manifest antes de existirem, porque isso pode criar referências partidas.
6. Não alterar nomes nem substituir backgrounds existentes sem atualizar e verificar as referências no manifest.

### Prompt para pedir ao generator ideias de novos ângulos (EN)

> Review the available OS LESADOS backgrounds and the episode scene requirements. Recommend only camera angles that are genuinely missing and would improve the edit. For each suggested angle, provide: the existing master filename, the exact camera position and shot size, what story beat it supports, whether it is a crop/reframe or a genuinely new view, the required image references, a generation prompt, a proposed filename, and the exact Portuguese label to add to context/backgrounds/manifest.json after approval. Do not recommend duplicates of existing angles. Do not generate images yet; return a shortlist for approval.

### Checklist antes de marcar um asset como concluído
- [ ] A ideia foi proposta e aprovada antes da geração final.
- [ ] Foram anexadas as referências de background, personagem e logos relevantes.
- [ ] O novo asset corresponde ao mesmo espaço e ao estilo visual da série.
- [ ] Foi comparado com o master frame para detetar diferenças de continuidade.
- [ ] O ficheiro foi guardado com nome descritivo.
- [ ] Só depois de existir, foi acrescentado ao manifest.json com um rótulo português claro.
