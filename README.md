# SIAPS Tool · DAPS Betim/MG

Extensão Chrome para consultar indicadores do SIAPS, selecionar unidades/equipes e baixar relatórios Excel. **Versão 1.1.1 · Chrome 120 ou superior.** Município: Betim, IBGE 310670.

## Instalar ou atualizar

1. Baixe [SIAPS-TOOL-1.1.1.zip](dist/SIAPS-TOOL-1.1.1.zip) e extraia em uma pasta que não será apagada.
2. No Chrome, abra `chrome://extensions` e ative **Modo do desenvolvedor**.
3. Para instalar, use **Carregar sem compactação** e escolha a pasta extraída. Para atualizar uma instalação existente, substitua os arquivos na pasta original e clique no botão de recarregar da extensão.
4. Fixe a extensão na barra do Chrome. A permissão **downloads**, nova nesta versão, permite iniciar e acompanhar a conclusão dos arquivos.

Use o pacote 1.1.1, que corrige a largura do popup. A instalação por modo desenvolvedor depende das permissões/políticas do computador institucional.

## Emitir um relatório

1. **Entre no SIAPS** e abra a Visão por Competência. Clique no ícone da ferramenta. Se preferir, use **Abrir em janela maior**.
2. **Escolha o que consultar:** confira o mês sugerido, adicione/remova meses e escolha os indicadores. “Nenhum” realmente deixa a seleção vazia.
3. **Consulte os dados:** clique em **Consultar dados do SIAPS**. A janela pode ser fechada durante a consulta, mas mantenha a aba do SIAPS aberta e sem recarregar.
4. **Confira e baixe:** selecione unidades/equipes, escolha a organização do Excel e abra **Ver exemplo da planilha**. A contagem mostra exatamente os registros dos filtros.
5. Clique em **Baixar Excel** e aguarde a confirmação. Arquivos seguem as configurações de download do Chrome. Se houver vários, cada download é acompanhado antes do próximo.

Um registro representa uma equipe em um indicador e mês. A mesma equipe pode aparecer várias vezes no conjunto, portanto o número de registros é diferente da quantidade de equipes.

### Escolher o formato

- **Detalhado:** identificação, variáveis, numerador/denominador quando aplicável, pontuação e classificação.
- **Resumo:** identificação, pontuação e classificação.
- **Um arquivo Excel:** abas por mês, indicador, unidade ou equipe; também é possível colocar tudo em uma única aba.
- **Arquivos separados:** um Excel por indicador e mês, com confirmação prévia do lote.
- **Cabeçalho e informações:** inclui origem, situação e filtros. Mesmo sem o cabeçalho, relatórios parciais têm uma aba de pendências e nome identificado.

### Se algo der errado

- **Algumas consultas falharam:** veja a lista e use **Continuar / tentar pendências**. Consultas concluídas dentro da validade do cache são reaproveitadas.
- **Precisa de um arquivo parcial:** confira a lista e marque a confirmação. O arquivo é identificado como **PARCIAL** e contém uma aba **Pendências**.
- **Sessão encerrada:** entre novamente no SIAPS e tente as pendências. A ferramenta não simula cliques nem impede a expiração da sessão institucional.
- **Quer interromper:** clique em **Parar operação**. Trabalhos concluídos continuam no cache temporário da aba.
- **Dados podem ter mudado:** use **Atualizar dados**, que ignora o cache para os relatórios escolhidos.
- **Chrome interrompeu um download:** confira `chrome://downloads` e a mensagem da ferramenta. Se repetir a exportação, arquivos já concluídos podem ser baixados outra vez.
- **Precisa de suporte:** em **Detalhes técnicos e diagnóstico**, use **Copiar diagnóstico**. A ferramenta não inclui token nem linhas dos relatórios nesse diagnóstico.

## Limites e cuidado com os dados

- Até **36 meses** por consulta; para muitos indicadores, prefira intervalos menores.
- Cache incremental válido por **15 minutos**, com no máximo **128 relatórios / cerca de 30 MiB** de dados JSON estimados. Consulta atual limitada a cerca de **50 MiB** de dados JSON estimados; a memória total do navegador/XLSX pode ser maior.
- Dados volumosos ficam somente na memória do contexto isolado da extensão, na aba. Não são gravados em storage. Resumos, preferências, histórico recente e medidas de tempo são mantidos separadamente.
- Recarregar/fechar a aba perde a consulta. Alterações normais de rota sem novo documento não devem apagá-la. Cada aba tem sua execução independente.
- Mudança de conta/sessão impede exportar os dados do contexto anterior. Token JWT expirado é recusado; para tokens opacos, a validade depende da resposta do servidor.
- A extensão não envia dados a serviços de terceiros; usa o SIAPS e downloads locais. A permissão da página é limitada a `https://siaps.saude.gov.br/*`.
- Alterações no contrato da API são tratadas como erros identificáveis. Os IDs dos 31 indicadores permanecem os do catálogo original e precisam ser conferidos quando o SIAPS mudar.
- Os fallbacks de M2/eMulti e A4/eAPP aplicam-se somente ao HTTP 500 conhecido do endpoint de tipos; autenticação não é contornada.

## Desenvolvimento

Requer Node.js 22+ e pnpm. ExcelJS é uma dependência local, sem acesso aos módulos internos webpack do SIAPS.

```powershell
pnpm install --frozen-lockfile
pnpm vendor
pnpm check
pnpm test
pnpm exec playwright install chromium
pnpm test:browser
pnpm build
```

O teste de navegador carrega a extensão real em perfil separado do Chromium e intercepta todas as páginas/API do SIAPS com respostas sintéticas. Não usa credenciais reais. XLSX gerados são reabertos e conferidos. Os artefatos ficam em `test-results/`, ignorado pelo Git. Em rede corporativa com certificado confiável do Windows, Node 24 pode precisar de `NODE_USE_SYSTEM_CA=1`; não desative a validação TLS.

`pnpm build` cria o ZIP da versão do manifesto e seu SHA-256. Antes de salvar, descompacta em memória e compara cada arquivo com os fontes. O workflow executa testes e publica o pacote como artefato; publicar uma release ou mesclar uma PR continua sendo uma ação separada.

### Estrutura

| Arquivo | Responsabilidade |
|---|---|
| `catalog.js` | Os 31 indicadores originais |
| `core.js` | Seleções, contratos, esquemas, agrupamento e ordenação |
| `background.js` | Estado/jobs por aba, mensagens, acesso pontual ao token e downloads |
| `main.js` | Coleta, timeout/retry, cache, cancelamento e preparação da exportação em contexto isolado |
| `excel.js` | Estrutura e apresentação dos arquivos Excel |
| `popup.*` | Interface e prévia |
| `vendor/` | ExcelJS 4.4.0 e licença |
| `tests/` | Regressões, XLSX e fluxo no navegador |

Veja [CHANGELOG.md](CHANGELOG.md), [VALIDACAO.md](VALIDACAO.md) e [PENDENCIAS.md](PENDENCIAS.md). Referências da plataforma: [injeção de scripts](https://developer.chrome.com/docs/extensions/reference/api/scripting), [downloads](https://developer.chrome.com/docs/extensions/reference/api/downloads), [ExcelJS](https://github.com/exceljs/exceljs).

Suporte institucional: guilherme.paicheco@betim.mg.gov.br.
