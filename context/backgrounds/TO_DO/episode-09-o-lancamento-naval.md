

---

## PRIORIDADE 5 — Episódio 9: O Lançamento Naval (Dourito Blue)

**Documento de produção:** [episode-09-o-lancamento-naval.md](episode-09-o-lancamento-naval.md)

### Regra de marca e continuidade
O nome da empresa de Mário Galático é sempre **Dourito Blue**. Não escrever “Dourito Blue” em guiões, adereços, ecrãs ou prompts futuros. Se aparecer texto de marca, gerar a superfície limpa e aplicar “Dourito Blue” na pós-produção. A marca não deve ser confundida com logótipos reais.

### 5.1 Abertura aérea da TVI — reutilizar, não regenerar
**Assets existentes no manifest:** `exterior-tvi-aerea.jpg` e `exterior-tvi-transicao.jpg`.

**Plano recomendado:** começar com o master aéreo da torre/edifício; fazer zoom-in suave e contínuo até ao edifício. Cortar para o exterior de transição e continuar o movimento em direção à entrada. Depois cortar para o corredor interior. Esta abertura é a assinatura visual do episódio e deve manter a mesma geografia, paleta e arquitetura dos episódios anteriores.

**Referências a anexar ao gerador de vídeo/reframe**
- `context/backgrounds/exterior-tvi-aerea.jpg` — master de abertura.
- `context/backgrounds/exterior-tvi-transicao.jpg` — continuidade do movimento.
- `context/backgrounds/logo-tvi.png` — só se o logótipo estiver visível e precisar de referência.
- Um background interior aprovado de OS LESADOS para confirmar o acabamento visual.

**Prompt (EN) — image-to-video / camera move**
> Animate the supplied approved OS LESADOS aerial TVI exterior background as a restrained 2D sitcom establishing shot. Begin on the exact existing wide aerial composition, then perform a smooth, slow forward push-in toward the TVI building, keeping the tower, facade, windows, logo placement, perspective and colour palette unchanged. Subtle atmospheric movement only; no dramatic drone banking, no new buildings, no added signage, no people appearing, no redesign, no 3D, no photorealism. This is the recurring opening language of the same animated series. 16:9, stable camera, clean animation.

**Transição (EN)**
> Use the supplied approved exterior TVI transition frame as the next shot in the same continuous visual journey. Continue the forward zoom toward the entrance without changing the building design, perspective, colours or logo. End with a clean cut motivated by the entrance/camera movement into the existing backstage corridor. Do not morph the building or invent a new entrance. 16:9, restrained 2D sitcom animation.

### 5.2 Corredor de bastidores — chegada do modelo
**Estado:** reutilizar `corredor-bastidores.jpg`; gerar apenas um reframe se o enquadramento existente não der espaço à maquete.

**Referências**
- `context/backgrounds/corredor-bastidores.jpg` — master obrigatório.
- `context/backgrounds/exterior-tvi-transicao.jpg` — continuidade da direção de entrada.
- Referência aprovada de Mário Galático — apenas para escala e continuidade da personagem.
- Referência do modelo de navio criada na tarefa 5.4.

**Prompt (EN) — new angle only if needed**
> Using the approved OS LESADOS backstage corridor as a strict master reference, create a wider camera framing of the exact same corridor, with clear foreground space for a large ship scale model to be carried through. Preserve all existing doors, wall details, lighting, perspective, colours and proportions. This is the same corridor, not a redesign. Keep the background empty: no people, no model, no text, no new logos. Match the established clean 2D sitcom linework, flat colours and soft shadows. 16:9 horizontal.

### 5.3 Gabinete do Capitão Gancho — negociação
**Estado:** reutilizar os backgrounds existentes. Não criar um gabinete novo.

**Referências**
- `gabinete-diretor-secretaria.jpg` — Capitão atrás da secretária.
- `gabinete-diretor-corporativo.jpg` — ângulo de visita/confronto.
- Referência aprovada de Capitão Gancho.
- Referência aprovada de Mário Galático.

**Planos a preparar por reframe**
1. Plano geral do Capitão à secretária, deixando espaço livre à frente para Mário entrar.
2. Plano médio de Mário a apresentar a ideia.
3. Close-up seco do Capitão depois de ouvir “os meus novos navios”.
4. Insert da mão/gancho do Capitão pousado na secretária, apenas se a mão for gerada como elemento separado no pipeline.
5. Plano de reação dos dois, mantendo a mesma geografia do gabinete.

**Prompt (EN) — reframe**
> Create a tighter reframe from the supplied approved OS LESADOS executive-office master. Preserve the exact same desk, chair, TV wall, doors, lighting, colour palette and perspective. Frame for a dry comedic reaction shot of the executive seated behind the desk, leaving clean space for a separately composited character. Do not redesign the room or add characters, props, text or logos. Match the established 2D sitcom art style, 16:9.

### 5.4 Maquete dos navios Dourito Blue — referência de adereço
**Estado:** novo asset de referência necessário. Gerar primeiro a folha de referência; só depois usar a maquete nos planos do corredor e estúdio.

**Referências**
- Background aprovado de OS LESADOS para o traço e paleta.
- Referência aprovada de Mário Galático: manter o fato azul-marinho e os pins de foguetão/âncora; não incluir a personagem na folha do adereço.
- Imagens de referência de navios de cruzeiro apenas para proporções gerais, sem copiar marcas reais.
- Não usar logótipos reais de operadores marítimos.

