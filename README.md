# SIAPS Tool

Extensão Chrome para gerar relatórios da Visão por Competência do SIAPS para a DAPS Betim/MG.

## Instalação para desenvolvimento

1. Abra `chrome://extensions` no Chrome.
2. Ative o **Modo do desenvolvedor**.
3. Selecione **Carregar sem compactação** e escolha esta pasta.
4. Abra a tela **Visão por Competência** em uma sessão autenticada do SIAPS.
5. Abra o popup da extensão e gere o relatório.

O motor continua em `main.js` e é executado no contexto principal da página SIAPS. Isso preserva o acesso ao `access_token` da sessão e ao ExcelJS já carregado pelo sistema.

## Primeira interface

- Uma competência por execução (a competência configurada no motor).
- Todos ou indicadores específicos, a partir da mesma lista de 31 indicadores do motor.
- Inclusão opcional de metadados institucionais.
- Unidades e equipes reutilizadas da coleta já realizada pelo motor e disponíveis para filtrar execuções posteriores.
- Ordenação fixa por pontuação, do maior para o menor.


---

# Pendências:

## Urgente:
- Ampliar amplitude das comptências;

## Futuras:
1. Instalação facilitada;
2. Status em forma de "barra de conclusão";
3. Tentar melhorar o desempenho;
4. Melhorar a UI/UX;

## A Pensar:
- Banco de Dados em Mock para auxiliar no desempenho e manter segurança?
