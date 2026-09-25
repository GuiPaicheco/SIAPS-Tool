// Desenvolvido por Guilherme Paicheco (guilherme.paicheco@betim.mg.gov.br)
const STORAGE_CONFIG = "siapsToolPopupConfig";

if (new URLSearchParams(window.location.search).has("tabId")) {
  document.body.classList.add("dashboard");
}

const state = {
  tabId: null,
  tabUrl: null,
  catalogo: null,
  opcoes: { unidades: [], equipes: [] },
  emExecucao: false,
  consolidacao: null,
  competencias: [],
  previaExportacao: null,
  exportacaoPendente: null,
  desempenho: null,
  controllers: {}
};

const ui = {
  form: document.querySelector("#reportForm"),
  competenciaMes: document.querySelector("#competenciaMes"),
  competenciaAno: document.querySelector("#competenciaAno"),
  competenciaHelp: document.querySelector("#competenciaHelp"),
  adicionarCompetencia: document.querySelector("#adicionarCompetencia"),
  competenciasSelecionadas: document.querySelector("#competenciasSelecionadas"),
  metadados: document.querySelector("#metadados"),
  modoDados: document.querySelector("#modoDados"),
  modoUnificacao: document.querySelector("#modoUnificacao"),
  agruparUnificacao: document.querySelector("#agruparUnificacao"),
 campoOrdenacao: document.querySelector("#ordenarCampo"),
  direcaoOrdenacao: document.querySelector("#ordenarDirecao"),
  consolidar: document.querySelector("#consolidar"),
  baixar: document.querySelector("#baixar"),
  consolidacaoEstimate: document.querySelector("#consolidationEstimate"),
  downloadConfirmation: document.querySelector("#downloadConfirmation"),
  downloadConfirmationText: document.querySelector("#downloadConfirmationText"),
  confirmarDownloads: document.querySelector("#confirmarDownloads"),
  cancelarDownloads: document.querySelector("#cancelarDownloads"),
  resumo: document.querySelector("#consolidationSummary"),
  selectionCount: document.querySelector("#selectionCount"),
  statusCard: document.querySelector("#statusCard"),
  statusTitle: document.querySelector("#statusTitle"),
  statusMessage: document.querySelector("#statusMessage"),
  progressWrap: document.querySelector("#progressWrap"),
  progressBar: document.querySelector("#progressBar"),
  progressText: document.querySelector("#progressText"),
  log: document.querySelector("#executionLog"),
  limparLog: document.querySelector("#limparLog"),
  openWindow: document.querySelector("#openWindow"),
  errors: {
    competencia: document.querySelector("#competenciaError"),
    indicadores: document.querySelector("#indicadoresError"),
    unidades: document.querySelector("#unidadesError"),
    equipes: document.querySelector("#equipesError")
  },
  equipesWarning: document.querySelector("#equipesWarning"),
  unidadesHelp: document.querySelector("#unidadesHelp"),
  equipesHelp: document.querySelector("#equipesHelp")
};

document.querySelectorAll(".logo").forEach(
  logo => logo.addEventListener(
    "error",
    () => {
      logo.hidden = true;
    }
  )
);

function formatarCompetencia(valor) {
  const meses = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
  const texto = String(valor || "");
  const mes = Number(texto.slice(4, 6));
  return meses[mes - 1] ? `${meses[mes - 1]} de ${texto.slice(0, 4)}` : texto;
}

function competenciaAtual() {
  return `${ui.competenciaAno.value}${ui.competenciaMes.value}`;
}

function competenciasSelecionadas() {
  return [...state.competencias];
}

function atualizarCompetenciasSelecionadas() {
  const competencias = competenciasSelecionadas();
  ui.competenciasSelecionadas.innerHTML = competencias.map(competencia =>
    `<span class="competencia-chip">${escapear(formatarCompetencia(competencia))}<button type="button" data-competencia="${escapear(competencia)}" aria-label="Remover ${escapear(formatarCompetencia(competencia))}">×</button></span>`
  ).join("");
  ui.competenciaHelp.textContent = competencias.length
    ? `${competencias.length} competência(s) selecionada(s): ${competencias.join(", ")}`
    : "Adicione ao menos uma competência.";
  atualizarEstimativaConsolidacao();
}

function formatarDuracao(segundos) {
  const total = Math.max(1, Math.round(segundos));
  const minutos = Math.floor(total / 60);
  const restante = total % 60;
  return minutos ? `cerca de ${minutos} min${restante ? ` e ${restante}s` : ""}` : `cerca de ${restante}s`;
}