**Prompt (EN)**
> Create a clean 2D animated prop design sheet for OS LESADOS, a Portuguese television-industry satire sitcom. Design one absurdly extravagant but recognisable river-cruise ship scale model commissioned by the fictional company Dourito Blue: elegant white hull, dark navy and blue accents, several passenger decks, oversized presentation lights, a tiny stage built into the bow and a deliberately excessive premium look. Include consistent front three-quarter, side and rear views of the exact same model on a plain neutral background. Keep the shapes readable and the scale-model nature obvious. Match the supplied OS LESADOS 2D cartoon linework, flat colours and soft shadows. No characters, no real company logos, no random lettering, no watermarks, no photorealism, no 3D. 16:9 horizontal reference sheet. Leave a clean blank area on the model for the fictional Dourito Blue branding to be composited later.

### 5.5 Estúdio principal — apresentação dos navios
**Estado:** verificar se `estudio-secretstory.jpg` cobre o espaço. Reutilizar como referência de arquitetura/estilo; criar um novo master apenas se não houver espaço de palco suficiente para a apresentação.

**Referências obrigatórias**
- `context/backgrounds/estudio-secretstory.jpg` — referência principal do estúdio existente.
- `context/backgrounds/sala-reunioes.jpg` — apenas para coerência do universo de produção, não para copiar a arquitetura do estúdio.
- Folha de referência aprovada da maquete Dourito Blue.
- Referências aprovadas de Mário Galático, Capitão Gancho e Tininha, para escala/continuidade; não os incluir no background.
- Logo TVI/Secret Story apenas se já fizer parte do cenário original; usar os assets fornecidos, nunca redesenhar.

**Prompt (EN) — only if a new master is genuinely needed**
> Create a 2D animated sitcom background for the main TV studio inside the existing fictional TVI headquarters in OS LESADOS. Use the supplied approved studio image as the strict style and production-design reference. Preserve the established studio architecture, lighting language, colour palette, camera-facing stage layout and supplied branding. Adapt only the central stage area to accommodate a ridiculous corporate launch presentation for fictional Dourito Blue: a clean presentation platform, a large blank LED screen, a few elegant blue-and-white display lights and enough clear floor space for a ship scale model. The set must still read as the same TV studio, not a marina or ship interior. No people, no ship model in this background, no generated lettering, no invented logos, no extra screens beyond what is needed, no photorealism, no 3D. Clean 2D sitcom background, 16:9 horizontal, animation-ready.

### 5.6 Plano final — navio enorme à entrada de serviço
**Estado:** variação específica do episódio, a gerar só depois da aprovação do guião e dos masters-base. Não faz parte da biblioteca de cenários reutilizáveis.

**Referências**
- Exterior TVI aprovado: `exterior-tvi-transicao.jpg` e/ou `exterior-tvi-aerea.jpg`.
- Corredor/entrada de serviço aprovado, se existir no projeto.
- Folha de referência da maquete Dourito Blue, apenas para a linguagem visual do design do navio; a embarcação final é uma versão gigantesca, não uma cópia literal da escala da maquete.
- Um background aprovado de OS LESADOS para manter o estilo 2D.

**Prompt (EN)**
> Create a single absurdist 2D animated sitcom reveal background for OS LESADOS: outside the service entrance of the same established TVI building, an impossibly oversized fictional Dourito Blue river-cruise ship has been manoeuvred into the delivery/loading area, far too large for the space. The comedy comes from the scale mismatch: the ship's white-and-navy hull fills most of the frame while the familiar TVI service entrance and building remain recognisable beside it. Keep the architecture and palette consistent with the supplied approved TVI exterior reference. The ship design should echo the approved Dourito Blue model sheet, enlarged to an absurd scale. No people, no damage, no water flooding the building, no invented company logos or generated text. Clean 2D cartoon linework, flat colours, soft shadows, 16:9 horizontal. Do not turn the scene into a real marina or change the TVI building.

**Nota de encenação:** para preservar a lógica visual, não mostrar o navio literalmente a navegar por um corredor interior. O gag é que está do lado de fora, na entrada de serviço, e a equipa só percebe a dimensão quando olha para o monitor/janela.

### 5.7 Sequência de planos / transições recomendada
1. Exterior aéreo TVI: establishing shot + zoom-in lento (asset existente).
2. Exterior de transição: continuar o zoom até à entrada (asset existente).
3. Corredor: plano geral; som distante de buzina marítima antes de revelar Mário.
4. Maquete atravessa o enquadramento e tapa a lente: transição prática para o gabinete.
5. Gabinete do Capitão: plano geral, depois plano/contraplano e close-ups secos.
6. Corte motivado pelas luzes do estúdio a acenderem.
7. Estúdio: plano geral da apresentação; insert da maquete; reações de Tininha e Capitão.
8. Ecrã/monitor mostra o exterior; o reflexo ou a sombra do navio revela a escala.
9. Corte para o exterior de serviço com o navio gigante.
10. Voltar ao Capitão em close-up para a última frase; corte para preto e buzina.

Não gerar cada plano como cenário independente se puder ser obtido por reframe do master. Não gerar imagens finais até a seleção de referências e a geografia dos cenários estarem aprovadas.
