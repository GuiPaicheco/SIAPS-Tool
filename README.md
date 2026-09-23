# SIAPS-TOOL 1.0.0

Extensão Chrome interna da DAPS Betim/MG para consolidar dados da Visão por Competência do SIAPS e exportar relatórios XLSX.

## Instalação interna

1. Extraia o pacote `SIAPS-TOOL-1.0.0.zip` em uma pasta local.
2. Abra `chrome://extensions` no Google Chrome.
3. Ative o **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e selecione a pasta extraída (a pasta que contém `manifest.json`).
5. Abra `https://siaps.saude.gov.br/`, entre no SIAPS e acesse a Visão por Competência.
6. Abra o popup da extensão pelo ícone do Chrome.

Não há tela de login própria: a extensão usa exclusivamente a sessão autenticada já existente no SIAPS, inclusive o `access_token` da página.

## Como usar

1. Adicione uma ou mais competências (mês/ano).
2. Selecione todos os indicadores, indicadores individuais ou um grupo de equipe (eSF/eAP, eSB, eMulti, eAPP, entre outros).
3. Clique em **Gerar consolidações**. Essa etapa consulta o SIAPS e mantém os resultados em memória na própria aba do SIAPS; ela não baixa arquivos.
4. Após a conclusão, filtre unidades e equipes, defina o modo de dados, metadados e ordenação.
5. Clique em **Baixar planilha**. A exportação reutiliza a consolidação existente, sem nova consulta à API.

O modelo desta versão é um XLSX por indicador e por competência. Quando os filtros resultarem em mais de um arquivo, o popup mostra uma confirmação com a quantidade de arquivos e registros antes de iniciar os downloads.

## Modos de dados

- **Planilha completa:** inclui as variáveis do indicador, além das colunas fixas.
- **Apenas dados analíticos:** mantém as colunas fixas, pontuação e classificação.

Os metadados institucionais podem ser incluídos ou removidos sem alterar a consolidação. A ordenação utiliza `score` numérico; campos disponíveis apenas em parte dos indicadores não são oferecidos como opções para um conjunto misto.

## Limitações importantes

- Mantenha a **mesma aba SIAPS aberta e sem recarregar** entre a consolidação e o download. A consolidação é invalidada se a aba for recarregada, fechada ou trocada.
- Fechar o popup não interrompe uma execução. Ao reabri-lo, o status e os logs recentes são recuperados enquanto a aba SIAPS permanecer válida.
- Muitas competências e indicadores podem consumir memória da aba. A versão não impõe limite, mas recomenda consolidar conjuntos grandes em lotes menores quando necessário.
- A disponibilidade de dados depende do SIAPS para cada competência e indicador selecionado.

## Estrutura

- `popup.html`, `popup.css`, `popup.js`: interface, estado e validações do popup.
- `background.js`: coordenação, persistência de estado e ponte com a aba SIAPS.
- `content.js`: ponte de mensagens entre extensão e página.
- `main.js`: motor de coleta, consolidação, filtros e geração XLSX.

O motor continua executando no contexto principal da página SIAPS para preservar o ExcelJS e o FileSaver já disponibilizados pelo sistema. Endpoints, autenticação, paginação, retries e fallbacks dos indicadores 118/128 permanecem no motor existente.