function estimarSegundos(tipo, quantidade, indicadores = []) {
  const dados = state.desempenho?.[tipo];
  if (!dados?.amostras) return null;
  if (indicadores.length) {
    return indicadores.reduce(
      (total, indicador) => total + (
        dados.porIndicador?.[indicador]?.media || dados.media
      ),
      0
    ) * quantidade;
  }
  return dados.media * quantidade;
}

function atualizarEstimativaConsolidacao() {
  if (!ui.consolidacaoEstimate) return;
  const indicadores = state.controllers.indicadores?.getValues() || [];
  const codigos = indicadores.length
    ? indicadores
    : state.catalogo?.indicadores.map(indicador => indicador.codigo) || [];
  const segundos = estimarSegundos(
    "consolidacao",
    state.competencias.length,
    codigos
  );
  ui.consolidacaoEstimate.textContent = segundos
    ? `Previsão de consolidação: ${formatarDuracao(segundos)} (baseada no histórico local).`
    : "A previsão aparecerá após a primeira consolidação desta extensão.";
}

function adicionarCompetencia() {
  const competencia = competenciaAtual();
  if (!/^\d{6}$/.test(competencia)) {
    ui.errors.competencia.textContent = "Informe um mês e ano válidos.";
    return;
  }
  if (!state.competencias.includes(competencia)) {
    state.competencias.push(competencia);
    state.competencias.sort((a, b) => b.localeCompare(a));
    invalidarConsolidacao();
  }
  ui.errors.competencia.textContent = "";
  atualizarCompetenciasSelecionadas();
  salvarConfiguracao();
}

function escapear(texto) {
  const area = document.createElement("span");
  area.textContent = texto;
  return area.innerHTML;
}

class MultiSelect {
  constructor(container, configuracao) {
    this.configuracao = configuracao;
    this.items = [];
    this.visiveis = [];
    this.selecionados = new Set();
    this.todos = true;
    this.aberto = false;
    this.busca = "";
    this.container = container;
    this.renderBase();
  }

  renderBase() {
    this.container.innerHTML = `
      <div class="multi-select">
        <button type="button" class="multi-trigger" aria-expanded="false" aria-haspopup="listbox">
          <span class="multi-summary"></span><span class="chevron" aria-hidden="true">⌄</span>
        </button>
        <div class="multi-panel" hidden>
          <label class="sr-only">Buscar ${this.configuracao.nome}</label>
         <input class="multi-search" type="search" placeholder="Buscar ${this.configuracao.nome}..." autocomplete="off">
         <div class="multi-actions"><button type="button" data-action="all">Selecionar todos</button><button type="button" data-action="none">Desmarcar todos</button></div>
          ${this.configuracao.grupos?.length ? `<div class="multi-group-actions" aria-label="Selecionar indicadores por tipo de equipe">${this.configuracao.grupos.map(grupo => `<button type="button" data-group="${escapear(grupo.valor)}" aria-label="Selecionar somente ${escapear(grupo.rotulo)}">${escapear(grupo.rotulo)}</button>`).join("")}</div>` : ""}
         <div class="multi-options" role="listbox" aria-multiselectable="true"></div>
        </div>
      </div>`;
    this.trigger = this.container.querySelector(".multi-trigger");
    this.summary = this.container.querySelector(".multi-summary");
    this.panel = this.container.querySelector(".multi-panel");
    this.search = this.container.querySelector(".multi-search");
    this.options = this.container.querySelector(".multi-options");
    this.trigger.addEventListener("click", () => this.toggle());
    this.search.addEventListener("input", () => { this.busca = this.search.value; this.renderOptions(); });
   this.panel.querySelector("[data-action='all']").addEventListener("click", () => this.selectAll());
   this.panel.querySelector("[data-action='none']").addEventListener("click", () => this.selectNone());
    this.panel.querySelectorAll("[data-group]").forEach(botao => botao.addEventListener("click", () => this.selectGroup(botao.dataset.group)));
  }

  setItems(items, valoresRestaurados = null) {
    this.items = [...items];
    this.visiveis = [...items];
    const validos = new Set(this.items.map(item => item.valor));
    if (valoresRestaurados) {
      this.selecionados = new Set(valoresRestaurados.filter(valor => validos.has(valor)));
      this.todos = valoresRestaurados.length === 0 || this.selecionados.size === this.items.length;
    } else {
      this.selecionados = new Set([...this.selecionados].filter(valor => validos.has(valor)));
      this.todos = this.todos || (this.items.length > 0 && this.selecionados.size === this.items.length);
    }
    this.update();
  }

  setVisibleItems(items) {
    this.visiveis = [...items];
    this.update();
  }

