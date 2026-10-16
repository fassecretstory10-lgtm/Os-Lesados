# Temporadas · OS LESADOS

Arquivo de desenvolvimento dos episódios, separado da aplicação e dos assets de produção.

- [Temporada 1](./Temporada-1/README.md): índice dos nove episódios, estados editoriais e documentos individuais.

## Separação de responsabilidades

- **Guiões de origem:** texto narrativo e diálogos completos, incluindo documentos ainda em desenvolvimento.
- **Decupagem:** etapa obrigatória entre o Guião e a produção. Cada cena é dividida em planos numerados (por exemplo, 01A, 01B, 01C), com ação, localização, enquadramento, movimento de câmara, duração e diálogo. A decupagem tem de ser aprovada explicitamente antes de desbloquear o Pipeline.
- **Pipeline:** produção visual dos planos aprovados na decupagem. Cada plano tem prompt e aprovação de imagem próprios. Alterações à decupagem anulam a aprovação anterior e exigem nova validação.
- **Video:** só disponibiliza prompts de animação quando a decupagem está aprovada e as imagens correspondentes foram aprovadas no Pipeline.
- **Abelha Maia:** não é narradora automática. Só aparece em episódios e cenas em que a sua presença esteja justificada.
- **Canon e contexto de personagens:** fonte separada para personalidade, história, voz, relações e continuidade. A informação de contexto ajuda a escrever, mas não deve alterar silenciosamente o canon.

## Fluxo de produção obrigatório

1. **Guião:** escrever e aprovar a história e os diálogos.
2. **Decupagem:** transformar a história em cenas e planos filmáveis, revendo continuidade, enquadramentos, ações, falas e durações.
3. **Aprovação da decupagem:** confirmar a estrutura antes de gerar imagens.
4. **Pipeline:** gerar e aprovar os stills, plano a plano.
5. **Video:** animar apenas os stills aprovados.

O importador do Arquivo cria apenas uma estrutura inicial. Não a considera uma decupagem final nem desbloqueia diretamente a produção.

## Próxima evolução prevista

Uma área de escrita/consulta pode usar os guiões completos e o contexto das personagens para propor revisões, novas cenas ou episódios. Essas sugestões devem permanecer separadas do texto canónico até aprovação humana. O fluxo visual começa apenas depois de existir material narrativo suficiente.

O `manifest.json` lista os episódios e os seus estados; o backend lê os Markdown diretamente da pasta `Temporadas/Temporada-1/`, e a aba Arquivo usa esses documentos como fonte de verdade. Existe um snapshot embebido de reserva caso o endpoint não esteja disponível. O importador prepara um episódio na aba Guião, preserva o texto de origem e evita duplicar o mesmo episódio quando já foi importado. Fichas e conceitos geram uma estrutura visual inicial editável, mas continuam marcados como incompletos.
