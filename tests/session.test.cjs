const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function session(values, fetch) {
  const storage = new Map(Object.entries(values));
  const ctx = { sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }, fetch, AbortSignal, console };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../session.js'), 'utf8'), ctx);
  return { read: ctx.lerSessaoSiaps, storage, ctx };
}
test('leitura ausente é distinta de sessão expirada; falha de storage é erro técnico', async () => {
  const s = session({}, () => assert.fail('não deve consultar sem sessão'));
  assert.equal((await s.read()).estado, 'ausente');
  s.ctx.sessionStorage.getItem = () => { throw new Error('storage indisponível'); };
  assert.equal((await s.read()).estado, 'erro_leitura');
});
test('renova via serviço oficial e atualiza as mesmas chaves utilizadas pelo SIAPS', async () => {
  let calls = 0;
  const s = session({ access_token: 'antigo', refresh_token: 'refresh', expires_in: '1' }, async (url, init) => {
    calls++; assert.equal(url, 'https://apiautenticacao-aps.saude.gov.br/auth/refresh-token');
    assert.deepEqual(JSON.parse(init.body), { 'refresh-token': 'refresh', programa: 'jKoa0KgJB' });
    return Response.json({ access_token: 'novo', refresh_token: 'refresh-novo', expires_in: 300, refresh_expires_in: 900 });
  });
  const result = await s.read({ renovar: true }); assert.equal(result.token, 'novo'); assert.equal(result.estado, 'renovada');
  assert.equal(s.storage.get('refresh_token'), 'refresh-novo'); assert.ok(Number(s.storage.get('expires_in')) > Date.now()); assert.equal(calls, 1);
});
test('duas consultas compartilham uma renovação em andamento', async () => {
  let calls = 0;
  const s = session({ access_token: 'old', refresh_token: 'refresh', expires_in: '1' }, async () => {
    calls++; await new Promise(resolve => setTimeout(resolve, 5)); return Response.json({ access_token: 'new', expires_in: 300 });
  });
  const out = await Promise.all([s.read({ renovar: true }), s.read({ renovar: true })]);
  assert.equal(calls, 1); assert.ok(out.every(x => x.token === 'new'));
});
test('token atualizado pelo SIAPS não é sobrescrito por renovação concorrente', async () => {
  const s = session({ access_token: 'old', refresh_token: 'refresh', expires_in: '1' }, async () => {
    s.storage.set('access_token', 'atualizado-pelo-siaps'); return Response.json({ access_token: 'resposta-antiga', expires_in: 300 });
  });
  assert.equal((await s.read({ renovar: true })).token, 'atualizado-pelo-siaps');
});
test('logout durante renovação não restaura uma sessão que o usuário encerrou', async () => {
  const s = session({ access_token: 'old', refresh_token: 'refresh', expires_in: '1' }, async () => {
    s.storage.delete('access_token'); s.storage.delete('refresh_token'); return Response.json({ access_token: 'não-restaurar', refresh_token: 'novo' });
  });
  const out = await s.read({ renovar: true });
  assert.equal(out.estado, 'login_necessario'); assert.equal(s.storage.has('access_token'), false);
});
test('403 significa falta de autorização, sem concluir que a sessão expirou', async () => {
  let count = 0;
  const s = session({ access_token: 'valido' }, async () => { count++; return new Response('', { status: 403 }); });
  assert.equal((await s.read({ verificar: true, renovar: true })).estado, 'sem_permissao'); assert.equal(count, 1);
});
test('401 tenta renovação uma vez e verifica a API com o novo token', async () => {
  const calls = [];
  const s = session({ access_token: 'old', refresh_token: 'refresh' }, async (url, init) => {
    calls.push(url);
    if (url.includes('refresh-token')) return Response.json({ access_token: 'new', expires_in: 300 });
    return init.headers.Authorization === 'Bearer new' ? Response.json(['eSF']) : new Response('', { status: 401 });
  });
  const out = await s.read({ verificar: true, renovar: true });
  assert.equal(out.estado, 'conectada'); assert.equal(calls.length, 3); assert.equal(calls.filter(x => x.includes('refresh-token')).length, 1);
});
test('rede indisponível não é confundida com sessão expirada nem apaga o acesso', async () => {
  const s = session({ access_token: 'old', refresh_token: 'refresh' }, async () => { throw new Error('rede'); });
  assert.equal((await s.read({ renovar: true, forcar: true })).estado, 'servico_indisponivel');
  assert.equal(s.storage.get('access_token'), 'old');
});
test('renovação antecipada recusada não impede usar um token que a API ainda aceita', async () => {
  const s = session({ access_token: 'valido', refresh_token: 'old-refresh', expires_in: '1' }, async url => url.includes('refresh-token') ? new Response('', { status: 400 }) : Response.json(['eSF']));
  assert.equal((await s.read({ renovar: true, verificar: true })).estado, 'conectada');
});