  getValues() { return this.todos ? [] : [...this.selecionados]; }
  getSelectedCount() { return this.todos ? this.items.length : this.selecionados.size; }
  getIncompativeis() { const permitidos = new Set(this.visiveis.map(item => item.valor)); return [...this.selecionados].filter(valor => !permitidos.has(valor)); }

  summaryText() {
    if (!this.items.length) return this.configuracao.indisponivel;
    if (this.todos) return `${this.configuracao.todos} (${this.items.length})`;
    return `${this.selecionados.size} ${this.configuracao.nome} selecionada(s)`;
  }

  toggle(force) {
    if (!this.items.length) return;
    this.aberto = typeof force === "boolean" ? force : !this.aberto;
    this.panel.hidden = !this.aberto;
    this.trigger.setAttribute("aria-expanded", String(this.aberto));
    if (this.aberto) { this.search.focus(); this.renderOptions(); }
  }

 selectAll() { this.todos = true; this.selecionados.clear(); this.changed(); }
 selectNone() { this.todos = false; this.selecionados.clear(); this.changed(); }
  selectGroup(grupo) {
    this.todos = false;
    this.selecionados = new Set(this.items.filter(item => item.grupo === grupo).map(item => item.valor));
    this.changed();
  }

  toggleItem(valor, marcado) {
    if (this.todos) this.selecionados = new Set(this.visiveis.map(item => item.valor));
    this.todos = false;
    if (marcado) this.selecionados.add(valor); else this.selecionados.delete(valor);
    if (this.items.length && this.selecionados.size === this.items.length) { this.todos = true; this.selecionados.clear(); }
    this.changed();
  }

  changed() { this.update(); this.configuracao.onChange?.(); }
  update() { this.summary.textContent = this.summaryText(); this.trigger.disabled = !this.items.length; this.renderOptions(); }

  renderOptions() {
    const busca = this.busca.trim().toLocaleLowerCase("pt-BR");
    const itens = this.visiveis.filter(item => this.configuracao.pesquisar(item).toLocaleLowerCase("pt-BR").includes(busca));
    if (!this.items.length) { this.options.innerHTML = `<p class="multi-empty">${this.configuracao.indisponivel}</p>`; return; }
    const todosMarcados = this.todos || (this.items.length > 0 && this.selecionados.size === this.items.length);
    const linhaTodos = `<label class="multi-option all"><input type="checkbox" data-all="true" ${todosMarcados ? "checked" : ""}><span>${this.configuracao.todos} (${this.items.length})</span></label>`;
    const linhas = itens.map(item => {
      const marcado = this.todos || this.selecionados.has(item.valor);
      return `<label class="multi-option"><input type="checkbox" data-value="${escapear(item.valor)}" ${marcado ? "checked" : ""}><span><strong>${escapear(item.rotulo)}</strong>${item.detalhe ? `<small>${escapear(item.detalhe)}</small>` : ""}</span></label>`;
    }).join("");
    this.options.innerHTML = linhaTodos + (linhas || '<p class="multi-empty">Nenhum resultado encontrado.</p>');
    const caixaTodos = this.options.querySelector("[data-all]");
    caixaTodos?.addEventListener("change", event => event.target.checked ? this.selectAll() : this.selectNone());
    this.options.querySelectorAll("[data-value]").forEach(caixa => caixa.addEventListener("change", event => this.toggleItem(event.target.dataset.value, event.target.checked)));
  }
}

function salvarConfiguracao() {
  if (!state.catalogo) return;
  chrome.storage.local.set({
    [STORAGE_CONFIG]: {
      competencia: competenciaAtual(),
      competencias: competenciasSelecionadas(),
      indicadores: state.controllers.indicadores.getValues(),
      unidades: state.controllers.unidades.getValues(),
     equipes: state.controllers.equipes.getValues(),
      incluirMetadados: ui.metadados.checked,
      modoDados: ui.modoDados.value,
      unificacao: {
        modo: ui.modoUnificacao.value,
        agruparPor: ui.agruparUnificacao.value
      },
      ordenacao: { campo: ui.campoOrdenacao.value, direcao: ui.direcaoOrdenacao.value }
    }
  });
}

function definirStatus(mensagem, nivel = "info") {
  const titulos = { success: "Relatório concluído", warning: "Atenção", error: "Não foi possível gerar", info: state.emExecucao ? "Processando relatório" : "Pronto para gerar" };
  ui.statusCard.className = `status-card ${nivel === "info" ? "" : nivel}`;
  ui.statusTitle.textContent = titulos[nivel] || "Status";
  ui.statusMessage.textContent = mensagem;
}

