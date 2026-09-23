// Desenvolvido por: Guilherme Paicheco Ferreira (guilherme.paicheco@betim.mg.gov.br)
const CHAVE_EXECUCAO =
  "siapsToolExecution";

let filaEventos =
  Promise.resolve();

async function obterExecucao() {
  const dados = await chrome.storage.session.get(CHAVE_EXECUCAO);
  return dados[CHAVE_EXECUCAO] || {
    emExecucao: false,
    mensagens: [],
    status: "Pronto para gerar.",
    nivel: "info"
  };
}

async function salvarExecucao(alteracoes) {
  const atualizada = { ...(await obterExecucao()), ...alteracoes };
  await chrome.storage.session.set({ [CHAVE_EXECUCAO]: atualizada });
  return atualizada;
}

async function registrarMensagem(mensagem) {
  const execucao = await obterExecucao();
  const mensagens = [...execucao.mensagens, {
    mensagem: mensagem.mensagem,
    nivel: mensagem.nivel || "info",
    horario: new Date().toISOString()
  }].slice(-200);
  const finalizada =
    /Relatório gerado com sucesso\.|Relatório concluído com erros\.|Planilha gerada com sucesso\.|Consolidação concluída\.|Erro inesperado:|access_token não encontrado|ExcelJS não encontrado|Exportação interrompida/.test(
      mensagem.mensagem
    );
  return salvarExecucao({
    mensagens,
    status: mensagem.mensagem,
    nivel: mensagem.nivel || "info",
    emExecucao: finalizada ? false : execucao.emExecucao
  });
}

async function executarNoSiaps(tabId, configuracao) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });

  await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: config => { window.__SIAPS_TOOL_CONFIG__ = config; },
    args: [configuracao]
  });
  return chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    files: ["main.js"]
  });
}

chrome.runtime.onMessage.addListener((mensagem, sender, responder) => {
  if (mensagem.type === "getExecution") {
    obterExecucao().then(responder);
    return true;
  }

  if (mensagem.type === "clearExecutionLog") {
    salvarExecucao({ mensagens: [] }).then(responder);
    return true;
  }

  if (mensagem.type === "getCatalog") {
    executarNoSiaps(mensagem.tabId, { catalogo: true })
      .then(() => chrome.scripting.executeScript({
        target: { tabId: mensagem.tabId },
        world: "MAIN",
        func: () => window.__SIAPS_TOOL_CATALOGO__
      }))
      .then(resultado => responder({ catalogo: resultado[0]?.result || null }))
      .catch(erro => responder({ erro: erro.message }));
    return true;
  }

  if (mensagem.type === "start") {
    salvarExecucao({
      emExecucao: true,
      mensagens: [...(mensagem.mensagensIniciais || []), {
        mensagem: "SIAPS-TOOL inicializado.",
        nivel: "info",
        horario: new Date().toISOString()
      }].slice(-200),
      status: "Processando relatório...",
      nivel: "info"
    })
      .then(() => executarNoSiaps(mensagem.tabId, mensagem.configuracao))
      .then(() => responder({ iniciado: true }))
      .catch(async erro => {
        await salvarExecucao({
          emExecucao: false,
          status: "Não foi possível iniciar o relatório.",
          nivel: "error"
        });
        responder({ erro: erro.message });
      });
    return true;
  }

  if (mensagem.type === "exportConsolidation") {
    salvarExecucao({
      emExecucao: true,
      status: "Gerando planilha a partir da consolidação...",
      nivel: "info"
    })
      .then(() => chrome.scripting.executeScript({
        target: { tabId: mensagem.tabId },
        world: "MAIN",
        func: async opcoes => {
          if (!window.__SIAPS_TOOL_EXPORTAR_CONSOLIDACAO__) {
            throw new Error("A consolidação não está disponível nesta aba. Gere uma nova consolidação.");
          }
          return window.__SIAPS_TOOL_EXPORTAR_CONSOLIDACAO__(opcoes);
        },
        args: [mensagem.configuracao]
      }))
      .then(() => responder({ iniciado: true }))
      .catch(async erro => {
        await salvarExecucao({ emExecucao: false, status: "Não foi possível gerar a planilha.", nivel: "error" });
        responder({ erro: erro.message });
      });
    return true;
  }

  if (mensagem.source === "SIAPS_TOOL" && sender.tab) {
    filaEventos =
      filaEventos
        .then(
          async () => {

            if (mensagem.type === "options") {
              await chrome.storage.session.set({
                siapsToolOptions:
                  mensagem.opcoes
              });
            }

            if (mensagem.type === "progress") {
              await registrarMensagem(
                mensagem
              );
            }

            if (mensagem.type === "consolidation") {
              await salvarExecucao({
                emExecucao: false,
                consolidacao:
                  mensagem.resumo,
                status:
                  "Consolidação concluída.",
                nivel:
                  "success"
              });
            }

            chrome.runtime.sendMessage(
              mensagem
            );

          }
        )
        .catch(
          erro => {
            console.error(
              "SIAPS-TOOL: falha ao persistir evento.",
              erro
            );
          }
        );
  }
});
