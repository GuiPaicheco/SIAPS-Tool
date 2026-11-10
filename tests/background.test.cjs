const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function setup() {
  const data = {}, live = {}, urls = { 1: 'https://siaps.saude.gov.br/teste', 2: 'https://siaps.saude.gov.br/outro', 3: 'https://outro.saude.gov.br/' };
  let listener, updated;
  const storage = { get: async key => Object.fromEntries((Array.isArray(key) ? key : [key]).map(k => [k, structuredClone(data[k])])), set: async values => Object.assign(data, structuredClone(values)), remove: async keys => { for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key]; } };
  const chrome = {
    storage: { session: storage, local: storage },
    runtime: { id: 'test-extension', getURL: p => `chrome-extension://test-extension/${p}`, onMessage: { addListener: fn => { listener = fn; } }, sendMessage: async () => {} },
    tabs: { get: async id => ({ id, url: urls[id] }), onUpdated: { addListener: fn => { updated = fn; } }, onRemoved: { addListener() {} } },
    scripting: { executeScript: async script => {
      const tabId = script.target.tabId;
      if (script.files) { live[tabId] = { ocupado: true, disponivel: false }; return [{ documentId: `doc-${tabId}` }]; }
      if (script.world === 'MAIN') return [{ result: 'synthetic-token' }];
      if (script.func.toString().includes('ocupado:')) return [{ result: live[tabId] || { ocupado: false, disponivel: false }, documentId: `doc-${tabId}` }];
      return [{ documentId: `doc-${tabId}` }];
    } },
    downloads: { download: async () => 5, search: async () => [{ state: 'complete' }], cancel: async () => {} }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../background.js'), 'utf8'), { chrome, importScripts() {}, SiapsCore: require('../core.js'), SiapsCatalog: require('../catalog.js'), crypto: require('node:crypto').webcrypto, URL, console });
  const ui = { id: 'test-extension', url: 'chrome-extension://test-extension/popup.html?tabId=1', tab: { id: 9 } };
  const engine = tabId => ({ id: 'test-extension', tab: { id: tabId }, url: urls[tabId], frameId: 0, documentId: `doc-${tabId}` });
  const message = (m, sender = ui) => new Promise(resolve => listener(m, sender, resolve));
  return { data, live, message, engine, updated };
}
test('janela/aba da extensão pode consultar estado; páginas externas não', async () => {
  const e = setup(); const result = await e.message({ type: 'getExecution', tabId: 1 });
  assert.equal(result.estado.tabId, 1);
  assert.match((await e.message({ type: 'getExecution', tabId: 1 }, { url: 'https://siaps.saude.gov.br/', id: 'test-extension' })).erro, /interface/);
  assert.match((await e.message({ type: 'start', tabId: 3 })).erro, /Visão/);
});
test('duas abas têm jobs e estado separados; eventos antigos são rejeitados', async () => {
  const e = setup(); const a = await e.message({ type: 'start', tabId: 1 }), b = await e.message({ type: 'start', tabId: 2 });
  assert.notEqual(a.estado.jobId, b.estado.jobId);
  const wrong = await e.message({ type: 'engineEvent', jobId: b.estado.jobId, evento: 'finished', status: 'forjado' }, e.engine(1));
  assert.match(wrong.erro, /não está mais ativa/);
  assert.equal(e.data['siaps:tab:2'].emExecucao, true);
  await e.message({ type: 'engineEvent', jobId: a.estado.jobId, evento: 'finished', status: 'fim A', nivel: 'success' }, e.engine(1));
  assert.equal(e.data['siaps:tab:1'].emExecucao, false); assert.equal(e.data['siaps:tab:2'].emExecucao, true);
});
test('cliques concorrentes na mesma aba iniciam só uma execução', async () => {
  const e = setup(); const out = await Promise.all([e.message({ type: 'start', tabId: 1 }), e.message({ type: 'start', tabId: 1 })]);
  assert.equal(out.filter(x => x.estado).length, 1); assert.equal(out.filter(x => /Já há/.test(x.erro)).length, 1);
});
test('recarga invalida o documento e não aceita conclusão atrasada', async () => {
  const e = setup(); const out = await e.message({ type: 'start', tabId: 1 });
  e.updated(1, { status: 'loading' });
  await e.message({ type: 'getExecution', tabId: 1 });
  assert.equal(e.data['siaps:tab:1'].emExecucao, false);
  const late = await e.message({ type: 'engineEvent', jobId: out.estado.jobId, evento: 'finished', status: 'conclusão velha' }, e.engine(1));
  assert.ok(late.erro);
});
test('progresso não encerra operação por conter palavras de sucesso', async () => {
  const e = setup(); const out = await e.message({ type: 'start', tabId: 1 });
  await e.message({ type: 'engineEvent', jobId: out.estado.jobId, evento: 'progress', mensagem: 'Planilha gerada com sucesso.' }, e.engine(1));
  assert.equal(e.data['siaps:tab:1'].emExecucao, true);
  await e.message({ type: 'engineEvent', jobId: out.estado.jobId, evento: 'finished', status: 'Planilha consolidada gerada com sucesso.', nivel: 'success' }, e.engine(1));
  assert.equal(e.data['siaps:tab:1'].emExecucao, false);
});
test('storage não recebe token; download de URL externa é rejeitado', async () => {
  const e = setup(); const out = await e.message({ type: 'start', tabId: 1 });
  const token = await e.message({ type: 'getAccessToken', jobId: out.estado.jobId }, e.engine(1)); assert.equal(token.token, 'synthetic-token');
  assert.equal(JSON.stringify(e.data).includes('synthetic-token'), false);
  const dl = await e.message({ type: 'download', jobId: out.estado.jobId, url: 'https://exemplo.com/a.xlsx', filename: 'SIAPS_A.xlsx' }, e.engine(1));
  assert.match(dl.erro, /inválido/);
});
