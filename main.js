/* Mundo ISOLATED: o SIAPS não recebe acesso ao cache nem às funções da extensão. */
(() => {
  'use strict';
  const config = globalThis.__SIAPS_TOOL_CONFIG__;
  delete globalThis.__SIAPS_TOOL_CONFIG__;
  if (!globalThis.__SIAPS_TOOL_ENGINE__) {
    const C = globalThis.SiapsCore, TTL = 15 * 60 * 1000, LIMITE_CACHE = 30 * 1024 * 1024;
    const cache = new Map(), metadados = new Map();
    let consolidacao = null, contexto = null, execucao = null;
    const send = message => chrome.runtime.sendMessage(message);
    const check = () => execucao?.controller.signal.throwIfAborted();
    const sleep = ms => new Promise((resolve, reject) => {
      const signal = execucao.controller.signal; signal.throwIfAborted();
      const abort = () => { clearTimeout(timer); reject(signal.reason); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
      signal.addEventListener('abort', abort, { once: true });
    });
    const event = (evento, value = {}) => send({ type: 'engineEvent', jobId: execucao.jobId, evento, ...value });
    async function token() {
      check();
      const result = await send({ type: 'getAccessToken', jobId: execucao.jobId });
      if (result.erro || !result.token) throw Object.assign(new Error('Sua sessão terminou. Entre novamente no SIAPS e tente as pendências.'), { auth: true });
      let exp;
      try { exp = JSON.parse(atob(result.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp; } catch { /* Token opaco: o servidor valida a expiração. */ }
      if (exp && Number(exp) * 1000 <= Date.now()) throw Object.assign(new Error('Sua sessão expirou. Entre novamente no SIAPS e tente as pendências.'), { auth: true });
      return result.token;
    }
    async function identidade(value) {
      let key = value;
      try {
        const payload = JSON.parse(atob(value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload.sub && payload.iss) key = JSON.stringify([payload.iss, payload.sub, payload.sid || payload.session_state || '', payload.azp || '', payload.scope || '', payload.realm_access || {}, payload.resource_access || {}]);
      } catch { /* Token opaco: comparar hash, sem persistir o token. */ }
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
      return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
    }
    async function validarContexto(value, novaConsulta = false) {
      const atual = await identidade(value);
      if (contexto && atual !== contexto) {
        cache.clear(); metadados.clear(); consolidacao = null; contexto = atual;
        if (!novaConsulta) throw Object.assign(new Error('A conta ou sessão do SIAPS mudou. Consulte os dados novamente.'), { auth: true });
      }
      contexto = atual;
    }
    async function request(path) {
      for (let tentativa = 1; tentativa <= 3; tentativa++) {
        check();
        const accessToken = await token(); await validarContexto(accessToken);
        const contextoDaChamada = contexto;
        const signal = AbortSignal.any([execucao.controller.signal, AbortSignal.timeout(30000)]);
        try {
          const response = await fetch(`https://apisiaps.saude.gov.br/${path}`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }, signal });
          if (response.status === 401 || response.status === 403) throw Object.assign(new Error('Sua sessão terminou ou não permite esta consulta. Entre novamente no SIAPS.'), { auth: true, status: response.status });
          if (response.ok) {
            const body = await response.json();
            if (contextoDaChamada !== contexto) throw Object.assign(new Error('A sessão mudou durante a consulta. Consulte novamente.'), { auth: true });
            return body;
          }
          const error = Object.assign(new Error(`O SIAPS respondeu HTTP ${response.status}.`), { status: response.status });
          if (![429, 500, 502, 503, 504].includes(response.status) || tentativa === 3) throw error;
          const retry = response.headers.get('Retry-After');
          const parsed = retry ? (Number.isFinite(Number(retry)) ? Number(retry) * 1000 : Date.parse(retry) - Date.now()) : 0;
          await sleep(Math.min(60000, Math.max(1000 * 2 ** (tentativa - 1) + Math.random() * 300, parsed || 0)));
        } catch (error) {
          if (execucao.controller.signal.aborted || error.auth || error.status || error instanceof SyntaxError || tentativa === 3) throw error;
          await sleep(1000 * 2 ** (tentativa - 1));
        }
      }
    }
    function guardar(chave, relatorio) {
      const bytes = JSON.stringify(relatorio).length * 2;
      if (bytes > LIMITE_CACHE) return;
      cache.delete(chave); cache.set(chave, { relatorio, bytes, time: Date.now() });
      let total = [...cache.values()].reduce((n, item) => n + item.bytes, 0);
      for (const [key, item] of cache) {
        if (total <= LIMITE_CACHE && cache.size <= 128) break;
        cache.delete(key); total -= item.bytes;
      }
    }
    async function estrutura(indicador) {
      const key = String(indicador.id), old = metadados.get(key);
      if (old && Date.now() - old.time < TTL) return old.promise;
      const promise = (async () => {
        let tipos;
        try { tipos = await request(`api/public/filtros/tipos-equipes?indicadores=${indicador.id}`); }
        catch (error) {
          if (error.status !== 500 || ![118, 128].includes(indicador.id)) throw error;
          tipos = [indicador.id === 118 ? 'eMulti' : 'eAPP'];
        }
        if (!Array.isArray(tipos) || !tipos.length || tipos.some(t => typeof t !== 'string')) throw new Error('Tipos de equipe retornados pelo SIAPS são inválidos.');
        const variaveis = await request(`api/public/filtros/variaveis?indicador=${indicador.id}`);
        if (!Array.isArray(variaveis) || !variaveis.length) throw new Error('O SIAPS não retornou a estrutura das variáveis.');
        C.esquema(variaveis, indicador.id); return { tipos, variaveis };
      })();
      metadados.set(key, { time: Date.now(), promise });
      try { return await promise; } catch (error) { metadados.delete(key); throw error; }
    }
    async function equipes(indicador, competencia, tipos) {
      const todas = [];
      for (const tipo of tipos) {
        const paginas = new Set();
        for (let page = 0; ; page++) {
          if (page >= 500) throw new Error('Limite de páginas excedido. Divida a consulta.');
          const params = new URLSearchParams({ page: String(page), size: '100', search: '', sort: 'string', competencias: competencia, coMunicipioIbge: '310670', sgEquipes: tipo, indicadores: String(indicador.id) });
          const result = C.pagina(await request(`componente/qualidade/visao-competencia?${params}`));
          const fingerprint = JSON.stringify(result.equipes.map(e => [e.sgEquipe, e.coEquipe]));
          if (result.equipes.length && paginas.has(fingerprint)) throw new Error('O SIAPS repetiu uma página. Consulta interrompida para evitar duplicação.');
          paginas.add(fingerprint); todas.push(...result.equipes);
          if (!result.hasNext) break;
        }
      }
      const result = C.deduplicar(todas);
      for (const equipe of result) C.indicadorDaEquipe(equipe, indicador.id);
      return result;
    }
    function opcoes(relatorios) {
      const units = new Map(), teams = new Map();
      for (const r of relatorios) for (const e of r.equipes) {
        if (e.coCnes != null) units.set(String(e.coCnes), { valor: String(e.coCnes), rotulo: e.noUnidade || 'Unidade sem nome' });
        const key = `${e.coEquipe}:${e.coCnes}`;
        teams.set(key, { valor: String(e.coEquipe), rotulo: e.noEquipe || 'Equipe sem nome', unidade: String(e.coCnes ?? ''), tipo: e.sgEquipe || '' });
      }
      return { unidades: [...units.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR')), equipes: [...teams.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR')) };
    }
    async function consolidar(options) {
      const periodos = [...new Set(options.competencias || [])];
      if (!periodos.length || periodos.length > 36 || !periodos.every(C.competenciaValida)) throw new Error('Escolha de 1 a 36 meses válidos.');
      const selected = C.selecao(options.indicadores);
      const indicadores = globalThis.SiapsCatalog.filter(i => C.aceita(selected, i.codigo));
      if (!indicadores.length) throw new Error('Selecione ao menos um indicador.');
      await validarContexto(await token(), true);
      consolidacao = null;
      const contextoDaConsulta = contexto;
      if (options.atualizar) metadados.clear();
      const tasks = periodos.flatMap(competencia => indicadores.map(indicador => ({ competencia, indicador })));
      const relatorios = [], falhas = [], inicio = Date.now();
      let cursor = 0, concluidos = 0, fatal = null, reutilizados = 0, bytesAtivos = 0;
      async function worker() {
        while (cursor < tasks.length && !fatal && !execucao.controller.signal.aborted) {
          const { competencia, indicador } = tasks[cursor++], key = `${competencia}:${indicador.id}`;
          try {
            const old = cache.get(key); let relatorio;
            if (!options.atualizar && old && Date.now() - old.time < TTL) { relatorio = old.relatorio; reutilizados++; }
            else {
              cache.delete(key); // Atualização com falha não pode ressuscitar um sucesso antigo.
              const { tipos, variaveis } = await estrutura(indicador);
              relatorio = { competencia, indicador, tipos, variaveis, equipes: await equipes(indicador, competencia, tipos), consultadoEm: new Date().toISOString() };
              guardar(key, relatorio);
            }
            const bytes = JSON.stringify(relatorio).length * 2;
            if (bytesAtivos + bytes > 50 * 1024 * 1024) {
              const error = new Error('Limite de memória da consulta atingido. Divida o período em lotes menores.');
              fatal = error; throw error;
            }
            bytesAtivos += bytes;
            relatorios.push(relatorio);
          } catch (error) {
            if (execucao.controller.signal.aborted) throw error;
            falhas.push({ competencia, codigo: indicador.codigo, erro: error.message });
            if (error.auth) fatal = error;
          }
          concluidos++;
          await event('progress', { mensagem: `${C.codigo(indicador)} · ${C.formatarCompetencia(competencia)}: ${concluidos} de ${tasks.length} consultas verificadas.`, progresso: { atual: concluidos, total: tasks.length } });
        }
      }
      await Promise.allSettled([worker(), worker()]);
      if (contextoDaConsulta !== contexto) throw Object.assign(new Error('A conta ou sessão mudou durante a consulta. Consulte os dados novamente.'), { auth: true });
      const processed = new Set([...relatorios.map(r => `${r.competencia}:${r.indicador.codigo}`), ...falhas.map(r => `${r.competencia}:${r.codigo}`)]);
      for (const t of tasks) if (!processed.has(`${t.competencia}:${t.indicador.codigo}`)) falhas.push({ competencia: t.competencia, codigo: t.indicador.codigo, erro: execucao.controller.signal.aborted ? 'Consulta interrompida pelo usuário.' : fatal?.auth ? 'Consulta não iniciada; entre novamente no SIAPS.' : fatal?.message || 'Consulta não concluída. Tente novamente.' });
      const cancelled = execucao.controller.signal.aborted;
      const records = relatorios.reduce((n, r) => n + r.equipes.length, 0);
      relatorios.sort((a, b) => a.competencia.localeCompare(b.competencia) || a.indicador.codigo.localeCompare(b.indicador.codigo, 'pt-BR', { numeric: true }));
      const opts = opcoes(relatorios);
      const resumo = {
        competencias: periodos, indicadoresCodigos: indicadores.map(i => i.codigo), indicadores: relatorios.length,
        solicitados: tasks.length, concluidos: relatorios.length, falhas, parcial: falhas.length > 0,
        semDados: relatorios.filter(r => !r.equipes.length).map(r => ({ competencia: r.competencia, codigo: r.indicador.codigo })),
        unidades: opts.unidades.length, equipes: opts.equipes.length, registros: records, reutilizados,
        consultadoEm: relatorios.map(r => r.consultadoEm).sort()[0] || new Date().toISOString(),
        camposOrdenacao: [...new Map(relatorios.flatMap(r => C.esquema(r.variaveis, r.indicador.id)).map(col => [col.id, { valor: col.id, rotulo: col.titulo }])).values()]
      };
      consolidacao = { relatorios, resumo, opcoes: opts };
      await event('finished', { consolidacao: records ? resumo : null, pendencias: falhas, opcoes: opts, nivel: falhas.length || cancelled ? 'warning' : 'success', status: cancelled ? 'Consulta interrompida. Continue para reaproveitar os dados já consultados.' : fatal ? fatal.message : falhas.length ? `${relatorios.length} de ${tasks.length} consultas disponíveis. Confira as pendências.` : records ? 'Dados consultados. Confira os filtros e prepare seu Excel.' : 'Não há dados para os meses e indicadores escolhidos.', segundos: (Date.now() - inicio) / 1000 });
    }
    function preview(options) {
      if (!consolidacao) throw new Error('Consulte os dados novamente nesta aba do SIAPS.');
      const groups = C.grupos(consolidacao.relatorios, options);
      const registros = groups.reduce((n, g) => n + g.blocos.reduce((sum, b) => sum + b.equipes.length, 0), 0);
      let restantes = 5;
      const sample = groups.length ? C.tabela(groups[0].blocos.map(b => {
        const count = Math.min(restantes, b.equipes.length); restantes -= count;
        return { ...b, equipes: b.equipes.slice(0, count) };
      }), options) : null;
      return { arquivos: options.unificacao?.modo === 'unificado' ? Number(groups.length > 0) : groups.length, registros, guias: groups.length, amostra: sample ? { colunas: sample.schema.map(c => c.titulo), linhas: sample.rows.slice(0, 5).map(r => r.cells) } : null };
    }
    async function baixar(buffer, filename) {
      check();
      const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      try {
        const result = await send({ type: 'download', jobId: execucao.jobId, url, filename });
        if (result.erro) throw new Error(result.erro);
        const started = Date.now();
        for (;;) {
          check();
          const state = await send({ type: 'downloadStatus', jobId: execucao.jobId, downloadId: result.downloadId });
          if (state.erro || state.state === 'interrupted') throw new Error('O Chrome interrompeu o download. Verifique a lista de downloads e tente novamente.');
          if (state.state === 'complete') return;
          if (Date.now() - started > 5 * 60 * 1000) throw new Error('O download ainda não foi confirmado. Verifique a lista de downloads do Chrome.');
          await sleep(750);
        }
      } finally { URL.revokeObjectURL(url); }
    }
    async function exportar(options) {
      if (!consolidacao) throw new Error('A consulta não está mais disponível nesta aba.');
      await validarContexto(await token());
      const snapshot = consolidacao;
      if (snapshot.resumo.parcial && !options.aceitarParcial) throw new Error('Confira as pendências e confirme a exportação parcial.');
      const groups = C.grupos(snapshot.relatorios, options);
      if (!groups.length) throw new Error('Selecione ao menos uma unidade e equipe com registros.');
      const unified = options.unificacao?.modo === 'unificado', files = unified ? [groups] : groups.map(group => [group]);
      const started = Date.now();
      for (let i = 0; i < files.length; i++) {
        check();
        await validarContexto(await token());
        await event('progress', { mensagem: `Preparando arquivo ${i + 1} de ${files.length}…`, progresso: { atual: i, total: files.length } });
        const wb = globalThis.SiapsExcel.criarWorkbook(files[i], options, snapshot.resumo);
        const buffer = await wb.xlsx.writeBuffer(); check();
        await validarContexto(await token());
        const label = unified ? `CONSOLIDADO_${snapshot.resumo.competencias.join('_')}` : files[i][0].key;
        await baixar(buffer, `SIAPS_${snapshot.resumo.parcial ? 'PARCIAL_' : ''}${C.nomeSeguro(label)}.xlsx`);
        await event('progress', { mensagem: `Download confirmado: ${i + 1} de ${files.length}.`, progresso: { atual: i + 1, total: files.length } });
        await sleep(0);
      }
      await event('finished', { status: `${files.length} arquivo(s) baixado(s). Confira a pasta de downloads do Chrome.`, nivel: 'success', segundos: (Date.now() - started) / 1000 });
    }
    async function executar(op, options, jobId) {
      if (execucao) throw new Error('Já há uma operação nesta aba.');
      execucao = { jobId, controller: new AbortController() };
      try { await (op === 'exportar' ? exportar(options) : consolidar(options)); }
      catch (error) {
        await event('finished', { status: execucao.controller.signal.aborted ? 'Operação interrompida. Os dados consultados continuam nesta aba.' : error.auth ? error.message : `Não foi possível concluir: ${error.message}`, nivel: error.auth || execucao.controller.signal.aborted ? 'warning' : 'error', invalidar: !consolidacao });
      } finally { execucao = null; }
    }
    globalThis.__SIAPS_TOOL_ENGINE__ = { preview, executar, cancelar() { execucao?.controller.abort(new DOMException('Operação interrompida.', 'AbortError')); }, disponivel: () => Boolean(consolidacao), ocupado: () => Boolean(execucao) };
  }
  if (config) void globalThis.__SIAPS_TOOL_ENGINE__.executar(config.operacao, config.opcoes, config.jobId);
})();
