# Validação da versão 1.1.0

Data: 10/11/2026. Ambiente local: Windows, Node.js 24.22.1, Chromium 141 (perfil de testes separado).

## Verificações automatizadas

- **29 testes de lógica/integração local:** estado independente por aba, bloqueio de cliques concorrentes, rejeição de jobs/documentos antigos, seleção vazia/restaurada, filtro composto, esquema único, os 31 IDs do catálogo com fixtures sintéticas, identidade de variáveis, ordenação global por score bruto, deduplicação/paginação, modos completo/resumo, cache incremental, invalidação de cache após atualização com falha, autenticação, cancelamento, exportação parcial e XLSX reaberto.
- **13 cenários no Chromium com a extensão real:** consulta parcial, confirmação de parcial, download confirmado pelo Chrome, leitura do arquivo gerado, reabertura da interface, retry incremental, nenhuma unidade selecionada, ordenação global, layout de 360px, isolamento entre abas, parar/continuar, lote de 12 downloads e recarga da aba.
- **Sintaxe e distribuição:** JavaScripts conferidos com `node --check`; versão do manifesto igual ao pacote; biblioteca local e licença presentes; ZIP descompactado em memória e comparado byte a byte com os fontes incluídos; SHA-256 gerado. O teste `node tests/browser.cjs --package` instala uma extração do ZIP em perfil separado.

O roteiro do navegador intercepta **todas** as URLs do SIAPS e da API com respostas sintéticas. Não houve autenticação nem consulta ao SIAPS real. Downloads sintéticos são salvos em `test-results/downloads` pelo navegador de teste. Screenshots e resultado JSON ficam em `test-results/` e são ignorados pelo Git.

## O que estes testes não comprovam

- Não comprovam o contrato atual de produção para todos os indicadores. O catálogo foi preservado e os casos de dados foram construídos para testar regras, sem serem cópias de respostas reais.
- Não comprovam autorização/renovação real da sessão, políticas do Chrome institucional, compatibilidade com contas/perfis diferentes nem tempos/memória em grande volume real.
- Não medem ganho percentual de desempenho. A retirada dos 1.500 ms configurados por indicador elimina 46,5 s de espera programada para 31 indicadores concluídos por competência, mas o tempo total depende da API, do navegador e do tamanho dos arquivos.
- Cancelamento da rede é imediato via abort; a geração síncrona/interna do buffer XLSX só pode observar o cancelamento depois de devolver controle.
- Acessibilidade foi melhorada na estrutura e a tela foi inspecionada em 1000px/360px; homologação com leitor de tela e zoom de 200% continua pendente.

## Homologação institucional recomendada

1. Atualizar a extensão com o ZIP 1.1.0 em um perfil de teste autorizado.
2. Comparar com o SIAPS oficial um mês/indicador por vez: equipes, variáveis, numerador/denominador, pontuação, classificação e dados ausentes. Cobrir os 31 indicadores, especialmente C7/M2/A4.
3. Testar múltiplos meses, filtros, todos/nenhum, formatos, parcial, reabertura, duas abas, sessão expirada e download interrompido.
4. Conferir um lote de ao menos 12 arquivos em Chrome gerenciado e um arquivo unificado equivalente.
5. Medir lotes reais pequeno/médio/grande e recolher feedback de usuários leigos antes de distribuição ampla.

## Decisões de implementação

A API de downloads é usada para distinguir solicitação de conclusão; uma espera fixa entre cliques não oferece essa confirmação. ExcelJS foi incluído localmente para remover a dependência de IDs internos webpack do SIAPS. A comunicação entre extensão e motor acontece por `chrome.runtime` no contexto isolado, sem `window.postMessage` público. O único acesso ao mundo MAIN é a leitura pontual do token de sessão, sem persistência.
