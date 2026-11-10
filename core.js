/* Lógica pura: seleção, contrato SIAPS, esquema e ordenação. Sem acesso ao DOM. */
(function (root) {
  'use strict';
  const fixas = [
    ['competencia', 'COMPETÊNCIA'], ['indicador', 'INDICADOR'], ['coCnes', 'CNES'],
    ['noUnidade', 'ESTABELECIMENTO'], ['dsTipoUnidade', 'TIPO DO ESTABELECIMENTO'],
    ['coEquipe', 'INE'], ['noEquipe', 'NOME DA EQUIPE'], ['sgEquipe', 'SIGLA DA EQUIPE']
  ];
  const normalizar = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  function competenciaValida(value) {
    return /^(20\d{2}|2100)(0[1-9]|1[0-2])$/.test(String(value));
  }
  function formatarCompetencia(value) {
    if (!competenciaValida(value)) throw new Error('Mês de referência inválido.');
    return `${String(value).slice(4)}/${String(value).slice(0, 4)}`;
  }
  function codigo(indicador) {
    const prefixos = { C: 'eSF/eAP', O: 'eSB', M: 'eMulti', R: 'eCR', A: 'eAPP', S: 'eSFR' };
    return `${prefixos[indicador.grupo] || indicador.grupo}${indicador.codigo.replace(/^\D+/, '')}`;
  }
  // Arrays antigos vazios significavam "todos"; novos estados são sempre explícitos.
  function selecao(value) {
    if (Array.isArray(value)) return value.length ? { modo: 'selecionados', valores: value.map(String) } : { modo: 'todos', valores: [] };
    if (!value || value.modo === 'todos') return { modo: 'todos', valores: [] };
    return { modo: 'selecionados', valores: [...new Set((value.valores || []).map(String))] };
  }
  function aceita(selection, value) {
    return selection.modo === 'todos' || selection.valores.includes(String(value ?? ''));
  }
  function filtrar(equipes, filtros = {}) {
    const unidades = selecao(filtros.unidades), teams = selecao(filtros.equipes);
    return equipes.filter(equipe => aceita(unidades, equipe.coCnes) && aceita(teams, equipe.coEquipe));
  }
  function indicadorDaEquipe(equipe, id) {
    const items = equipe.indicadores;
    if (!Array.isArray(items) || !items.length) throw new Error(`Equipe ${equipe.coEquipe || 'sem INE'} sem dados do indicador ${id}.`);
    const found = items.find(item => Number(item.coTipoIndicador ?? item.coIndicador) === Number(id));
    if (found) return found;
    // Formato legado: só é inequívoco se o endpoint filtrado retorna um único item sem ID.
    if (items.length === 1 && items[0].coTipoIndicador == null && items[0].coIndicador == null) return items[0];
    throw new Error(`Resposta não corresponde ao indicador ${id} da equipe ${equipe.coEquipe || 'sem INE'}.`);
  }
  function esquema(variaveis, indicadorId, modo = 'completo') {
    if (!Array.isArray(variaveis)) throw new Error('O SIAPS retornou uma estrutura de variáveis inválida.');
    const result = fixas.map(([id, titulo]) => ({ id, titulo }));
    if (modo !== 'analitico') {
      const vistos = new Set();
      for (const v of [...variaveis].sort((a, b) => (a.nuIndice ?? 0) - (b.nuIndice ?? 0))) {
        const param = String(v.noParametro || '').trim();
        const title = normalizar(v.descricao || v.noVariavel);
        const special = ['NUMERADOR', 'DENOMINADOR', 'PONTUACAO', 'CLASSIFICACAO', 'SCORE', 'SCOREFORMATADO', 'SCORECLASSIFICACAO'];
        if (special.includes(normalizar(param)) || ['NUMERADOR', 'DENOMINADOR', 'NUMERADOR/DENOMINADOR', 'PONTUACAO', 'CLASSIFICACAO'].includes(title)) continue;
        if (!param) throw new Error(`Variável "${v.descricao || v.noVariavel || '?'}" sem parâmetro de leitura.`);
        if (vistos.has(param)) throw new Error(`Parâmetro duplicado na estrutura: ${param}.`);
        vistos.add(param);
        result.push({ id: `var:${indicadorId}:${param}`, titulo: String(v.descricao || v.noVariavel || param).trim().toUpperCase(), param });
      }
      // C7 tem score próprio e não usa numerador/denominador no formato original.
      if (Number(indicadorId) !== 109) result.push({ id: 'numerador', titulo: 'NUMERADOR' }, { id: 'denominador', titulo: 'DENOMINADOR' });
    }
    result.push({ id: 'score', titulo: 'PONTUAÇÃO' }, { id: 'classificacao', titulo: 'CLASSIFICAÇÃO' });
    const titles = new Map();
    for (const col of result) {
      const n = (titles.get(col.titulo) || 0) + 1; titles.set(col.titulo, n);
      if (n > 1) col.titulo += ` (${col.param || col.id})`;
    }
    return result;
  }
  function linha(equipe, relatorio, schema) {
    const indicador = indicadorDaEquipe(equipe, relatorio.indicador.id);
    const valores = {
      ...equipe, coCnes: String(equipe.coCnes ?? ''), coEquipe: String(equipe.coEquipe ?? ''),
      competencia: formatarCompetencia(relatorio.competencia),
      indicador: `${codigo(relatorio.indicador)} - ${relatorio.indicador.nome}`,
      numerador: indicador.numerador ?? null, denominador: indicador.denominador ?? null,
      score: indicador.scoreFormatado ?? indicador.score ?? null, classificacao: indicador.scoreClassificacao ?? null
    };
    const cells = schema.map(col => col.param ? (indicador.variaveis?.[col.param] ?? null) : (valores[col.id] ?? null));
    if (cells.some(value => value != null && !['string', 'number', 'boolean'].includes(typeof value))) throw new Error('O SIAPS retornou um valor de célula incompatível com a estrutura esperada.');
    return { cells, score: numeroScore(indicador.score) };
  }
  function numeroScore(value) {
    return value != null && String(value).trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  }
  function ordenar(rows, schema, ordem = {}) {
    const field = ordem.campo || 'score';
    const index = schema.findIndex(col => col.id === field);
    if (index < 0) return rows;
    const dir = ordem.direcao === 'asc' ? 1 : -1;
    const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
    return [...rows].sort((a, b) => {
      const x = field === 'score' ? a.score : a.cells[index];
      const y = field === 'score' ? b.score : b.cells[index];
      const xv = x == null || String(x).trim() === '', yv = y == null || String(y).trim() === '';
      if (xv || yv) return xv === yv ? 0 : xv ? 1 : -1;
      return dir * (typeof x === 'number' && typeof y === 'number' ? x - y : collator.compare(String(x), String(y)));
    });
  }
  function tabela(blocos, opcoes = {}) {
    const schema = [], ids = new Set(), prepared = [];
    for (const bloco of blocos) {
      const columns = esquema(bloco.relatorio.variaveis, bloco.relatorio.indicador.id, opcoes.modoDados);
      for (const col of columns) if (!ids.has(col.id)) { ids.add(col.id); schema.push({ ...col }); }
      prepared.push({ ...bloco, columns });
    }
    // As variáveis mantêm identidade por indicador, mesmo quando o título coincide.
    const titleCounts = new Map();
    for (const col of schema) titleCounts.set(col.titulo, (titleCounts.get(col.titulo) || 0) + 1);
    for (const col of schema) if (titleCounts.get(col.titulo) > 1) col.titulo += ` [${col.id.split(':').slice(1).join(':')}]`;
    schema.sort((a, b) => (a.id === 'classificacao' ? 2 : a.id === 'score' ? 1 : 0) - (b.id === 'classificacao' ? 2 : b.id === 'score' ? 1 : 0));
    const indices = new Map(schema.map((col, i) => [col.id, i]));
    const rows = [];
    for (const bloco of prepared) {
      for (const equipe of bloco.equipes) {
        const original = linha(equipe, bloco.relatorio, bloco.columns);
        if (original.cells.length !== bloco.columns.length) throw new Error('Estrutura da linha incompatível.');
        const cells = Array(schema.length).fill(null);
        bloco.columns.forEach((col, i) => { cells[indices.get(col.id)] = original.cells[i]; });
        rows.push({ cells, score: original.score });
      }
    }
    return { schema, rows: ordenar(rows, schema, opcoes.ordenacao) };
  }
  function pagina(resposta) {
    if (!resposta || !Array.isArray(resposta.content) || typeof resposta.hasNext !== 'boolean') throw new Error('Formato de paginação do SIAPS mudou. A coleta foi interrompida para evitar dados incompletos.');
    const equipes = [];
    for (const group of resposta.content) {
      if (!Array.isArray(group.equipes)) throw new Error('Resposta do SIAPS sem lista de equipes.');
      equipes.push(...group.equipes);
    }
    if (resposta.hasNext && !equipes.length) throw new Error('O SIAPS indicou próxima página sem retornar registros.');
    return { equipes, hasNext: resposta.hasNext };
  }
  function deduplicar(equipes) {
    const map = new Map();
    for (const equipe of equipes) {
      if (equipe.coEquipe == null || String(equipe.coEquipe).trim() === '') throw new Error('O SIAPS retornou equipe sem INE. Não foi possível conferir duplicidades.');
      const key = `${equipe.sgEquipe || ''}|${equipe.coEquipe}`;
      if (map.has(key) && JSON.stringify(map.get(key)) !== JSON.stringify(equipe)) throw new Error(`Dados conflitantes para a equipe ${equipe.coEquipe}.`);
      map.set(key, equipe);
    }
    return [...map.values()];
  }
  function nomeSeguro(value) { return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 150) || 'SIAPS'; }
  function nomeGuia(value, usados) {
    const base = String(value).replace(/[\\/?*\[\]:]/g, ' ').replace(/^'+|'+$/g, '').trim().slice(0, 31) || 'Dados';
    let name = base, n = 2;
    while (usados.has(name.toLocaleLowerCase('pt-BR'))) { const suffix = `_${n++}`; name = base.slice(0, 31 - suffix.length) + suffix; }
    usados.add(name.toLocaleLowerCase('pt-BR')); return name;
  }
  function grupos(relatorios, opcoes = {}) {
    const groups = new Map();
    const unified = opcoes.unificacao?.modo === 'unificado';
    const by = unified ? (opcoes.unificacao.agruparPor || 'sequencia') : 'relatorio';
    for (const relatorio of relatorios) {
      const teams = filtrar(relatorio.equipes, opcoes);
      const local = new Map();
      for (const equipe of teams) {
        let key, label;
        if (by === 'competencia') { key = relatorio.competencia; label = formatarCompetencia(key); }
        else if (by === 'unidade') { key = `unidade:${equipe.coCnes || 'sem'}`; label = `${equipe.coCnes || 'Sem CNES'} - ${equipe.noUnidade || 'Unidade'}`; }
        else if (by === 'equipe') { key = `equipe:${equipe.coEquipe}`; label = `${equipe.coEquipe} - ${equipe.noEquipe || 'Equipe'}`; }
        else if (by === 'indicador') { key = relatorio.indicador.codigo; label = `${codigo(relatorio.indicador)} - ${relatorio.indicador.nome}`; }
        else if (by === 'relatorio') { key = `${relatorio.competencia}-${relatorio.indicador.codigo}`; label = `${codigo(relatorio.indicador)} - ${formatarCompetencia(relatorio.competencia)}`; }
        else { key = 'todos'; label = 'Relatório consolidado'; }
        if (!groups.has(key)) groups.set(key, { key, label, blocos: [] });
        if (!local.has(key)) { const bloco = { relatorio, equipes: [] }; local.set(key, bloco); groups.get(key).blocos.push(bloco); }
        local.get(key).equipes.push(equipe);
      }
    }
    return [...groups.values()];
  }
  const api = { competenciaValida, formatarCompetencia, codigo, selecao, aceita, filtrar, esquema, indicadorDaEquipe, linha, ordenar, tabela, pagina, deduplicar, nomeSeguro, nomeGuia, grupos };
  root.SiapsCore = api;
  if (typeof module === 'object') module.exports = api;
})(globalThis);
