/* Estado pequeno por aba; relatórios e tokens nunca são persistidos em storage. */
'use strict';
importScripts('core.js', 'catalog.js');
const filas = new Map();
const chave = tabId => `siaps:tab:${tabId}`;
const vazio = tabId => ({ tabId, revisao: 0, emExecucao: false, consolidacao: null, opcoes: { unidades: [], equipes: [] }, mensagens: [], status: 'Escolha os meses e os relatórios para começar.', nivel: 'info' });
async function obter(tabId) { return (await chrome.storage.session.get(chave(tabId)))[chave(tabId)] || vazio(tabId); }
async function salvar(tabId, changes) {
  const current = await obter(tabId), next = { ...current, ...changes, revisao: current.revisao + 1 };
  await chrome.storage.session.set({ [chave(tabId)]: next });
  chrome.runtime.sendMessage({ type: 'stateChanged', tabId, estado: next }).catch(() => {});
  return next;
}
function serializar(tabId, action) {
  const previous = filas.get(tabId) || Promise.resolve();
  const next = previous.catch(() => {}).then(action);
  filas.set(tabId, next);
  next.finally(() => { if (filas.get(tabId) === next) filas.delete(tabId); }).catch(() => {});
  return next;
}
async function abaValida(tabId) {
  if (!Number.isInteger(tabId) || tabId < 0) throw new Error('Abra a ferramenta a partir da aba do SIAPS.');
  const tab = await chrome.tabs.get(tabId);
  if (new URL(tab.url || '').origin !== 'https://siaps.saude.gov.br') throw new Error('Abra a Visão por Competência em https://siaps.saude.gov.br.');
  return tab;
}
async function injetar(tabId, func, args = [], documentId) {
  return chrome.scripting.executeScript({ target: documentId ? { tabId, documentIds: [documentId] } : { tabId }, world: 'ISOLATED', func, args });
}
async function reconciliar(tabId) {
  let state = await obter(tabId);
  if (state.emExecucao || state.consolidacao) {
    const result = await injetar(tabId, () => ({ ocupado: Boolean(globalThis.__SIAPS_TOOL_ENGINE__?.ocupado()), disponivel: Boolean(globalThis.__SIAPS_TOOL_ENGINE__?.disponivel()) })).catch(() => []);
    const live = result[0]?.result;
    if ((state.emExecucao && !live?.ocupado) || (state.consolidacao && !live?.disponivel)) state = await salvar(tabId, { emExecucao: false, jobId: null, consolidacao: live?.disponivel ? state.consolidacao : null, status: 'A execução anterior foi interrompida. Consulte novamente para continuar.', nivel: 'warning' });
  }
  return state;
}
async function iniciar(tabId, operacao, opcoes) {
  await abaValida(tabId);
  const state = await reconciliar(tabId);
  if (state.emExecucao) throw new Error('Já há uma operação nesta aba. Aguarde ou clique em Parar.');
  if (operacao === 'exportar' && !state.consolidacao) throw new Error('Consulte os dados antes de baixar.');
  const jobId = crypto.randomUUID();
  const configured = await injetar(tabId, config => { globalThis.__SIAPS_TOOL_CONFIG__ = config; }, [{ jobId, operacao, opcoes }]);
  const documentId = configured[0]?.documentId;
  await salvar(tabId, { jobId, documentId, operacao, emExecucao: true, progresso: null, downloads: [], pendencias: [], ...(operacao === 'consolidar' ? { consolidacao: null } : {}), status: operacao === 'exportar' ? 'Preparando sua planilha…' : 'Consultando dados no SIAPS…', nivel: 'info', mensagens: [] });
  try {
    await chrome.scripting.executeScript({ target: { tabId, documentIds: [documentId] }, world: 'ISOLATED', files: ['vendor/exceljs.min.js', 'core.js', 'catalog.js', 'excel.js', 'main.js'] });
  } catch (error) {
    await salvar(tabId, { emExecucao: false, jobId: null, status: 'Não foi possível abrir o processamento nesta aba. Reabra o SIAPS e tente novamente.', nivel: 'error' });
    throw error;
  }
  return { estado: await obter(tabId) };
}
async function validarMotor(message, sender) {
  if (!sender.tab || sender.frameId !== 0 || new URL(sender.url || '').origin !== 'https://siaps.saude.gov.br') throw new Error('Origem de execução inválida.');
  const state = await obter(sender.tab.id);
  if (!state.emExecucao || state.jobId !== message.jobId || (state.documentId && state.documentId !== sender.documentId)) throw new Error('Esta execução não está mais ativa.');
  return state;
}
async function evento(message, sender) {
  await validarMotor(message, sender);
  const tabId = sender.tab.id, state = await obter(tabId);
  const log = String(message.mensagem || message.status || '').slice(0, 600);
  const mensagens = [...state.mensagens, ...(log ? [{ mensagem: log, horario: new Date().toISOString(), nivel: message.nivel || 'info' }] : [])].slice(-80);
  if (message.evento === 'progress') {
    const p = message.progresso;
    return salvar(tabId, { mensagens, status: log, progresso: p && Number.isFinite(p.atual) && p.total > 0 ? { atual: p.atual, total: p.total } : state.progresso });
  }
  if (message.evento !== 'finished') throw new Error('Evento não reconhecido.');
  const changes = { emExecucao: false, mensagens, status: log, nivel: ['info', 'success', 'warning', 'error'].includes(message.nivel) ? message.nivel : 'info' };
  if (Object.hasOwn(message, 'consolidacao')) changes.consolidacao = message.consolidacao;
  if (message.invalidar) changes.consolidacao = null;
  if (message.opcoes) changes.opcoes = message.opcoes;
  if (message.pendencias) changes.pendencias = message.pendencias;
  const seconds = Number(message.segundos);
  if (Number.isFinite(seconds) && seconds > 0 && message.nivel === 'success') {
    const key = 'siaps:performance', data = (await chrome.storage.local.get(key))[key] || {};
    const category = state.operacao, old = data[category] || { media: 0, amostras: 0 };
    const n = Math.min(old.amostras, 9);
    data[category] = { media: (old.media * n + seconds) / (n + 1), amostras: n + 1 };
    await chrome.storage.local.set({ [key]: data });
  }
  return salvar(tabId, changes);
}
async function atender(message, sender) {
  if (!message || typeof message.type !== 'string') throw new Error('Mensagem inválida.');
  if (['engineEvent', 'getAccessToken', 'download', 'downloadStatus'].includes(message.type)) {
    const state = await validarMotor(message, sender), tabId = sender.tab.id;
    if (message.type === 'engineEvent') return serializar(tabId, () => evento(message, sender));
    if (message.type === 'getAccessToken') {
      const result = await chrome.scripting.executeScript({ target: { tabId, documentIds: [sender.documentId] }, world: 'MAIN', func: () => sessionStorage.getItem('access_token') });
      return { token: result[0]?.result || null };
    }
    if (message.type === 'download') {
      if (state.operacao !== 'exportar' || typeof message.url !== 'string' || !message.url.startsWith('blob:https://siaps.saude.gov.br/') || !/^SIAPS_[a-zA-Z0-9_-]+\.xlsx$/.test(message.filename)) throw new Error('Arquivo de exportação inválido.');
      const downloadId = await chrome.downloads.download({ url: message.url, filename: message.filename, conflictAction: 'uniquify', saveAs: false });
      await serializar(tabId, async () => {
        const active = await obter(tabId);
        if (active.jobId !== message.jobId || !active.emExecucao) { await chrome.downloads.cancel(downloadId).catch(() => {}); throw new Error('Execução interrompida.'); }
        await salvar(tabId, { downloads: [...active.downloads, downloadId] });
      });
      return { downloadId };
    }
    if (!state.downloads?.includes(message.downloadId)) throw new Error('Download não pertence a esta execução.');
    const [download] = await chrome.downloads.search({ id: message.downloadId });
    return { state: download?.state || 'interrupted' };
  }
  const origem = sender.url ? new URL(sender.url) : null;
  if (sender.id !== chrome.runtime.id || origem?.protocol !== 'chrome-extension:' || origem.host !== chrome.runtime.id || origem.pathname !== '/popup.html') throw new Error('Comando disponível apenas na interface da extensão.');
  const tabId = message.tabId;
  if (message.type === 'getCatalog') return { catalogo: SiapsCatalog.map(i => ({ ...i, codigoExibicao: SiapsCore.codigo(i) })) };
  await abaValida(tabId);
  if (message.type === 'getExecution') return serializar(tabId, async () => ({ estado: await reconciliar(tabId) }));
  if (message.type === 'start' || message.type === 'exportConsolidation') return serializar(tabId, () => iniciar(tabId, message.type === 'start' ? 'consolidar' : 'exportar', message.configuracao || {}));
  if (message.type === 'previewExport') {
    const state = await obter(tabId);
    if (state.emExecucao) throw new Error('Aguarde a consulta terminar.');
    const result = await injetar(tabId, options => {
      if (!globalThis.__SIAPS_TOOL_ENGINE__) throw new Error('Consulte os dados novamente.');
      return globalThis.__SIAPS_TOOL_ENGINE__.preview(options);
    }, [message.configuracao]);
    return result[0]?.result;
  }
  if (message.type === 'cancel') {
    const state = await obter(tabId);
    await injetar(tabId, () => globalThis.__SIAPS_TOOL_ENGINE__?.cancelar());
    await Promise.all((state.downloads || []).map(id => chrome.downloads.cancel(id).catch(() => {})));
    return { ok: true };
  }
  if (message.type === 'clearExecutionLog') return serializar(tabId, async () => ({ estado: await salvar(tabId, { mensagens: [] }) }));
  if (message.type === 'openDashboard') {
    const key = `siaps:window:${tabId}`, id = (await chrome.storage.session.get(key))[key];
    if (id) { try { await chrome.windows.update(id, { focused: true }); return { ok: true }; } catch { /* Janela fechada. */ } }
    const window = await chrome.windows.create({ url: `${chrome.runtime.getURL('popup.html')}?tabId=${tabId}`, type: 'popup', width: 1000, height: 850 });
    await chrome.storage.session.set({ [key]: window.id }); return { ok: true };
  }
  throw new Error('Comando não reconhecido.');
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type === 'stateChanged') return false;
  atender(message, sender).then(respond).catch(error => respond({ erro: error.message }));
  return true;
});
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status !== 'loading') return;
  serializar(tabId, async () => {
    const state = await obter(tabId);
    if (state.emExecucao || state.consolidacao) await salvar(tabId, { emExecucao: false, jobId: null, consolidacao: null, opcoes: vazio(tabId).opcoes, status: 'A aba do SIAPS foi recarregada. Consulte os dados novamente.', nivel: 'warning' });
  }).catch(console.error);
});
chrome.tabs.onRemoved.addListener(tabId => {
  serializar(tabId, () => chrome.storage.session.remove([chave(tabId), `siaps:window:${tabId}`])).catch(console.error);
});
