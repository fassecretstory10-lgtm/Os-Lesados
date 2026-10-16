# Temporadas · OS LESADOS

Arquivo de desenvolvimento dos episódios, separado da aplicação e dos assets de produção.

- [Temporada 1](./Temporada-1/README.md): índice dos nove episódios, estados editoriais e documentos individuais.

## Separação de responsabilidades

- **Guiões de origem:** texto narrativo e diálogos completos, incluindo documentos ainda em desenvolvimento.
- **Pipeline:** estrutura visual editável, cena a cena. Cada cena tem o seu próprio prompt e estado de aprovação de imagem.
- **Video:** só deve disponibilizar prompts de animação para imagens aprovadas no Pipeline.
- **Abelha Maia:** não é narradora automática. Só aparece em episódios e cenas em que a sua presença esteja justificada.
- **Canon e contexto de personagens:** fonte separada para personalidade, história, voz, relações e continuidade. A informação de contexto ajuda a escrever, mas não deve alterar silenciosamente o canon.

## Próxima evolução prevista

Uma área de escrita/consulta pode usar os guiões completos e o contexto das personagens para propor revisões, novas cenas ou episódios. Essas sugestões devem permanecer separadas do texto canónico até aprovação humana. O fluxo visual começa apenas depois de existir material narrativo suficiente.

O `manifest.json` lista os episódios e os seus estados; o backend lê os Markdown diretamente da pasta `Temporadas/Temporada-1/`, e a aba Arquivo usa esses documentos como fonte de verdade. Existe um snapshot embebido de reserva caso o endpoint não esteja disponível. O importador prepara um episódio na aba Guião, preserva o texto de origem e evita duplicar o mesmo episódio quando já foi importado. Fichas e conceitos geram uma estrutura visual inicial editável, mas continuam marcados como incompletos.
