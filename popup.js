const estado = {
  catalogo: null,
  tabId: null
};

const elementos = {
  competencia: document.querySelector("#competencia"),
  indicadores: document.querySelector("#indicadores"),
  indicadoresResumo: document.querySelector("#indicadoresResumo"),
  unidades: document.querySelector("#unidades"),
  equipes: document.querySelector("#equipes"),
  metadados: document.querySelector("#metadados"),
  gerar: document.querySelector("#gerar"),
  status: document.querySelector(".status"),
  statusMensagem: document.querySelector("#statusMensagem")
};

function definirStatus(mensagem, tipo = "") {
  elementos.status.className = `status ${tipo}`;
  elementos.statusMensagem.textContent = mensagem;
}

function competenciaAmigavel(valor) {
  const meses = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
  const mes = Number(String(valor).slice(4, 6));
  return meses[mes - 1] ? `${meses[mes - 1]} de ${String(valor).slice(0, 4)}` : valor;
}

function valoresSelecionados(select) {
  return [...select.selectedOptions]
    .map(option => option.value)
    .filter(Boolean);
}

function preencherLista(select, todas, opcoes) {
  select.replaceChildren();
  const opcaoTodas = new Option(todas, "", true, true);
  select.add(opcaoTodas);
  opcoes.forEach(opcao => select.add(new Option(opcao.rotulo, opcao.valor)));
  select.disabled = opcoes.length === 0;
}

function atualizarResumoIndicadores() {
  const marcados = [...elementos.indicadores.querySelectorAll("input:checked")];
  const total = elementos.indicadores.querySelectorAll("input").length - 1;
  elementos.indicadoresResumo.textContent = marcados.length === total ? "Todos os indicadores" : `${marcados.length} indicador(es) selecionado(s)`;
}

function preencherIndicadores(indicadores) {
  elementos.indicadores.replaceChildren();
  const todos = document.createElement("label");
  todos.className = "option";
  todos.innerHTML = '<input type="checkbox" value="__todos__" checked><span>Todos os indicadores</span>';
  elementos.indicadores.append(todos);
  indicadores.forEach(indicador => {
    const item = document.createElement("label");
    item.className = "option";
    item.innerHTML = `<input type="checkbox" value="${indicador.codigo}" checked><span>${indicador.codigo} - ${indicador.nome}</span>`;
    elementos.indicadores.append(item);
  });
  elementos.indicadores.addEventListener("change", event => {
    const caixas = [...elementos.indicadores.querySelectorAll("input")];
    if (event.target.value === "__todos__") caixas.slice(1).forEach(caixa => { caixa.checked = event.target.checked; });
    else caixas[0].checked = caixas.slice(1).every(caixa => caixa.checked);
    atualizarResumoIndicadores();
  });
  atualizarResumoIndicadores();
}

function configuracao() {
  return {
    incluirMetadados: elementos.metadados.checked,
    indicadores: [...elementos.indicadores.querySelectorAll('input:not([value="__todos__"]):checked')].map(input => input.value),
    unidades: valoresSelecionados(elementos.unidades),
    equipes: valoresSelecionados(elementos.equipes)
  };
}

async function carregar() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  estado.tabId = tab?.id;
  if (!estado.tabId || !/^https:\/\/.*\.saude\.gov\.br\//.test(tab.url || "")) {
    definirStatus("Abra a Visão por Competência em uma sessão autenticada do SIAPS.", "error");
    return;
  }

  definirStatus("Conectando ao SIAPS...");
  chrome.runtime.sendMessage({ type: "getCatalog", tabId: estado.tabId }, resposta => {
    if (chrome.runtime.lastError || resposta?.erro || !resposta?.catalogo) {
      definirStatus(resposta?.erro || "Não foi possível ler a configuração do SIAPS.", "error");
      return;
    }
    estado.catalogo = resposta.catalogo;
    elementos.competencia.add(new Option(competenciaAmigavel(estado.catalogo.competencia), estado.catalogo.competencia, true, true));
    preencherIndicadores(estado.catalogo.indicadores);
    elementos.gerar.disabled = false;
    chrome.storage.session.get("siapsToolOptions", dados => {
      if (dados.siapsToolOptions) preencherOpcoes(dados.siapsToolOptions);
    });
    definirStatus("Pronto para gerar.");
  });
}

function preencherOpcoes(opcoes) {
  preencherLista(elementos.unidades, "Todas as unidades", opcoes.unidades || []);
  preencherLista(elementos.equipes, "Todas as equipes", opcoes.equipes || []);
}

elementos.gerar.addEventListener("click", () => {
  elementos.gerar.disabled = true;
  definirStatus("Iniciando geração do relatório...");
  chrome.runtime.sendMessage({ type: "start", tabId: estado.tabId, configuracao: configuracao() }, resposta => {
    if (chrome.runtime.lastError || resposta?.erro) {
      elementos.gerar.disabled = false;
      definirStatus(resposta?.erro || "Não foi possível iniciar o relatório.", "error");
    }
  });
});

chrome.runtime.onMessage.addListener(mensagem => {
  if (mensagem.source !== "SIAPS_TOOL") return;
  if (mensagem.type === "options") preencherOpcoes(mensagem.opcoes);
  if (mensagem.type === "progress") {
    const tipo = mensagem.nivel === "error" ? "error" : mensagem.nivel === "success" && /FINALIZADO|SUCESSO|TODOS/.test(mensagem.mensagem) ? "success" : "";
    definirStatus(mensagem.mensagem, tipo);
    if (mensagem.nivel === "error") elementos.gerar.disabled = false;
    if (/PROCESSO FINALIZADO/.test(mensagem.mensagem)) elementos.gerar.disabled = false;
  }
});

carregar();
