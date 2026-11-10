# Histórico de versões

## 1.1.0 — 10/11/2026

- Execução independente por aba, com identificação de job/documento, término estruturado e bloqueio de operações concorrentes na mesma aba.
- Correções de recuperação do popup, seleção vazia, ordenação global por score bruto, troca de modo e associação do indicador.
- Cabeçalhos/células derivados de um esquema único; variáveis de indicadores diferentes mantêm identidade mesmo com descrições iguais.
- Resultados parciais identificados, confirmação de exportação parcial e aba de pendências no XLSX.
- Coleta com concorrência limitada a duas tarefas, cache incremental com validade/limites e remoção da espera de 1,5 s por indicador na consolidação.
- Timeout, retry seletivo, detecção de páginas repetidas, cancelamento e tentativa das pendências com reaproveitamento de sucessos.
- Biblioteca Excel local. Cache em contexto isolado, sem ponte pública de mensagens com a página e sem persistência de tokens/linhas dos relatórios.
- Downloads acompanhados pela API do Chrome até conclusão ou falha; nova permissão `downloads`.
- Tela em três passos, linguagem simplificada, prévia da planilha, seleções nativas acessíveis e layout responsivo.
- Excel com cabeçalhos fixos, filtros e CNES/INE como texto; validação de limite e nomes de abas.
- Testes de regressão e navegador, workflow de CI e empacotamento com conferência dos arquivos e SHA-256.

Validação local usa API sintética. A homologação com sessão real e conferência dos 31 indicadores contra relatórios oficiais permanece necessária antes de uso institucional amplo.