function mensagemAmigavel(erro) {
  const texto = String(erro || "");
  if (/Cannot access|permission|permissão/i.test(texto)) return "A extensão não possui acesso a esta página. Abra a Visão por Competência do SIAPS.";
  if (/access_token/i.test(texto)) return "Sua sessão do SIAPS não foi encontrada. Entre no sistema e tente novamente.";
  if (/ExcelJS/i.test(texto)) return "Abra primeiro a tela Visão por Competência do SIAPS e tente novamente.";
  return "Não foi possível iniciar o relatório. Verifique a página do SIAPS e tente novamente.";
}

function renderLog(mensagens) {
  ui.log.replaceChildren();
  if (!mensagens.length) { ui.log.innerHTML = '<p class="log-empty">SIAPS-TOOL inicializado. Aguardando configuração...</p>'; return; }
  mensagens.forEach(item => {
    const linha = document.createElement("p");
    linha.className = `log-entry ${item.nivel || "info"}`;
    const horario = new Date(item.horario || Date.now()).toLocaleTimeString("pt-BR");
    linha.innerHTML = `<span class="log-time">[${horario}]</span> ${escapear(item.mensagem)}`;
    ui.log.append(linha);
  });
  ui.log.scrollTop = ui.log.scrollHeight;
}

function atualizarProgresso(mensagem) {
  const resultado = mensagem.match(/(?:PROGRESSO GERAL: )?(\d+)\/(\d+) indicadores/i) || mensagem.match(/\[(\d+)\/(\d+)\]/);
  if (!resultado) return;
  const atual = Number(resultado[1]); const total = Number(resultado[2]);
  if (!total) return;
  ui.progressWrap.hidden = false;
  ui.progressBar.style.width = `${Math.round((atual / total) * 100)}%`;
  ui.progressText.textContent = `Indicador ${atual} de ${total}`;
}

function aplicarEstadoExecucao(execucao) {
  state.emExecucao = Boolean(execucao.emExecucao);
  if (
    Object.hasOwn(
      execucao,
      "consolidacao"
    )
  ) {

    state.consolidacao =
      execucao.consolidacao;

  }
  ui.consolidar.disabled = state.emExecucao || !state.catalogo;
  ui.baixar.disabled = state.emExecucao || !state.consolidacao;
  ui.consolidar.classList.toggle("loading", state.emExecucao);
  ui.baixar.classList.toggle("loading", state.emExecucao);
  ui.consolidar.querySelector(".button-label").textContent = state.emExecucao ? "Gerando consolidações..." : state.competencias.length > 1 ? "Gerar consolidações" : "Gerar consolidação";
  definirStatus(execucao.status, execucao.nivel || "info");
  renderLog(execucao.mensagens || []);
  (execucao.mensagens || []).forEach(item => atualizarProgresso(item.mensagem));
  if (execucao.competenciaAtual && execucao.competenciasTotal) {
    ui.progressWrap.hidden = false;
    const textoAtual = ui.progressText.textContent.replace(/^Competência \d+ de \d+( • )?/, "");
    ui.progressText.textContent = `Competência ${execucao.competenciaAtual} de ${execucao.competenciasTotal}${textoAtual ? ` • ${textoAtual}` : ""}`;
  }
  atualizarResumoConsolidacao();
}

function atualizarResumoConsolidacao() {
  const resumo = state.consolidacao;
  if (!resumo) {
    ui.resumo.hidden = true;
    ui.selectionCount.textContent = "Gere uma consolidação para habilitar a exportação.";
    return;
  }
  ui.resumo.hidden = false;
  const competencias = resumo.competencias || [resumo.competencia];
  ui.resumo.innerHTML = `<strong>✓ Consolidação concluída</strong>Competências: ${escapear(competencias.map(formatarCompetencia).join(", "))}<br>Indicadores: ${resumo.indicadores}<br>Unidades encontradas: ${resumo.unidades}<br>Equipes encontradas: ${resumo.equipes}<br>Registros: ${resumo.registros}`;
  atualizarContagemExportacao();
}

function atualizarFaseExportacao() {
  const habilitada = Boolean(state.consolidacao) && !state.emExecucao;
  [state.controllers.unidades, state.controllers.equipes].forEach(controlador => {
    if (controlador?.trigger) controlador.trigger.disabled = !habilitada || !controlador.items.length;
  });
 ui.metadados.disabled = !habilitada;
  ui.modoDados.disabled = !habilitada;
 ui.campoOrdenacao.disabled = !habilitada;
  ui.direcaoOrdenacao.disabled = !habilitada;
}

