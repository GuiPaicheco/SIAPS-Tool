const { test } = require('node:test');
const assert = require('node:assert/strict');
global.SiapsCore = require('../core.js');
global.ExcelJS = require('exceljs');
const { criarWorkbook } = require('../excel.js');
const catalog = require('../catalog.js');
const r = { competencia: '202606', indicador: catalog[0], variaveis: [{ noParametro: 'TOTAL', descricao: 'Atendimentos' }], equipes: [{ coEquipe: '0001234', coCnes: '0012345', noEquipe: 'Equipe exemplo', indicadores: [{ coIndicador: 110, numerador: 0, denominador: 3, score: 0, scoreFormatado: '0,00', scoreClassificacao: 'BOM', variaveis: { TOTAL: 2 } }] }] };
test('XLSX real pode ser reaberto, preserva identificadores e estrutura', async () => {
  const groups = SiapsCore.grupos([r], { unificacao: { modo: 'unificado', agruparPor: 'competencia' } });
  const wb = criarWorkbook(groups, { modoDados: 'completo', incluirMetadados: false });
  const buffer = await wb.xlsx.writeBuffer(); const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(buffer);
  const sheet = loaded.worksheets[0]; assert.equal(sheet.columnCount, 13); assert.equal(sheet.rowCount, 2);
  assert.equal(sheet.getCell('C2').value, '0012345'); assert.equal(sheet.getCell('F2').value, '0001234');
  assert.equal(sheet.getCell('J2').value, 0); assert.equal(sheet.getCell('L2').value, '0,00');
  assert.equal(sheet.views[0].ySplit, 1); assert.ok(sheet.autoFilter);
});
test('resultado parcial é identificado mesmo sem cabeçalho institucional', async () => {
  const wb = criarWorkbook(SiapsCore.grupos([r]), { modoDados: 'analitico', incluirMetadados: false }, { parcial: true, falhas: [{ competencia: '202606', codigo: 'C2', erro: 'HTTP 500' }] });
  const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(await wb.xlsx.writeBuffer());
  assert.equal(loaded.worksheets.length, 2); assert.match(loaded.getWorksheet('Pendências').getCell('A1').value, /PARCIAL/);
  assert.equal(loaded.worksheets[0].columnCount, 10);
});
