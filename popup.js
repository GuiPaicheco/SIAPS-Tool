'use strict';
const C = SiapsCore;
const $ = id => document.getElementById(id);
const state = { tabId: null, catalogo: [], competencias: [], controllers: {}, execucao: null, previa: null, pronta: false, previewSeq: 0, exportacaoPendente: null, dadosKey: null };
const api = async message => {
  const result = await chrome.runtime.sendMessage({ tabId: state.tabId, ...message });
  if (result?.erro) throw new Error(result.erro);
  return result;
};
function element(tag, text, className) {
  const el = document.createElement(tag); if (text != null) el.textContent = text; if (className) el.className = className; return el;
}
class MultiSelect {
  constructor(container, nome, onChange, grupos = []) {
    this.nome = nome; this.onChange = onChange; this.items = []; this.visiveis = []; this.selection = C.selecao();
    this.details = element('details'); this.summary = element('summary'); this.panel = element('div', null, 'panel');
    this.search = element('input', null, 'search'); this.search.type = 'search'; this.search.placeholder = `Buscar ${nome.toLowerCase()}…`; this.search.setAttribute('aria-label', `Buscar ${nome.toLowerCase()}`);
    this.actions = element('div', null, 'actions'); this.options = element('div', null, 'options');
    this.options.setAttribute('role', 'group'); this.options.setAttribute('aria-label', nome);
    for (const [text, action] of [['Todos', () => { this.selection = C.selecao(); this.changed(); }], ['Nenhum', () => { this.selection = { modo: 'selecionados', valores: [] }; this.changed(); }], ['Selecionar resultados da busca', () => { this.selection = { modo: 'selecionados', valores: [...new Set(this.filtered().map(i => i.valor))] }; this.changed(); }]]) this.button(text, action);
    for (const grupo of grupos) this.button(`Somente ${grupo.rotulo}`, () => { this.selection = { modo: 'selecionados', valores: this.items.filter(i => i.grupo === grupo.valor).map(i => i.valor) }; this.changed(); });
    this.panel.append(this.search, this.actions, this.options); this.details.append(this.summary, this.panel); container.append(this.details);
    this.search.addEventListener('input', () => this.renderOptions());
  }
  button(text, action) { const button = element('button', text, 'secondary'); button.type = 'button'; button.addEventListener('click', action); this.actions.append(button); }
  filtered() { const busca = this.search.value.toLocaleLowerCase('pt-BR'); return this.visiveis.filter(i => `${i.rotulo} ${i.valor} ${i.tipo || ''}`.toLocaleLowerCase('pt-BR').includes(busca)); }
  setItems(items, selection) {
    this.items = items; this.visiveis = items;
    if (selection !== undefined) this.selection = C.selecao(selection);
    if (this.selection.modo !== 'todos') { const valid = new Set(items.map(i => i.valor)); this.selection.valores = this.selection.valores.filter(v => valid.has(v)); }
    this.render();
  }
  setVisibleItems(items) { this.visiveis = items; this.render(); }
  getValues() { return { modo: this.selection.modo, valores: [...this.selection.valores] }; }
  getSelectedCount() { return new Set(this.visiveis.filter(i => C.aceita(this.selection, i.valor)).map(i => i.valor)).size; }
  changed() { this.render(); this.onChange(); }
  summaryText() { this.summary.textContent = `${this.nome}: ${this.getSelectedCount()} de ${new Set(this.visiveis.map(i => i.valor)).size} selecionados`; }
  render() { this.summaryText(); this.renderOptions(); }
  renderOptions() {
    const items = this.filtered(); this.options.replaceChildren();
    if (!items.length) this.options.append(element('p', 'Nenhum resultado nesta seleção.', 'help'));
    for (const item of items) {
      const label = element('label', null, 'option'), checkbox = element('input'); checkbox.type = 'checkbox'; checkbox.value = item.valor; checkbox.checked = C.aceita(this.selection, item.valor);
      const text = element('span', item.rotulo); if (item.detalhe) text.append(element('small', item.detalhe));
      checkbox.addEventListener('change', () => {
        const chosen = this.selection.modo === 'todos' ? new Set(this.visiveis.map(i => i.valor)) : new Set(this.selection.valores);
        checkbox.checked ? chosen.add(item.valor) : chosen.delete(item.valor);
        this.selection = { modo: 'selecionados', valores: [...chosen] }; this.summaryText(); this.onChange();
        // Preserva o foco e sincroniza entradas duplicadas de uma equipe transferida.
        for (const box of this.options.querySelectorAll('input')) box.checked = C.aceita(this.selection, box.value);
      });
      label.append(checkbox, text); this.options.append(label);
    }
  }
}
function status(message, nivel = 'info') {
  $('statusCard').className = `status-card ${nivel}`;
  $('statusTitle').textContent = { success: 'Etapa concluída', warning: 'Confira antes de continuar', error: 'Precisamos da sua atenção', info: state.execucao?.emExecucao ? 'Preparando seu relatório' : 'Vamos preparar seu relatório' }[nivel] || 'Relatórios SIAPS';
  $('statusMessage').textContent = message;
}
function renderSessao(session) {
  if (!session) return;
  const labels = { nao_verificada: 'Verificação necessária', encontrada: 'Sessão encontrada', renovada: 'Sessão renovada', conectada: 'Conexão confirmada', ausente: 'Entre no SIAPS', login_necessario: 'Novo acesso necessário', sem_permissao: 'Perfil sem autorização', servico_indisponivel: 'Verificação indisponível', erro_leitura: 'Falha na verificação', resposta_invalida: 'Resposta inesperada' };
  const success = ['conectada', 'renovada'].includes(session.estado), warning = !success && !['encontrada', 'nao_verificada'].includes(session.estado);
  $('sessionCard').className = `session-card ${success ? 'success' : warning ? 'warning' : ''}`;
  $('sessionBadge').textContent = labels[session.estado] || 'Verificação necessária';
  $('sessionMessage').textContent = session.mensagem;
  $('sessionHelp').hidden = !warning;
  $('sessionHelp').textContent = ['ausente', 'login_necessario'].includes(session.estado)
    ? 'Recarregar a página nem sempre cria uma sessão nova. Volte ao SIAPS e use o acesso oficial. Depois clique em “Verificar conexão” e repita a consulta.'
    : session.estado === 'sem_permissao' ? 'Confira se o seu perfil permite consultar esses indicadores para Betim. A ferramenta não altera permissões.'
    : 'Tente “Verificar conexão”. Se o SIAPS funciona normalmente e este aviso continua, copie o diagnóstico nos detalhes técnicos.';
}
function configuracao() {
  return { competencias: [...state.competencias], indicadores: state.controllers.indicadores.getValues(), unidades: state.controllers.unidades.getValues(), equipes: state.controllers.equipes.getValues(), modoDados: $('modoDados').value, incluirMetadados: $('metadados').checked, aceitarParcial: $('aceitarParcial').checked, unificacao: { modo: $('modoUnificacao').value, agruparPor: $('agruparUnificacao').value }, ordenacao: { campo: $('ordenarCampo').value, direcao: $('ordenarDirecao').value } };
}
function salvar() {
  if (!state.pronta) return;
  const config = configuracao();
  void chrome.storage.session.set({ [`siaps:config:${state.tabId}`]: config });
  void chrome.storage.local.set({ 'siaps:preferences': config });
}
function selecaoCompativel(resumo) {
  if (!resumo) return false;
  const chosen = state.catalogo.filter(i => C.aceita(state.controllers.indicadores.getValues(), i.codigo)).map(i => i.codigo);
  return resumo.competencias.length === state.competencias.length && state.competencias.every(p => resumo.competencias.includes(p)) && chosen.length === resumo.indicadoresCodigos.length && chosen.every(i => resumo.indicadoresCodigos.includes(i));
}
function meses() {
  $('competenciasSelecionadas').replaceChildren(...state.competencias.map(value => {
    const chip = element('span', C.formatarCompetencia(value), 'chip'), button = element('button', '×'); button.type = 'button'; button.setAttribute('aria-label', `Remover mês ${C.formatarCompetencia(value)}`);
    button.addEventListener('click', () => { state.competencias = state.competencias.filter(v => v !== value); meses(); mudouConsulta(); }); chip.append(button); return chip;
  }));
  resumoConsulta();
}
function resumoConsulta() {
  if (!state.controllers.indicadores) return;
  const indicators = state.controllers.indicadores.getSelectedCount(), months = state.competencias.length;
  $('querySummary').textContent = `${months} mês(es) · ${indicators} indicador(es) · ${months * indicators} consulta(s)`;
}
function mudouConsulta() {
  state.exportacaoPendente = null; $('downloadConfirmation').hidden = true; state.previa = null; resumoConsulta(); salvar();
  renderResultado();
}
function atualizarEquipes() {
  const selected = state.controllers.unidades.getValues();
  state.controllers.equipes.setVisibleItems(state.controllers.equipes.items.filter(i => C.aceita(selected, i.unidade)));
}
let previewTimer;
function solicitarPrevia() {
  clearTimeout(previewTimer); const seq = ++state.previewSeq;
  state.previa = null; state.exportacaoPendente = null; $('downloadConfirmation').hidden = true; $('baixar').disabled = true;
  if (!state.pronta || state.execucao?.emExecucao || !selecaoCompativel(state.execucao?.consolidacao)) return;
  $('selectionCount').textContent = 'Conferindo os filtros…';
  previewTimer = setTimeout(async () => {
    try {
      const result = await api({ type: 'previewExport', configuracao: configuracao() });
      if (seq !== state.previewSeq) return;
      state.previa = result;
      $('selectionCount').textContent = `${result.registros} registro(s) · ${result.arquivos} arquivo(s) · ${result.guias} aba(s) de dados. Cada registro representa uma equipe em um indicador e mês.`;
      const sample = result.amostra; $('previewTable').replaceChildren();
      if (sample) {
        const table = element('table'), thead = element('thead'), tr = element('tr');
        for (const col of sample.colunas) { const th = element('th', col); th.scope = 'col'; tr.append(th); }
        thead.append(tr); const tbody = element('tbody');
        for (const values of sample.linhas) { const row = element('tr'); for (const value of values) row.append(element('td', value == null ? '—' : String(value))); tbody.append(row); }
        table.append(thead, tbody); $('previewTable').append(table);
      } else $('previewTable').textContent = 'Nenhum registro corresponde aos filtros. Selecione unidades e equipes.';
      atualizarDownload();
    } catch (error) { if (seq === state.previewSeq) { $('selectionCount').textContent = error.message; $('baixar').disabled = true; } }
  }, 180);
}
function atualizarDownload() {
  $('baixar').disabled = Boolean(state.execucao?.emExecucao) || !state.previa?.arquivos || (state.execucao?.consolidacao?.parcial && !$('aceitarParcial').checked);
}
function renderResultado() {
  if (!state.pronta) return;
  const execution = state.execucao || {}, resumo = execution.consolidacao;
  const compativel = selecaoCompativel(resumo);
  $('resultSection').hidden = !compativel;
  $('atualizar').hidden = !execution.operacao;
  if (!compativel) { state.previa = null; $('baixar').disabled = true; }
  const failures = execution.pendencias?.length ? execution.pendencias : (resumo?.falhas || []);
  $('failuresSection').hidden = !failures.length;
  const groups = new Map();
  for (const f of failures) { if (!groups.has(f.erro)) groups.set(f.erro, []); groups.get(f.erro).push(`${f.codigo} (${C.formatarCompetencia(f.competencia)})`); }
  $('failures').replaceChildren(...[...groups].map(([erro, items]) => element('li', `${erro} — ${items.length} consulta(s): ${items.slice(0, 6).join(', ')}${items.length > 6 ? ` e mais ${items.length - 6}.` : '.'}`)));
  $('tentarNovamente').disabled = Boolean(execution.emExecucao);
  if (!compativel) return;
  const time = new Date(resumo.consultadoEm).toLocaleString('pt-BR');
  $('consolidationSummary').textContent = `${resumo.parcial ? 'Resultado parcial' : 'Consulta completa'} · ${resumo.concluidos} de ${resumo.solicitados} consultas · ${resumo.equipes} equipe(s) · ${resumo.registros} registro(s). Consulta mais antiga: ${time}. ${resumo.reutilizados || 0} consulta(s) reaproveitada(s).${resumo.semDados?.length ? ` ${resumo.semDados.length} consulta(s) sem registros.` : ''}`;
  $('partialRow').hidden = !resumo.parcial;
  const dataKey = JSON.stringify([resumo.consultadoEm, resumo.competencias, resumo.indicadoresCodigos, resumo.registros, resumo.falhas]);
  if (state.dadosKey !== dataKey) {
    state.dadosKey = dataKey;
    const config = state.configInicial || {};
    const opts = execution.opcoes || { unidades: [], equipes: [] };
    state.controllers.unidades.setItems(opts.unidades.map(i => ({ ...i, detalhe: `CNES ${i.valor}` })), config.unidades ?? state.controllers.unidades.getValues());
    state.controllers.equipes.setItems(opts.equipes.map(i => ({ ...i, detalhe: `INE ${i.valor} · ${i.tipo} · CNES ${i.unidade}` })), config.equipes ?? state.controllers.equipes.getValues());
    state.configInicial = null; atualizarEquipes();
    const campo = $('ordenarCampo').value;
    $('ordenarCampo').replaceChildren(...resumo.camposOrdenacao.map(col => { const option = element('option', col.rotulo); option.value = col.valor; return option; }));
    $('ordenarCampo').value = [...$('ordenarCampo').options].some(o => o.value === campo) ? campo : 'score';
    $('aceitarParcial').checked = false; solicitarPrevia();
  }
}
function aplicarEstadoExecucao(execution) {
  if (!execution || execution.tabId !== state.tabId || (state.execucao && execution.revisao < state.execucao.revisao)) return;
  const wasBusy = Boolean(state.execucao?.emExecucao);
  state.execucao = execution;
  const busy = Boolean(execution.emExecucao);
  renderSessao(execution.sessao || { estado: 'nao_verificada', mensagem: busy ? 'A sessão será verificada durante esta operação.' : 'Use “Verificar conexão” para confirmar o acesso nesta aba.' });
  $('verificarSessao').disabled = busy || !state.pronta;
  $('irSiaps').disabled = !state.pronta;
  $('configFields').disabled = busy; $('exportFields').disabled = busy;
  $('consolidar').disabled = busy || !state.pronta; $('parar').hidden = !busy;
  $('baixar').textContent = busy && execution.operacao === 'exportar' ? 'Preparando e baixando…' : 'Baixar Excel';
  status(execution.status, execution.nivel);
  const p = execution.progresso; $('progress').hidden = !busy || !p;
  if (p) { $('progress').max = p.total; $('progress').value = p.atual; }
  $('progressText').textContent = busy && p ? `${p.atual} de ${p.total}` : '';
  $('executionLog').replaceChildren(...(execution.mensagens || []).map(m => element('p', `${new Date(m.horario).toLocaleTimeString('pt-BR')} ${m.mensagem}`)));
  renderResultado(); atualizarDownload();
  if (wasBusy && !busy) solicitarPrevia();
}
async function consultar(atualizar = false) {
  if (!state.pronta || state.execucao?.emExecucao) return;
  $('configError').textContent = '';
  if (!state.competencias.length || !state.controllers.indicadores.getSelectedCount()) { $('configError').textContent = 'Adicione ao menos um mês e selecione um indicador.'; return; }
  salvar(); $('consolidar').disabled = true; $('atualizar').disabled = true;
  $('aceitarParcial').checked = false;
  try { const result = await api({ type: 'start', configuracao: { ...configuracao(), atualizar } }); aplicarEstadoExecucao(result.estado); }
  catch (error) { status(error.message, 'error'); $('consolidar').disabled = false; }
  finally { $('atualizar').disabled = false; }
}
async function exportar(config) {
  state.exportacaoPendente = null; $('downloadConfirmation').hidden = true; $('baixar').disabled = true;
  try { const result = await api({ type: 'exportConsolidation', configuracao: config }); aplicarEstadoExecucao(result.estado); }
  catch (error) { $('exportError').textContent = error.message; atualizarDownload(); }
}
async function iniciar() {
  try {
    $('version').textContent = `v${chrome.runtime.getManifest().version}`;
    const id = Number(new URLSearchParams(location.search).get('tabId'));
    if (id) document.body.classList.add('dashboard');
    const tab = id ? await chrome.tabs.get(id) : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
    if (!tab?.id || new URL(tab.url || '').origin !== 'https://siaps.saude.gov.br') throw new Error('Abra a aba do SIAPS, entre no sistema e clique novamente no ícone da ferramenta.');
    state.tabId = tab.id; $('pageContext').textContent = 'Vinculado à aba do SIAPS · Betim/MG';
    const [catalog, session, local, result] = await Promise.all([api({ type: 'getCatalog' }), chrome.storage.session.get(`siaps:config:${tab.id}`), chrome.storage.local.get(['siaps:preferences', 'siapsToolPopupConfig']), api({ type: 'getExecution' })]);
    const config = session[`siaps:config:${tab.id}`] || local['siaps:preferences'] || local.siapsToolPopupConfig || {};
    state.configInicial = config; state.catalogo = catalog.catalogo;
    const previous = new Date(); previous.setDate(1); previous.setMonth(previous.getMonth() - 1);
    const defaultMonth = `${previous.getFullYear()}${String(previous.getMonth() + 1).padStart(2, '0')}`;
    state.competencias = (config.competencias || [defaultMonth]).filter(C.competenciaValida).slice(0, 36);
    const inputMonth = state.competencias[0] || defaultMonth; $('competencia').value = `${inputMonth.slice(0, 4)}-${inputMonth.slice(4)}`;
    $('modoDados').value = config.modoDados === 'analitico' ? 'analitico' : 'completo';
    $('modoUnificacao').value = config.unificacao?.modo === 'separado' ? 'separado' : 'unificado';
    $('agruparUnificacao').value = config.unificacao?.agruparPor || 'competencia';
    $('metadados').checked = config.incluirMetadados !== false;
    $('ordenarDirecao').value = config.ordenacao?.direcao === 'asc' ? 'asc' : 'desc';
    const groups = [...new Map(state.catalogo.map(i => [i.grupo, { valor: i.grupo, rotulo: i.codigoExibicao.replace(/\d+$/, '') }])).values()];
    state.controllers.indicadores = new MultiSelect($('indicatorSelect'), 'Indicadores', mudouConsulta, groups);
    state.controllers.unidades = new MultiSelect($('unitSelect'), 'Unidades', () => { atualizarEquipes(); solicitarPrevia(); salvar(); });
    state.controllers.equipes = new MultiSelect($('teamSelect'), 'Equipes', () => { solicitarPrevia(); salvar(); });
    state.controllers.indicadores.setItems(state.catalogo.map(i => ({ valor: i.codigo, grupo: i.grupo, rotulo: `${i.codigoExibicao} — ${i.nome}` })), config.indicadores);
    state.pronta = true; meses(); aplicarEstadoExecucao(result.estado);
    $('groupField').hidden = $('modoUnificacao').value !== 'unificado';
    if (config.ordenacao?.campo && [...$('ordenarCampo').options].some(o => o.value === config.ordenacao.campo)) $('ordenarCampo').value = config.ordenacao.campo;
    // Recupera eventos que tenham chegado durante a construção dos controles.
    aplicarEstadoExecucao((await api({ type: 'getExecution' })).estado);
    if (!state.execucao?.emExecucao) renderSessao(await api({ type: 'checkSession' }));
  } catch (error) { status(error.message, 'error'); $('pageContext').textContent = 'É necessário abrir o SIAPS para consultar dados.'; }
}
$('adicionarCompetencia').addEventListener('click', () => {
  const value = $('competencia').value.replace('-', ''); $('configError').textContent = '';
  if (!C.competenciaValida(value)) { $('configError').textContent = 'Informe um mês válido entre 2000 e 2100.'; return; }
  if (!state.competencias.includes(value)) { if (state.competencias.length >= 36) { $('configError').textContent = 'Use até 36 meses por consulta.'; return; } state.competencias.push(value); state.competencias.sort(); }
  meses(); mudouConsulta();
});
$('consolidar').addEventListener('click', () => consultar());
$('verificarSessao').addEventListener('click', async () => {
  $('verificarSessao').disabled = true; $('sessionBadge').textContent = 'Verificando conexão…';
  try { renderSessao(await api({ type: 'checkSession', verificar: true })); }
  catch { renderSessao({ estado: 'erro_leitura', mensagem: 'A extensão não conseguiu verificar a conexão. Volte à aba do SIAPS e reabra a ferramenta.' }); }
  finally { $('verificarSessao').disabled = Boolean(state.execucao?.emExecucao); }
});
$('irSiaps').addEventListener('click', async () => { try { await api({ type: 'focusSiaps' }); } catch (e) { status(e.message, 'error'); } });
$('atualizar').addEventListener('click', () => consultar(true));
$('tentarNovamente').addEventListener('click', () => consultar());
$('parar').addEventListener('click', async () => { try { await api({ type: 'cancel' }); } catch (e) { status(e.message, 'error'); } });
$('reportForm').addEventListener('submit', async event => {
  event.preventDefault(); $('exportError').textContent = '';
  if (!state.previa?.arquivos || state.execucao?.emExecucao) return;
  const config = configuracao(); if (state.execucao.consolidacao?.parcial && !config.aceitarParcial) return;
  salvar();
  if (state.previa.arquivos > 1) {
    state.exportacaoPendente = config; $('downloadConfirmationText').textContent = `Serão baixados ${state.previa.arquivos} arquivos Excel, com ${state.previa.registros} registros no total. Aguarde a confirmação de cada download.`;
    $('downloadConfirmation').hidden = false; $('confirmarDownloads').focus(); return;
  }
  await exportar(config);
});
$('confirmarDownloads').addEventListener('click', () => { if (state.exportacaoPendente) void exportar(state.exportacaoPendente); });
$('cancelarDownloads').addEventListener('click', () => { state.exportacaoPendente = null; $('downloadConfirmation').hidden = true; $('baixar').focus(); });
for (const id of ['modoDados', 'modoUnificacao', 'agruparUnificacao', 'ordenarCampo', 'ordenarDirecao', 'metadados']) $(id).addEventListener('change', () => { $('groupField').hidden = $('modoUnificacao').value !== 'unificado'; solicitarPrevia(); salvar(); });
$('aceitarParcial').addEventListener('change', atualizarDownload);
$('limparLog').addEventListener('click', async () => { try { aplicarEstadoExecucao((await api({ type: 'clearExecutionLog' })).estado); } catch (e) { status(e.message, 'error'); } });
$('copiarDiagnostico').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(JSON.stringify({ versao: chrome.runtime.getManifest().version, status: state.execucao?.status, mensagens: state.execucao?.mensagens || [] }, null, 2)); $('copiarDiagnostico').textContent = 'Diagnóstico copiado'; }
  catch { status('Não foi possível copiar. Você pode selecionar o texto dos detalhes técnicos.', 'warning'); }
});
$('openWindow').addEventListener('click', async () => { try { await api({ type: 'openDashboard' }); window.close(); } catch (e) { status(e.message, 'error'); } });
chrome.runtime.onMessage.addListener(message => {
  if (state.pronta && message.type === 'stateChanged' && message.tabId === state.tabId) aplicarEstadoExecucao(message.estado);
});
void iniciar();