function atualizarContagemExportacao() {
  if (!state.consolidacao) return;
  ocultarConfirmacaoDownloads();
  const total = state.consolidacao.registros || 0;
  ui.selectionCount.textContent = "Calculando resultado dos filtros...";
  const referencia = state.consolidacao;
  chrome.runtime.sendMessage({
    type: "previewExport",
    tabId: state.tabId,
    configuracao: configuracaoMotor()
  }, resposta => {
    if (referencia !== state.consolidacao || chrome.runtime.lastError || resposta?.erro) {
      ui.selectionCount.textContent = `${total} registros consolidados.`;
      return;
    }
    state.previaExportacao = resposta;
    const tempo = estimarSegundos("exportacao", resposta.arquivos);
    ui.selectionCount.textContent = `${resposta.registros} de ${total} registros serão exportados em ${resposta.arquivos} arquivo(s), sem nova consulta.${tempo ? ` Previsão: ${formatarDuracao(tempo)}.` : ""}`;
  });
  atualizarFaseExportacao();
}

function atualizarEquipesPorUnidade() {
  const equipes = state.opcoes.equipes || [];
  const unidades = state.controllers.unidades?.getValues() || [];
  const filtradas = unidades.length ? equipes.filter(equipe => unidades.includes(equipe.unidade)) : equipes;
  state.controllers.equipes?.setVisibleItems(filtradas);
  const incompativeis = state.controllers.equipes?.getIncompativeis() || [];
  ui.equipesWarning.textContent = incompativeis.length ? `${incompativeis.length} equipe(s) selecionada(s) não pertence(m) às unidades atuais e não será(ão) incluída(s).` : "";
  atualizarContagemExportacao();
}

function invalidarConsolidacao() {
  if (!state.consolidacao) return;
  state.consolidacao = null;
  ui.baixar.disabled = true;
  definirStatus("Competência ou indicadores foram alterados. Gere uma nova consolidação.", "warning");
  atualizarResumoConsolidacao();
  atualizarFaseExportacao();
}

function consolidacaoCompativel() {
  if (!state.consolidacao) return false;
  const consolidadas = state.consolidacao.competencias || [state.consolidacao.competencia];
  const atuais = competenciasSelecionadas();
  if (atuais.length !== consolidadas.length || !atuais.every(competencia => consolidadas.includes(competencia))) return false;
  const atual = state.controllers.indicadores.getValues();
  const codigos = state.consolidacao.indicadoresCodigos || [];
  const selecionados = atual.length ? atual : state.catalogo.indicadores.map(indicador => indicador.codigo);
  return selecionados.length === codigos.length && selecionados.every(codigo => codigos.includes(codigo));
}

function validar() {
  Object.values(ui.errors).forEach(elemento => { elemento.textContent = ""; });
  let valido = true;
  if (!competenciasSelecionadas().length) { ui.errors.competencia.textContent = "Adicione ao menos uma competência."; valido = false; }
  if (!state.controllers.indicadores.getSelectedCount()) { ui.errors.indicadores.textContent = "Selecione pelo menos um indicador."; valido = false; }
  const unidades = state.controllers.unidades.getValues();
  if (unidades.length && !unidades.some(valor => state.opcoes.unidades.some(unidade => unidade.valor === valor))) { ui.errors.unidades.textContent = "Selecione ao menos uma unidade válida."; valido = false; }
  const equipes = state.controllers.equipes.getValues();
  const visiveis = new Set(state.controllers.equipes.visiveis.map(equipe => equipe.valor));
  if (equipes.length && !equipes.some(valor => visiveis.has(valor))) { ui.errors.equipes.textContent = "Selecione ao menos uma equipe compatível com as unidades."; valido = false; }
  return valido;
}

function configuracaoMotor() {
  return {
    competencia: competenciaAtual(),
    competencias: competenciasSelecionadas(),
    chaveConsolidacao: JSON.stringify({
      competencias: competenciasSelecionadas().slice().sort(),
      indicadores: (state.controllers.indicadores.getValues().length
        ? state.controllers.indicadores.getValues().slice().sort()
        : ["todos"])
    }),
    indicadores: state.controllers.indicadores.getValues(),
    unidades: state.controllers.unidades.getValues(),
   equipes: state.controllers.equipes.getValues(),
    incluirMetadados: ui.metadados.checked,
    modoDados: ui.modoDados.value,
    unificacao: {
      modo: ui.modoUnificacao.value,
      agruparPor: ui.agruparUnificacao.value
    },
    ordenacao: { campo: ui.campoOrdenacao.value, direcao: ui.direcaoOrdenacao.value }
  };
}

