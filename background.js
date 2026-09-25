// Desenvolvido por: Guilherme Paicheco Ferreira (guilherme.paicheco@betim.mg.gov.br)
const CHAVE_EXECUCAO =
  "siapsToolExecution";

const CHAVE_MULTI_CONSOLIDACAO =
  "siapsToolMultiConsolidacao";

const CHAVE_DESEMPENHO =
  "siapsToolPerformance";

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

async function obterDesempenho() {
  const dados = await chrome.storage.local.get(CHAVE_DESEMPENHO);
  return dados[CHAVE_DESEMPENHO] || {
    consolidacao: { media: 0, amostras: 0, porIndicador: {} },
    exportacao: { media: 0, amostras: 0, porIndicador: {} }
  };
}

function atualizarMedia(atual = {}, segundos) {
  const amostrasAnteriores = Math.min(atual.amostras || 0, 19);
  return {
    media: ((atual.media || 0) * amostrasAnteriores + segundos) /
      (amostrasAnteriores + 1),
    amostras: amostrasAnteriores + 1
  };
}

async function registrarMetrica(metrica) {
  const segundos = Number(metrica?.segundos);
  if (
    !["consolidacao", "exportacao"].includes(metrica?.tipo) ||
    !Number.isFinite(segundos) ||
    segundos <= 0
  ) return;

  const desempenho = await obterDesempenho();
  const categoria = desempenho[metrica.tipo];
  categoria.porIndicador ||= {};
  categoria.porIndicador[metrica.indicador] = atualizarMedia(
    categoria.porIndicador[metrica.indicador],
    segundos
  );
  const media = atualizarMedia(categoria, segundos);
  categoria.media = media.media;
  categoria.amostras = media.amostras;
  await chrome.storage.local.set({ [CHAVE_DESEMPENHO]: desempenho });
}

async function registrarMensagem(mensagem) {
  const execucao = await obterExecucao();
  const mensagens = [...execucao.mensagens, {
    mensagem: mensagem.mensagem,
    nivel: mensagem.nivel || "info",
    horario: new Date().toISOString()
  }].slice(-200);
  const finalizada =
    /Planilha gerada com sucesso\.|Erro inesperado:|access_token não encontrado|ExcelJS não encontrado|Exportação interrompida/.test(
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

async function consolidacaoDisponivelNaAba(tabId) {
  const resultado = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: () => Boolean(
      window.__SIAPS_TOOL_CONSOLIDACAO__ &&
      window.__SIAPS_TOOL_EXPORTAR_CONSOLIDACAO__
    )
  });
  return Boolean(resultado[0]?.result);
}

