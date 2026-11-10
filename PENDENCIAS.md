# Próximas validações e evoluções

## Antes de distribuir amplamente

- [ ] Homologar em sessão institucional real, comparando contagem, variáveis, numerador/denominador, score e classificação com o SIAPS para cada um dos 31 indicadores, incluindo C7, M2 e A4. Fixtures atuais são sintéticas.
- [ ] Confirmar com o ambiente real os contratos de tipos, metadata e paginação. Não usar o campo `total` como prova de quantidade de equipes sem confirmar sua semântica.
- [ ] Validar com profissionais da DAPS o vocabulário, a seleção do mês e a emissão sem ajuda técnica.
- [ ] Testar sessão real expirada/renovada, permissões institucionais e destino de download em Chrome gerenciado.
- [ ] Testar leitor de tela e zoom de 200% com usuários/ambiente de acessibilidade.

## Melhorias futuras com medição

- [ ] Medir lotes pequeno/médio/grande reais: rede, quantidade de chamadas, tempo XLSX e pico de memória. Não há benchmark real de ganho percentual nesta versão.
- [ ] Estimativas de duração por fase, indicador e quantidade de linhas; nesta versão o histórico de duração total é registrado, mas não há promessa de ETA na interface.
- [ ] Avaliar worker para serialização XLSX e divisão automática de lotes grandes; cancelamento durante `writeBuffer` só é observado quando essa serialização termina.
- [ ] Avaliar ZIP único para múltiplos arquivos. Hoje há XLSX único opcional e fila de downloads confirmados.
- [ ] Retomar só arquivos que faltaram em uma exportação interrompida. Hoje a coleta é retomada por cache, mas repetir exportação pode baixar novamente os arquivos anteriores.
- [ ] Favoritos de relatórios e seleção de intervalo contínuo de meses, após validar a demanda.
- [ ] Distribuição institucional gerenciada e atualização simplificada conforme as políticas locais.
- [ ] Renovação oficial da autenticação somente se houver mecanismo autorizado/documentado. Não simular atividade para contornar expiração.

As melhorias descritas no changelog foram implementadas. Os itens acima são validações ou evoluções que dependem de acesso institucional, evidência de desempenho ou decisões de produto.