function preencherCamposOrdenacao(campos = [], campoPreferido, campoPadrao) {
  const opcoes = [...new Set(campos.filter(Boolean))];
  if (!opcoes.length) opcoes.push("score");
  const selecionado = [campoPreferido, campoPadrao, "score", opcoes[0]].find(campo => opcoes.includes(campo));
  ui.campoOrdenacao.replaceChildren(...opcoes.map(campo => {
    const opcao = document.createElement("option");
    opcao.value = campo;
    opcao.textContent = campo;
    return opcao;
  }));
  ui.campoOrdenacao.value = selecionado;
}

function atualizarCamposOrdenacao() {
  const resumo = state.consolidacao || {};
  const campos = ui.modoDados.value === "analitico"
    ? resumo.camposOrdenacaoAnaliticos
    : resumo.camposOrdenacao;
  preencherCamposOrdenacao(campos, ui.campoOrdenacao.value, resumo.campoPadraoOrdenacao);
}

function configurarControles(configuracaoSalva) {
  const gruposIndicadores = [...new Map(state.catalogo.indicadores.map(indicador => [
    indicador.grupo,
    String(indicador.codigoExibicao || indicador.codigo).replace(/\d+$/, "")
  ])).entries()].map(([valor, rotulo]) => ({ valor, rotulo }));
  state.controllers.indicadores = new MultiSelect(document.querySelector("#indicatorSelect"), {
    nome: "indicador", todos: "Todos os indicadores", indisponivel: "Carregando indicadores...",
    grupos: gruposIndicadores, pesquisar: item => `${item.rotulo} ${item.detalhe || ""}`, onChange: () => { invalidarConsolidacao(); atualizarEstimativaConsolidacao(); salvarConfiguracao(); }
  });
  state.controllers.unidades = new MultiSelect(document.querySelector("#unitSelect"), {
    nome: "unidade", todos: "Todas as unidades", indisponivel: "Disponível após carregar dados do SIAPS.",
    pesquisar: item => `${item.rotulo} ${item.detalhe || ""}`, onChange: () => { atualizarEquipesPorUnidade(); salvarConfiguracao(); }
  });
  state.controllers.equipes = new MultiSelect(document.querySelector("#teamSelect"), {
    nome: "equipe", todos: "Todas as equipes", indisponivel: "Disponível após carregar dados do SIAPS.",
    pesquisar: item => `${item.rotulo} ${item.detalhe || ""}`, onChange: () => { atualizarContagemExportacao(); salvarConfiguracao(); }
  });
  const indicadores = state.catalogo.indicadores.map(indicador => ({ valor: indicador.codigo, grupo: indicador.grupo, rotulo: `${indicador.codigoExibicao || indicador.codigo} - ${indicador.nome}` }));
  state.controllers.indicadores.setItems(indicadores, configuracaoSalva.indicadores || []);
}

function preencherOpcoes(opcoes, configuracaoSalva = {}) {
  state.opcoes = opcoes || { unidades: [], equipes: [] };
  const unidades = state.opcoes.unidades.map(unidade => ({ valor: unidade.valor, rotulo: unidade.rotulo, detalhe: `CNES ${unidade.valor}` }));
  const equipes = state.opcoes.equipes.map(equipe => ({ valor: equipe.valor, rotulo: equipe.rotulo, detalhe: `INE ${equipe.ine || equipe.valor}${equipe.tipo ? ` • ${equipe.tipo}` : ""}`, unidade: equipe.unidade }));
  state.controllers.unidades.setItems(unidades, configuracaoSalva.unidades || state.controllers.unidades.getValues());
  state.controllers.equipes.setItems(equipes, configuracaoSalva.equipes || state.controllers.equipes.getValues());
  ui.unidadesHelp.textContent = unidades.length ? `${unidades.length} unidade(s) disponível(is) da coleta anterior.` : "Disponível após carregar dados do SIAPS.";
  ui.equipesHelp.textContent = equipes.length ? `${equipes.length} equipe(s) disponível(is) da coleta anterior.` : "Disponível após carregar dados do SIAPS.";
  atualizarEquipesPorUnidade();
  atualizarFaseExportacao();
}

