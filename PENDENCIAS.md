# PENDÊNCIAS SIAPS TOOL ↓

Devo lembrar de fazer em casa ou nos períodos mais tranquilos!

## Andamento

- [x] Exportação em lote: downloads sequenciais com progresso por arquivo e intervalo controlado.
- [ ] Cache seguro de consolidações por aba SIAPS.
- [ ] Estimativas de tempo de consolidação e exportação.
- [ ] Melhoria de UI/UX e abertura em janela redimensionável.
- [ ] Unificação opcional de arquivos/abas por competência, equipe, indicador ou unidade.
- [ ] Monitoramento seguro de sessão/autenticação.

## Features:

- **Planilhas devem podem (de forma opcional) ser Unificadas em:**
  - Competência;
  - Equipe;
  - Indicador;
  - Uni
    <br>
    Pode ser unificada em:
  - 1 guia com todas as informações em sequência;
    Por exemplo: coluna de indicador: "eSB1 - 1ª Consulta Odontológica", "eSB1 - 1ª Consulta Odontológica", (todas as equipes)..., "eSB2 - Tratamento Odontológico Concluído", "eSB2 - Tratamento Odontológico Concluído", (todas as equipes)..., até a última equipe "eSB6 - Tratamento Restaurador Atraumático".
  - várias guias com os nomes da fonte que quiser unificar (unidades, equipes, indicadores, competência, ...);
    Por exemplo: guias (por indicador) -> "eSB1, eSB2, eSB3, eSB4, eSB5, eSB6".
- Entregar uma **previsão de tempo** para a consolidação e download de cada relatório. Pode ser com base na taxa de cada relatório;

## Correção (problema com hipótese e possível solução):

**Problema:** Ao realizar o download/consolidação em grandes volumes (mesmo 10 ou mais) de download, parece que algumas das últimas planilhas não baixam. <br>
**Hipótese:** Não sei. Acredito que o problema aconteça realmente na hora do download. Visto que a consolidação acontece e foi percebido que todas as planilhas baixam de "imediato".<br>
**Solução:** Talvez se reduzir o tempo no download de cada uma se esse for realmente o erro?<br>

**Problema:** Ao realizar a consolidação da planilha de tal mês. Depois a consolidação de outra planilha sucessitivamente. Caso queiramos consolidar novamente a planilha anterior, devemos aguardar novamente todo aquele tempo que já aguardamos novamente.<br>
**Hipótese:** Podemos realizar salvar a consolidação **de forma segura e sem alteração** na planilha.<br>
**Solução:** Salvar em mock, localstorage ou o que for para que não haja tanta perca de tempo.<br>

**Problema:** Após certo tempo realizando a cconsolidação, caso não haja interação no site ele perde a autenticação. <br>
**Hipótese:** Podemos simular interação ou enviar a mesma mensagem que uma interação envia?<br>
**Solução:** Manter login ativo.<br>

**Problema:** Possuímos alguns problemas com a UI/UX do pop-up. Como por exemplo, caixas de seleção difíceis de marcar, pop-up muito pequeno.<br>
**Hipótese:** Melhorar Ui/UX. <br>
**Solução:** Permitir a reposição do pop-up. Permitir alteração no tamanho da janela do pop-up. <br>

**Problema:** Ao sair e voltar da página (sem fechar), as seleções tentam se manter mas bugam. <br>
**Hipótese:** A memória da aba do pop-up é falha.<br>
**Solução:** Melhorar a memória de permanência em segundo plano. Ou lembra da última coisa que foi feita, ou reseta as opções mas matêm funcionando normalmente.<br>

## Melhorias:

### Requisitos Não Funcionais

- Desempenho: 
  - Consolidação em paralelo para otimizar o tempo (se possível e se não alterar resultados);
  - Permitir consolidação e download em segundo plano;
  - Taxa de Download reduzida para evitar erros;
