# Temporadas · OS LESADOS

Arquivo de desenvolvimento dos episódios, separado da aplicação e dos assets de produção.

- [Temporada 1](./Temporada-1/README.md): índice dos nove episódios, estados editoriais e documentos individuais.

## Separação de responsabilidades

- **Guiões de origem:** texto narrativo e diálogos completos, incluindo documentos ainda em desenvolvimento.
- **Pipeline:** estrutura visual editável, cena a cena. Cada cena tem o seu próprio prompt e estado de aprovação de imagem.
- **Video:** só deve disponibilizar prompts de animação para imagens aprovadas no Pipeline.
- **Canon e contexto de personagens:** fonte separada para personalidade, história, voz, relações e continuidade. A informação de contexto ajuda a escrever, mas não deve alterar silenciosamente o canon.

## Próxima evolução prevista

Uma área de escrita/consulta pode usar os guiões completos e o contexto das personagens para propor revisões, novas cenas ou episódios. Essas sugestões devem permanecer separadas do texto canónico até aprovação humana. O fluxo visual começa apenas depois de existir material narrativo suficiente.

O importador atual envia um episódio do Arquivo para o Pipeline, preserva a origem e evita duplicar o mesmo episódio quando já foi importado. Fichas e conceitos geram uma estrutura visual inicial editável, mas continuam marcados como incompletos.