async function iniciar() {
  const [configDados, execucao, opcoesDados, desempenho] = await Promise.all([
    chrome.storage.local.get(STORAGE_CONFIG),
    new Promise(resolve => chrome.runtime.sendMessage({ type: "getExecution" }, resolve)),
    chrome.storage.session.get("siapsToolOptions"),
    new Promise(resolve => chrome.runtime.sendMessage({ type: "getPerformance" }, resolve))
  ]);
  state.desempenho = desempenho;
  const configuracaoSalva = configDados[STORAGE_CONFIG] || {};
  ui.metadados.checked = configuracaoSalva.incluirMetadados !== false;
  ui.modoDados.value = configuracaoSalva.modoDados === "analitico" ? "analitico" : "completo";
  ui.modoUnificacao.value = configuracaoSalva.unificacao?.modo === "unificado" ? "unificado" : "separado";
  ui.agruparUnificacao.value = configuracaoSalva.unificacao?.agruparPor || "sequencia";
  ui.agruparUnificacao.disabled = ui.modoUnificacao.value !== "unificado";
  ui.direcaoOrdenacao.value = configuracaoSalva.ordenacao?.direcao === "asc" ? "asc" : "desc";
  preencherCamposOrdenacao([], configuracaoSalva.ordenacao?.campo);
  aplicarEstadoExecucao(execucao || { mensagens: [], status: "Pronto para gerar." });
  const tabIdDaConsulta = Number(
    new URLSearchParams(window.location.search).get("tabId")
  );
  const [tab] = tabIdDaConsulta
    ? [await chrome.tabs.get(tabIdDaConsulta).catch(() => null)]
    : await chrome.tabs.query({ active: true, currentWindow: true });
  state.tabId = tab?.id;
  state.tabUrl = tab?.url || null;
  if (!state.tabId || !/^https:\/\/.*\.saude\.gov\.br\//.test(tab.url || "")) {
    definirStatus("Abra a Visão por Competência em uma sessão autenticada do SIAPS.", "error");
    return;
  }
  chrome.runtime.sendMessage({ type: "getCatalog", tabId: state.tabId }, resposta => {
    if (chrome.runtime.lastError || resposta?.erro || !resposta?.catalogo) { definirStatus(mensagemAmigavel(resposta?.erro || chrome.runtime.lastError?.message), "error"); return; }
    state.catalogo = resposta.catalogo;
    const competencia = configuracaoSalva.competencia || state.catalogo.competencia;
    ui.competenciaAno.value = String(competencia).slice(0, 4);
    ui.competenciaMes.value = String(competencia).slice(4, 6);
    state.competencias = [...new Set(configuracaoSalva.competencias?.length ? configuracaoSalva.competencias : [competencia])];
    atualizarCompetenciasSelecionadas();
    configurarControles(configuracaoSalva);
    atualizarEstimativaConsolidacao();
    preencherOpcoes(
      state.consolidacao
        ? opcoesDados.siapsToolOptions
        : { unidades: [], equipes: [] },
      configuracaoSalva
    );
    atualizarCamposOrdenacao();
    const pertenceAbaAtual = !state.consolidacao?.tabId || (
      state.consolidacao.tabId === state.tabId &&
      (!state.consolidacao.pageUrl || state.consolidacao.pageUrl === state.tabUrl)
    );
    if (state.consolidacao && (!pertenceAbaAtual || !consolidacaoCompativel())) {
      invalidarConsolidacao();
    }
    if (!state.consolidacao) {
      aplicarEstadoExecucao({ ...(execucao || { mensagens: [], status: "Pronto para gerar." }), consolidacao: null });
      return;
    }
    chrome.runtime.sendMessage({ type: "getPageConsolidation", tabId: state.tabId }, pagina => {
      if (chrome.runtime.lastError || pagina?.erro || !pagina?.disponivel) {
        invalidarConsolidacao();
      }
      aplicarEstadoExecucao({ ...(execucao || { mensagens: [], status: "Pronto para gerar." }), consolidacao: state.consolidacao });
    });
  });
}

ui.consolidar.addEventListener("click", () => {
  if (state.emExecucao || !validar()) return;
  salvarConfiguracao();
  const configuracao = { ...configuracaoMotor(), modo: "consolidar", unidades: [], equipes: [] };
  chrome.runtime.sendMessage({ type: "start", tabId: state.tabId, pageUrl: state.tabUrl, configuracao }, resposta => {
    if (chrome.runtime.lastError || resposta?.erro) {
      definirStatus(mensagemAmigavel(resposta?.erro || chrome.runtime.lastError?.message), "error");
      chrome.runtime.sendMessage({ type: "getExecution" }, aplicarEstadoExecucao);
    }
    else if (resposta.restaurada) {
      chrome.runtime.sendMessage({ type: "getExecution" }, aplicarEstadoExecucao);
    } else {
      aplicarEstadoExecucao({ emExecucao: true, mensagens: [], status: "Consultando SIAPS e gerando consolidação...", nivel: "info" });
    }
  });
});

function ocultarConfirmacaoDownloads() {
  state.exportacaoPendente = null;
  ui.downloadConfirmation.hidden = true;
}