chrome.runtime.onMessage.addListener((mensagem, sender, responder) => {
  if (mensagem.type === "getExecution") {
    obterExecucao().then(responder);
    return true;
  }

  if (mensagem.type === "getPerformance") {
    obterDesempenho().then(responder);
    return true;
  }

  if (mensagem.type === "openDashboard") {
    chrome.windows.create({
      url: `${chrome.runtime.getURL("popup.html")}?tabId=${mensagem.tabId}`,
      type: "popup",
      width: 860,
      height: 900
    })
      .then(janela => responder({ criada: true, windowId: janela.id }))
      .catch(erro => responder({ erro: erro.message }));
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

  if (mensagem.type === "getPageConsolidation") {
    consolidacaoDisponivelNaAba(mensagem.tabId)
      .then(disponivel => responder({ disponivel }))
      .catch(erro => responder({ erro: erro.message }));
    return true;
  }

  if (mensagem.type === "start") {
    salvarExecucao({
      emExecucao: true,
      consolidacao: null,
      mensagens: [...(mensagem.mensagensIniciais || []), {
        mensagem: "SIAPS-TOOL inicializado.",
        nivel: "info",
        horario: new Date().toISOString()
      }].slice(-200),
      status: "Processando relatório...",
      nivel: "info"
    })
      .then(async () => {
        const cache = await chrome.scripting.executeScript({
          target: { tabId: mensagem.tabId },
          world: "MAIN",
          func: chave => {
            const item = window.__SIAPS_TOOL_CACHE_CONSOLIDACOES__?.[chave];
            if (!item) return null;
            window.__SIAPS_TOOL_CONSOLIDACAO__ = item.consolidacao;
            return { resumo: item.resumo, opcoes: item.opcoes };
          },
          args: [mensagem.configuracao.chaveConsolidacao]
        });
        const cacheEmMemoria = cache[0]?.result;
        const resumoEmCache = cacheEmMemoria?.resumo;
        if (resumoEmCache) {
          await chrome.storage.session.set({
            siapsToolOptions: cacheEmMemoria.opcoes || { unidades: [], equipes: [] }
          });
          await salvarExecucao({
            emExecucao: false,
            consolidacao: {
              ...resumoEmCache,
              tabId: mensagem.tabId,
              pageUrl: mensagem.pageUrl || null
            },
            status: "Consolidação recuperada da memória desta aba SIAPS.",
            nivel: "success"
          });
          return { restaurada: true };
        }

        const competencias = [...new Set(
          mensagem.configuracao.competencias?.length
            ? mensagem.configuracao.competencias
            : [mensagem.configuracao.competencia]
        )];
        const [primeira, ...restantes] = competencias;
        const configuracao = {
          ...mensagem.configuracao,
          competencia: primeira,
          competenciaAtual: 1,
          competenciasTotal: competencias.length
        };
        await chrome.storage.session.set({
          [CHAVE_MULTI_CONSOLIDACAO]: {
            tabId: mensagem.tabId,
            pageUrl: mensagem.pageUrl || null,
            configuracao,
            restantes,
            total: competencias.length
          }
        });
        await salvarExecucao({
          competenciaAtual: 1,
          competenciasTotal: competencias.length
        });
        await chrome.scripting.executeScript({
          target: { tabId: mensagem.tabId },
          world: "MAIN",
          func: () => {
            window.__SIAPS_TOOL_CONSOLIDACAO__ = null;
            window.__SIAPS_TOOL_OPCOES__ = null;
          }
        });
        return executarNoSiaps(mensagem.tabId, configuracao);
      })
      .then(resultado => responder({
        iniciado: true,
        restaurada: Boolean(resultado?.restaurada)
      }))
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

  if (mensagem.type === "previewExport") {
    chrome.scripting.executeScript({
      target: { tabId: mensagem.tabId },
      world: "MAIN",
      func: opcoes => {
        if (!window.__SIAPS_TOOL_PREVER_EXPORTACAO__) {
          throw new Error("A consolidação não está disponível nesta aba. Gere uma nova consolidação.");
        }
        return window.__SIAPS_TOOL_PREVER_EXPORTACAO__(opcoes);
      },
      args: [mensagem.configuracao]
    })
      .then(resultado => responder(resultado[0]?.result || { arquivos: 0, registros: 0 }))
      .catch(erro => responder({ erro: erro.message }));
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

            if (mensagem.type === "metric") {
              await registrarMetrica(mensagem.metrica);
            }

            if (mensagem.type === "consolidation") {
              const dadosMulti = await chrome.storage.session.get(
                CHAVE_MULTI_CONSOLIDACAO
              );
              const multi = dadosMulti[
                CHAVE_MULTI_CONSOLIDACAO
              ];

              if (
                multi?.tabId === sender.tab.id &&
                multi.restantes.length
              ) {
                try {
                const [proxima, ...restantes] =
                  multi.restantes;
                const configuracao = {
                  ...multi.configuracao,
                  competencia: proxima,
                  competenciaAtual: multi.total - restantes.length,
                  competenciasTotal: multi.total
                };
                await chrome.storage.session.set({
                  [CHAVE_MULTI_CONSOLIDACAO]: {
                    ...multi,
                    restantes,
                    configuracao
                  }
                });
                await salvarExecucao({
                  emExecucao: true,
                  competenciaAtual: multi.total - restantes.length,
                  competenciasTotal: multi.total,
                  status: `Consolidando competência ${multi.total - restantes.length} de ${multi.total}...`,
                  nivel: "info"
                });
                await executarNoSiaps(
                  sender.tab.id,
                  configuracao
                );
                chrome.runtime.sendMessage({
                  source: "SIAPS_TOOL",
                  type: "progress",
                  mensagem: `Consolidando competência ${multi.total - restantes.length} de ${multi.total}...`,
                  nivel: "info"
                });
                } catch (erro) {
                  await chrome.storage.session.remove(CHAVE_MULTI_CONSOLIDACAO);
                  await salvarExecucao({
                    emExecucao: false,
                    consolidacao: null,
                    status: "Não foi possível iniciar a próxima competência. Gere uma nova consolidação.",
                    nivel: "error"
                  });
                  chrome.runtime.sendMessage({
                    source: "SIAPS_TOOL",
                    type: "progress",
                    mensagem: "Não foi possível continuar a consolidação. Gere uma nova consolidação.",
                    nivel: "error"
                  });
                }
                return;
              }

              if (multi?.tabId === sender.tab.id) {
                await chrome.storage.session.remove(
                  CHAVE_MULTI_CONSOLIDACAO
                );
              }

              await salvarExecucao({
                emExecucao: false,
                consolidacao: {
                  ...mensagem.resumo,
                  tabId: sender.tab.id,
                  pageUrl: sender.tab.url
                },
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

async function invalidarEstadoDaAba(tabId) {
  const execucao = await obterExecucao();
  const dadosMulti = await chrome.storage.session.get(CHAVE_MULTI_CONSOLIDACAO);
  const multi = dadosMulti[CHAVE_MULTI_CONSOLIDACAO];

  if (multi?.tabId === tabId) {
    await chrome.storage.session.remove(CHAVE_MULTI_CONSOLIDACAO);
  }

  if (execucao.consolidacao?.tabId === tabId || multi?.tabId === tabId) {
    await salvarExecucao({
      emExecucao: false,
      consolidacao: null,
      status: "A aba do SIAPS foi recarregada ou fechada. Gere uma nova consolidação.",
      nivel: "warning"
    });
    chrome.runtime.sendMessage({
      source: "SIAPS_TOOL",
      type: "progress",
      mensagem: "A consolidação foi invalidada porque a aba do SIAPS mudou.",
      nivel: "warning"
    });
  }
}

chrome.tabs.onUpdated.addListener((tabId, alteracao) => {
  if (alteracao.status === "loading" || alteracao.url) {
    invalidarEstadoDaAba(tabId).catch(erro =>
      console.error("SIAPS-TOOL: falha ao invalidar a aba.", erro)
    );
  }
});

chrome.tabs.onRemoved.addListener(tabId => {
  invalidarEstadoDaAba(tabId).catch(erro =>
    console.error("SIAPS-TOOL: falha ao limpar a aba fechada.", erro)
  );
});
