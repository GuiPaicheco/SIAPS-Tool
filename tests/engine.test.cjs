const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../core.js'), catalog = require('../catalog.js');
function engine(handler, getToken = () => 'token-sintetico') {
  const events = [], calls = [], downloads = [];
  let active = 0, maxActive = 0;
  const ctx = {
    SiapsCore: core, SiapsCatalog: catalog, SiapsExcel: { criarWorkbook: () => ({ xlsx: { writeBuffer: async () => new Uint8Array([1, 2, 3]) } }) },
    AbortSignal, AbortController, DOMException, TextEncoder, Uint8Array, crypto: require('node:crypto').webcrypto, atob, Blob, URL, URLSearchParams, setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 5)), clearTimeout,
    chrome: { runtime: { sendMessage: async m => {
      if (m.type === 'getAccessToken') return { token: getToken() };
      if (m.type === 'engineEvent') { events.push(m); return {}; }
      if (m.type === 'download') { downloads.push(m); return { downloadId: downloads.length }; }
      if (m.type === 'downloadStatus') return { state: 'complete' };
      throw new Error(m.type);
    } } },
    fetch: async (url, init) => {
      calls.push(String(url)); active++; maxActive = Math.max(maxActive, active);
      try { return await handler(new URL(url), init, calls); } finally { active--; }
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8'), ctx);
  return { api: ctx.__SIAPS_TOOL_ENGINE__, events, calls, downloads, max: () => maxActive };
}
const options = { competencias: ['202606'], indicadores: { modo: 'selecionados', valores: ['C1', 'C2'] } };
function response(url) {
  if (url.pathname.includes('tipos-equipes')) return Response.json(['eSF']);
  if (url.pathname.includes('/variaveis')) return Response.json([{ noParametro: 'TOTAL', descricao: 'Atendimentos' }]);
  const id = Number(url.searchParams.get('indicadores'));
  return Response.json({ content: [{ equipes: [{ coCnes: '001', coEquipe: '0001', sgEquipe: 'eSF', noEquipe: 'Exemplo', indicadores: [{ coIndicador: id, score: 10, scoreFormatado: '10,00', variaveis: { TOTAL: 2 } }] }] }], hasNext: false });
}
test('falha total não é disponibilizada como consolidação nem guardada como sucesso', async () => {
  const e = engine(url => url.pathname.includes('visao-competencia') ? new Response('', { status: 500 }) : response(url));
  await e.api.executar('consolidar', options, 'a');
  const finish = e.events.at(-1); assert.equal(finish.evento, 'finished'); assert.equal(finish.consolidacao, null); assert.equal(finish.pendencias.length, 2);
  const before = e.calls.length; await e.api.executar('consolidar', options, 'b'); assert.ok(e.calls.length > before);
  assert.equal(e.api.ocupado(), false);
});
test('retry incremental só busca falhas; concorrência é limitada e cache independe do formato', async () => {
  let fail = true;
  const e = engine(async url => {
    await new Promise(resolve => setTimeout(resolve, 2));
    if (fail && url.pathname.includes('visao-competencia') && url.searchParams.get('indicadores') === '108') return new Response('', { status: 400 });
    return response(url);
  });
  await e.api.executar('consolidar', options, 'a'); assert.equal(e.events.at(-1).consolidacao.parcial, true);
  const c1 = () => e.calls.filter(x => x.includes('visao-competencia') && x.includes('indicadores=110')).length;
  const before = c1(); fail = false;
  await e.api.executar('consolidar', options, 'b');
  assert.equal(c1(), before); assert.equal(e.events.at(-1).consolidacao.parcial, false); assert.ok(e.max() <= 2);
  const analytic = e.api.preview({ modoDados: 'analitico', unificacao: { modo: 'unificado' } });
  const full = e.api.preview({ modoDados: 'completo', unificacao: { modo: 'unificado' } });
  assert.equal(analytic.amostra.colunas.length, 10); assert.ok(full.amostra.colunas.length > 10);
  const count = e.calls.length; await e.api.executar('exportar', { modoDados: 'completo', unificacao: { modo: 'unificado' } }, 'c');
  assert.equal(e.calls.length, count); assert.equal(e.downloads.length, 1); assert.equal(e.events.at(-1).nivel, 'success'); assert.equal(e.api.ocupado(), false);
});
test('HTTP 401 só repete uma vez após renovação; não usa fallback conhecido para M2', async () => {
  const e = engine(() => new Response('', { status: 401 }));
  await e.api.executar('consolidar', { ...options, indicadores: { modo: 'selecionados', valores: ['M2'] } }, 'a');
  assert.equal(e.calls.length, 2); assert.equal(e.events.at(-1).nivel, 'warning'); assert.match(e.events.at(-1).status, /sessão/);
});
test('JWT que parece expirado pelo relógio local não bloqueia uma API que o aceita', async () => {
  const jwt = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({ sub: 'teste', iss: 'siaps', exp: 1 })).toString('base64url')}.assinatura-sintetica`;
  const e = engine(response, () => jwt);
  await e.api.executar('consolidar', options, 'a'); assert.equal(e.events.at(-1).nivel, 'success');
});
test('falha técnica na leitura não é apresentada como sessão expirada', async () => {
  const e = engine(response, () => null);
  await e.api.executar('consolidar', options, 'a'); assert.doesNotMatch(e.events.at(-1).status, /expirou|expirada/);
});
test('download parcial exige consentimento e nome explícito; sucesso unificado sempre termina', async () => {
  const e = engine(url => url.pathname.includes('visao-competencia') && url.searchParams.get('indicadores') === '108' ? new Response('', { status: 400 }) : response(url));
  await e.api.executar('consolidar', options, 'a');
  await e.api.executar('exportar', { unificacao: { modo: 'unificado' } }, 'b');
  assert.equal(e.downloads.length, 0);
  await e.api.executar('exportar', { aceitarParcial: true, unificacao: { modo: 'unificado' } }, 'c');
  assert.match(e.downloads[0].filename, /^SIAPS_PARCIAL_/); assert.equal(e.events.at(-1).evento, 'finished'); assert.equal(e.api.ocupado(), false);
});
test('ausência de biblioteca interna webpack não interfere; erro termina via evento estruturado', async () => {
  const e = engine(() => { throw new Error('rede simulada indisponível'); });
  await e.api.executar('consolidar', { ...options, indicadores: { modo: 'selecionados', valores: ['C1'] } }, 'a');
  assert.equal(e.events.at(-1).evento, 'finished'); assert.equal(e.api.ocupado(), false);
});
test('detecta página repetida e consulta fica parcial', async () => {
  const e = engine(url => {
    const r = response(url);
    if (!url.pathname.includes('visao-competencia')) return r;
    return r.json().then(body => Response.json({ ...body, hasNext: true }));
  });
  await e.api.executar('consolidar', { ...options, indicadores: { modo: 'selecionados', valores: ['C1'] } }, 'a');
  assert.match(e.events.at(-1).pendencias[0].erro, /repetiu/);
});
test('cancelamento aborta chamadas pendentes e sempre libera execução', async () => {
  const e = engine((url, init) => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })));
  const pending = e.api.executar('consolidar', options, 'a');
  await new Promise(resolve => setTimeout(resolve, 10)); e.api.cancelar(); await pending;
  assert.equal(e.api.ocupado(), false); assert.equal(e.events.at(-1).evento, 'finished'); assert.match(e.events.at(-1).status, /interrompida/);
});
test('troca de conta não permite exportar resultado da sessão anterior', async () => {
  let token = 'conta-A'; const e = engine(response, () => token);
  await e.api.executar('consolidar', options, 'a'); token = 'conta-B';
  await e.api.executar('exportar', { unificacao: { modo: 'unificado' } }, 'b');
  assert.equal(e.downloads.length, 0); assert.equal(e.events.at(-1).nivel, 'warning'); assert.equal(e.events.at(-1).invalidar, true);
});
test('atualização que falha remove a versão antiga daquele relatório do cache', async () => {
  let fail = false;
  const e = engine(url => fail && url.pathname.includes('visao-competencia') ? new Response('', { status: 400 }) : response(url));
  await e.api.executar('consolidar', options, 'a'); fail = true;
  await e.api.executar('consolidar', { ...options, atualizar: true }, 'b');
  assert.equal(e.events.at(-1).consolidacao, null);
  const before = e.calls.length;
  await e.api.executar('consolidar', options, 'c');
  assert.ok(e.calls.length > before); assert.equal(e.events.at(-1).consolidacao, null);
});