function iniciarExportacao(configuracao) {
  ocultarConfirmacaoDownloads();
  chrome.runtime.sendMessage({ type: "exportConsolidation", tabId: state.tabId, configuracao }, resposta => {
    if (chrome.runtime.lastError || resposta?.erro) {
      definirStatus(mensagemAmigavel(resposta?.erro || chrome.runtime.lastError?.message), "error");
      chrome.runtime.sendMessage({ type: "getExecution" }, aplicarEstadoExecucao);
    }
    else aplicarEstadoExecucao({ emExecucao: true, consolidacao: state.consolidacao, mensagens: [], status: "Gerando planilha sem nova consulta...", nivel: "info" });
  });
}

ui.form.addEventListener("submit", event => {
  event.preventDefault();
  if (state.emExecucao || !state.consolidacao || !validar()) return;
  salvarConfiguracao();
  const configuracao = configuracaoMotor();
  chrome.runtime.sendMessage({ type: "previewExport", tabId: state.tabId, configuracao }, resposta => {
    if (chrome.runtime.lastError || resposta?.erro) {
      definirStatus(mensagemAmigavel(resposta?.erro || chrome.runtime.lastError?.message), "error");
      return;
    }
    state.previaExportacao = resposta;
    if (!resposta.arquivos) {
      definirStatus("Nenhum registro corresponde aos filtros selecionados.", "warning");
      return;
    }
    if (resposta.arquivos > 1) {
      state.exportacaoPendente = configuracao;
      ui.downloadConfirmationText.textContent = `Os filtros atuais gerarão ${resposta.arquivos} arquivos XLSX com ${resposta.registros} registros. Confirme para iniciar os downloads.`;
      ui.downloadConfirmation.hidden = false;
      ui.confirmarDownloads.focus();
      return;
    }
    iniciarExportacao(configuracao);
  });
});

ui.confirmarDownloads.addEventListener("click", () => {
  if (state.exportacaoPendente) iniciarExportacao(state.exportacaoPendente);
});
ui.cancelarDownloads.addEventListener("click", ocultarConfirmacaoDownloads);

ui.metadados.addEventListener("change", salvarConfiguracao);
ui.modoDados.addEventListener("change", () => { atualizarCamposOrdenacao(); salvarConfiguracao(); });
ui.modoUnificacao.addEventListener("change", () => {
  ui.agruparUnificacao.disabled = ui.modoUnificacao.value !== "unificado";
  atualizarContagemExportacao();
  salvarConfiguracao();
});
ui.agruparUnificacao.addEventListener("change", () => {
  atualizarContagemExportacao();
  salvarConfiguracao();
});
ui.campoOrdenacao.addEventListener("change", () => { atualizarContagemExportacao(); salvarConfiguracao(); });
ui.direcaoOrdenacao.addEventListener("change", salvarConfiguracao);
ui.adicionarCompetencia.addEventListener("click", adicionarCompetencia);
ui.competenciasSelecionadas.addEventListener("click", event => {
  const competencia = event.target.dataset.competencia;
  if (!competencia) return;
  state.competencias = state.competencias.filter(item => item !== competencia);
  invalidarConsolidacao();
  atualizarCompetenciasSelecionadas();
  salvarConfiguracao();
});
ui.competenciaMes.addEventListener("change", () => { ui.errors.competencia.textContent = ""; });
ui.competenciaAno.addEventListener("change", () => { ui.errors.competencia.textContent = ""; });
ui.limparLog.addEventListener("click", () => chrome.runtime.sendMessage({ type: "clearExecutionLog" }, resposta => renderLog(resposta.mensagens || [])));
ui.openWindow.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "openDashboard", tabId: state.tabId });
});

document.addEventListener("click", event => Object.values(state.controllers).forEach(controlador => {
  if (controlador.container && !controlador.container.contains(event.target)) controlador.toggle(false);
}));
document.addEventListener("keydown", event => { if (event.key === "Escape") Object.values(state.controllers).forEach(controlador => controlador.toggle(false)); });

chrome.runtime.onMessage.addListener(mensagem => {
  if (mensagem.source !== "SIAPS_TOOL") return;
  if (mensagem.type === "options" && state.catalogo) preencherOpcoes(mensagem.opcoes);
 if (mensagem.type === "consolidation") {
    state.consolidacao = mensagem.resumo;
    atualizarCamposOrdenacao();
   aplicarEstadoExecucao({
      emExecucao: false,
      consolidacao: mensagem.resumo,
      status: "Consolidação concluída.",
      nivel: "success"
    });
  }
  if (mensagem.type === "progress") {
    definirStatus(mensagem.mensagem, mensagem.nivel || "info");
    atualizarProgresso(mensagem.mensagem);
    chrome.runtime.sendMessage({ type: "getExecution" }, aplicarEstadoExecucao);
  }
});

iniciar();
