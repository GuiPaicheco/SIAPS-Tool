/* Abre o popup real da barra do Chrome, sem viewport de aba/dashboards. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
(async () => {
  console.log('Iniciando Chromium para popup real...');
  const context = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'siaps-popup-')), { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`] });
  try {
    console.log('Chromium iniciado.');
    await context.route('https://siaps.saude.gov.br/**', r => r.fulfill({ contentType: 'text/html', body: '<title>SIAPS sintético</title>' }));
    const page = await context.newPage(); await page.goto('https://siaps.saude.gov.br/teste');
    console.log('Página sintética aberta.');
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    for (let i = 0; i < 100; i++) { if (await worker.evaluate(() => !!globalThis.chrome?.action?.openPopup)) break; await new Promise(r => setTimeout(r, 100)); }
    const cdp = await context.newCDPSession(page);
    console.log('Abrindo popup da barra.');
    await worker.evaluate(() => { void chrome.action.openPopup(); });
    let target;
    for (let i = 0; i < 50; i++) {
      const { targetInfos } = await cdp.send('Target.getTargets');
      target = targetInfos.find(t => t.url.endsWith('/popup.html'));
      if (target) break;
      await new Promise(r => setTimeout(r, 100));
    }
    assert.ok(target, 'popup real deve estar aberto');
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: false });
    let nextId = 0;
    function command(method, params) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { cdp.off('Target.receivedMessageFromTarget', listener); reject(new Error(`Timeout CDP: ${method}`)); }, 10000);
        const listener = message => {
          if (message.sessionId !== sessionId) return;
          const result = JSON.parse(message.message);
          if (result.id !== id) return;
          clearTimeout(timeout);
          cdp.off('Target.receivedMessageFromTarget', listener);
          result.error ? reject(new Error(result.error.message)) : resolve(result.result);
        };
        cdp.on('Target.receivedMessageFromTarget', listener);
        cdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) }).catch(reject);
      });
    }
    for (let i = 0; i < 60; i++) {
      const ready = await command('Runtime.evaluate', { expression: 'Boolean(document.querySelector("#consolidar:not(:disabled)"))', returnByValue: true });
      if (ready.result.value) break;
      if (i === 59) throw new Error('O popup real não concluiu a inicialização.');
      await new Promise(r => setTimeout(r, 100));
    }
    const result = await command('Runtime.evaluate', { expression: 'JSON.stringify({width:innerWidth,root:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,body:document.body.getBoundingClientRect().width})', returnByValue: true });
    const geometry = JSON.parse(result.result.value); console.log('Popup real:', geometry);
    const screenshot = await command('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.join(root, 'test-results'), { recursive: true }); fs.writeFileSync(path.join(root, 'test-results/popup-real.png'), Buffer.from(screenshot.data, 'base64'));
    assert.ok(geometry.width >= 580 && geometry.width <= 620, 'popup deve abrir com aproximadamente 600px');
    assert.ok(geometry.scroll <= geometry.width, 'popup não deve cortar conteúdo horizontalmente');
  } finally { await context.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
