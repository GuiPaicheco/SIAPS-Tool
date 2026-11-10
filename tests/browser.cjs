/* Chrome real + extensão real; SIAPS/API inteiramente simulados, sem credenciais reais. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ExcelJS = require('exceljs');
const { unzipSync } = require('fflate');
const root = path.resolve(__dirname, '..');
async function run() {
  fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
  let extensionRoot = root;
  if (process.argv.includes('--package')) {
    extensionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'siaps-package-'));
    const version = require('../manifest.json').version;
    const files = unzipSync(fs.readFileSync(path.join(root, `dist/SIAPS-TOOL-${version}.zip`)));
    for (const [name, bytes] of Object.entries(files)) {
      const target = path.resolve(extensionRoot, name);
      if (!target.startsWith(extensionRoot + path.sep)) throw new Error('Caminho inválido no pacote.');
      fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes);
    }
  }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'siaps-test-'));
  const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, acceptDownloads: true, args: [`--disable-extensions-except=${extensionRoot}`, `--load-extension=${extensionRoot}`], viewport: { width: 1000, height: 900 } });
  const errors = [], calls = []; let failC2 = true, slow = false, authRequests = 0;
  context.on('page', p => p.on('pageerror', e => errors.push(e.message)));
  try {
    await context.route('https://siaps.saude.gov.br/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>SIAPS simulado</title><h1>Visão por Competência — teste sintético</h1><script>sessionStorage.setItem("access_token","token-sintetico-sem-acesso-real");sessionStorage.setItem("refresh_token","renovacao-sintetica");sessionStorage.setItem("expires_in","1")</script>' }));
    await context.route('https://apiautenticacao-aps.saude.gov.br/**', route => {
      const headers = { 'access-control-allow-origin': 'https://siaps.saude.gov.br', 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'POST' };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      authRequests++;
      return route.fulfill({ headers, json: { access_token: 'token-sintetico-renovado', refresh_token: 'renovacao-sintetica', expires_in: 300, refresh_expires_in: 900 } });
    });
    await context.route('https://apisiaps.saude.gov.br/**', async route => {
      const url = new URL(route.request().url());
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': 'https://siaps.saude.gov.br', 'access-control-allow-headers': 'authorization,accept', 'access-control-allow-methods': 'GET' } });
      calls.push(url.href);
      if (slow) await new Promise(resolve => setTimeout(resolve, 1200));
      const headers = { 'access-control-allow-origin': 'https://siaps.saude.gov.br' };
      const id = Number(url.searchParams.get('indicadores') || url.searchParams.get('indicador'));
      let body;
      if (url.pathname === '/usuario/info') body = { perfil: 'sintetico' };
      else if (url.pathname.includes('tipos-equipes')) body = ['eSF'];
      else if (url.pathname.includes('/variaveis')) body = [{ noParametro: 'TOTAL', descricao: 'Total de atendimentos' }, { noParametro: 'PONTUACAO', descricao: 'Numerador/Denominador' }];
      else {
        if (id === 108 && failC2) return route.fulfill({ status: 400, headers, body: 'Falha sintética' });
        body = { content: [{ equipes: [90, 10].map((score, index) => ({ coCnes: '0012345', noUnidade: 'UBS Exemplo', coEquipe: `000000${index + 1}`, noEquipe: `Equipe Exemplo ${index + 1}`, sgEquipe: 'eSF', indicadores: [{ coIndicador: id, score, scoreFormatado: `${score},00`, scoreClassificacao: 'BOM', numerador: 3, denominador: 4, variaveis: { TOTAL: 5 } }] })) }], hasNext: false, total: 2 };
      }
      await route.fulfill({ headers, json: body });
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    console.log('Extensão:', worker.url());
    for (let i = 0; i < 40; i++) {
      if (await worker.evaluate(() => typeof globalThis.chrome?.tabs?.query === 'function')) break;
      await new Promise(resolve => setTimeout(resolve, 100));
      if (i === 39) throw new Error('APIs da extensão indisponíveis: ' + await worker.evaluate(() => JSON.stringify({ keys: Object.getOwnPropertyNames(globalThis), chrome: Object.keys(globalThis.chrome || {}) })));
    }
    const extensionId = new URL(worker.url()).host;
    const siaps = await context.newPage(); await siaps.goto('https://siaps.saude.gov.br/visao-competencia');
    const downloadPath = path.join(root, 'test-results/downloads'); fs.mkdirSync(downloadPath, { recursive: true });
    const cdp = await context.newCDPSession(siaps);
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath, eventsEnabled: true });
    const tabId = await worker.evaluate(async () => (await chrome.tabs.query({})).find(t => t.url?.includes('siaps.saude.gov.br')).id);
    let ui = await context.newPage();
    await ui.goto(`chrome-extension://${extensionId}/popup.html?tabId=${tabId}`);
    await ui.locator('#consolidar:enabled').waitFor();
    console.log('Interface inicializada.');
    await ui.locator('#verificarSessao').click();
    await ui.locator('#sessionBadge').filter({ hasText: 'Conexão confirmada' }).waitFor();
    assert.equal(authRequests, 1, 'deve renovar a sessão sintética pelo serviço oficial simulado');
    await ui.locator('#competenciasSelecionadas button').click();
    await ui.locator('#competencia').fill('2026-06'); await ui.locator('#adicionarCompetencia').click();
    await ui.locator('#indicatorSelect summary').click();
    await ui.locator('#indicatorSelect').getByRole('button', { name: 'Nenhum', exact: true }).click();
    await ui.getByLabel('eSF/eAP1 — Mais Acesso à Atenção Primária à Saúde', { exact: true }).check();
    await ui.getByLabel('eSF/eAP2 — Desenvolvimento Infantil', { exact: true }).check();
    await ui.locator('#indicatorSelect summary').click();
    await ui.locator('#consolidar').click();
    await ui.locator('#resultSection:not([hidden])').waitFor();
    await ui.locator('#selectionCount').filter({ hasText: '2 registro(s)' }).waitFor();
    assert.match(await ui.locator('#consolidationSummary').innerText(), /Resultado parcial/);
    assert.equal(await ui.locator('#baixar').isDisabled(), true);
    await ui.locator('#aceitarParcial').check();
    await ui.locator('#baixar:enabled').waitFor();
    async function ultimoDownload() {
      return worker.evaluate(async tabId => {
        const state = (await chrome.storage.session.get(`siaps:tab:${tabId}`))[`siaps:tab:${tabId}`];
        return (await chrome.downloads.search({ id: state.downloads.at(-1) }))[0];
      }, tabId);
    }
    await ui.locator('#baixar').click();
    await ui.locator('#statusMessage').filter({ hasText: 'arquivo(s) baixado(s)' }).waitFor({ timeout: 30000 });
    // O gerenciador de downloads do Playwright pode trocar o nome por UUID.
    const partial = await ultimoDownload(); assert.equal(partial.state, 'complete');
    const partialWb = new ExcelJS.Workbook(); await partialWb.xlsx.readFile(partial.filename);
    assert.ok(partialWb.getWorksheet('Pendências'));
    console.log('Coleta parcial e download confirmados.');
    // Reabrir é parte do fluxo normal e precisa restaurar filtros e dados.
    await ui.close(); ui = await context.newPage(); await ui.goto(`chrome-extension://${extensionId}/popup.html?tabId=${tabId}`);
    await ui.locator('#resultSection:not([hidden])').waitFor();
    const c1Before = calls.filter(u => u.includes('visao-competencia') && u.includes('indicadores=110')).length;
    failC2 = false;
    await ui.locator('#tentarNovamente').click();
    await ui.locator('#consolidationSummary').filter({ hasText: 'Consulta completa' }).waitFor();
    await ui.locator('#baixar:enabled').waitFor();
    assert.equal(calls.filter(u => u.includes('visao-competencia') && u.includes('indicadores=110')).length, c1Before, 'C1 deve vir do cache incremental');
    console.log('Reabrir e retry incremental confirmados.');
    // Nenhum significa zero também no caminho completo do navegador.
    await ui.locator('#unitSelect summary').click(); await ui.locator('#unitSelect').getByRole('button', { name: 'Nenhum', exact: true }).click();
    await ui.locator('#selectionCount').filter({ hasText: '0 registro(s)' }).waitFor(); assert.equal(await ui.locator('#baixar').isDisabled(), true);
    await ui.locator('#unitSelect').getByRole('button', { name: 'Todos', exact: true }).click(); await ui.locator('#unitSelect summary').click();
    await ui.locator('#selectionCount').filter({ hasText: '4 registro(s)' }).waitFor();
    await ui.locator('#agruparUnificacao').selectOption('sequencia');
    await ui.locator('#baixar:enabled').waitFor();
    await ui.locator('#baixar').click();
    await ui.locator('#statusMessage').filter({ hasText: 'arquivo(s) baixado(s)' }).waitFor();
    const downloaded = await ultimoDownload();
    const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(downloaded.filename);
    const sheet = wb.worksheets[0]; const header = sheet.getRow(7).values;
    const scoreIndex = header.indexOf('PONTUAÇÃO');
    assert.deepEqual([8, 9, 10, 11].map(n => sheet.getRow(n).getCell(scoreIndex).value), ['90,00', '90,00', '10,00', '10,00']);
    console.log('Seleção vazia, exportação e ordenação global confirmadas.');
    await ui.screenshot({ path: path.join(root, 'test-results/tela-desktop.png'), fullPage: true });
    await ui.setViewportSize({ width: 360, height: 800 });
    assert.equal(await ui.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'sem rolagem horizontal em 360px');
    await ui.screenshot({ path: path.join(root, 'test-results/tela-compacta.png'), fullPage: true });
    await ui.setViewportSize({ width: 1000, height: 900 });
    // Uma segunda aba não recebe a consolidação da primeira.
    const second = await context.newPage(); await second.goto('https://siaps.saude.gov.br/outra');
    const secondId = await worker.evaluate(async () => (await chrome.tabs.query({})).find(t => t.url?.endsWith('/outra')).id);
    const secondUi = await context.newPage(); await secondUi.goto(`chrome-extension://${extensionId}/popup.html?tabId=${secondId}`); await secondUi.locator('#consolidar:enabled').waitFor();
    assert.equal(await secondUi.locator('#resultSection').isHidden(), true); await secondUi.close();
    // Cancelamento não deixa o job preso e mantém retomada pelo cache.
    slow = true; await ui.locator('#atualizar').click(); await ui.locator('#parar:not([hidden])').waitFor(); await ui.locator('#parar').click();
    await ui.locator('#parar').waitFor({ state: 'hidden' }); await ui.locator('#consolidar:enabled').waitFor(); slow = false;
    await ui.locator('#tentarNovamente').click(); await ui.locator('#consolidationSummary').filter({ hasText: 'Consulta completa' }).waitFor();
    // Regressão do relato original: os últimos arquivos de um lote não podem sumir.
    for (const month of ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05']) {
      await ui.locator('#competencia').fill(month); await ui.locator('#adicionarCompetencia').click();
    }
    await ui.locator('#consolidar').click();
    await ui.locator('#consolidationSummary').filter({ hasText: '12 de 12 consultas' }).waitFor();
    await ui.locator('#modoUnificacao').selectOption('separado');
    await ui.locator('#selectionCount').filter({ hasText: '12 arquivo(s)' }).waitFor();
    await ui.locator('#baixar:enabled').waitFor(); await ui.locator('#baixar').click();
    await ui.locator('#confirmarDownloads').click();
    await ui.locator('#statusMessage').filter({ hasText: '12 arquivo(s) baixado(s)' }).waitFor({ timeout: 60000 });
    const batch = await worker.evaluate(async tabId => {
      const state = (await chrome.storage.session.get(`siaps:tab:${tabId}`))[`siaps:tab:${tabId}`];
      return Promise.all(state.downloads.map(async id => (await chrome.downloads.search({ id }))[0].state));
    }, tabId);
    assert.equal(batch.length, 12); assert.ok(batch.every(status => status === 'complete'));
    console.log('Lote com 12 downloads confirmado do primeiro ao último.');
    // Recarregar invalida os dados daquele documento.
    await siaps.reload(); await ui.locator('#resultSection').waitFor({ state: 'hidden' });
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(root, 'test-results/browser.json'), JSON.stringify({ passed: true, pacote: process.argv.includes('--package'), scenarios: ['renovar sessão e verificar conexão', 'coleta parcial', 'aceite parcial', 'download real confirmado', 'XLSX reaberto', 'reabrir popup', 'retry incremental', 'seleção vazia', 'ordenação global', '360px', 'isolamento por aba', 'cancelar e retomar', '12 downloads em lote', 'recarregar'], authRequests, apiCalls: calls.length, pageErrors: errors }, null, 2));
    console.log(`Browser: 14 cenários concluídos; ${calls.length} chamadas sintéticas; nenhum acesso ao SIAPS real.`);
  } catch (error) {
    for (const page of context.pages()) if (page.url().includes('/popup.html')) {
      console.error('Estado da interface:', await page.locator('#statusMessage').textContent().catch(() => ''), 'Erros:', errors);
      await page.screenshot({ path: path.join(root, 'test-results/falha.png'), fullPage: true }).catch(() => {});
    }
    throw error;
  } finally { await context.close(); /* Perfil temporário preservado para diagnóstico local. */ }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
