/* Exportação local: sem acesso à API ou ao token. */
(function (root) {
  'use strict';
  function criarWorkbook(groups, options, resumo = {}) {
    const C = root.SiapsCore, workbook = new root.ExcelJS.Workbook(), usados = new Set();
    workbook.creator = 'DAPS Betim — SIAPS Tool';
    workbook.created = new Date();
    for (const group of groups) {
      const { schema, rows } = C.tabela(group.blocos, options);
      if (rows.length > 1048500 || schema.length > 16384) throw new Error('O relatório ultrapassa o limite do Excel. Divida o período ou agrupe por competência.');
      const sheet = workbook.addWorksheet(C.nomeGuia(group.label, usados));
      if (options.incluirMetadados !== false) {
        sheet.addRow(['DIRETORIA DE ATENÇÃO PRIMÁRIA À SAÚDE — BETIM/MG']);
        sheet.addRow([group.label]);
        sheet.addRow(['Consulta mais antiga do conjunto', resumo.consultadoEm || new Date().toISOString()]);
        sheet.addRow(['Situação', resumo.parcial ? 'PARCIAL — consulte as pendências' : 'Completo']);
        sheet.addRow(['Filtros', JSON.stringify({ unidades: C.selecao(options.unidades), equipes: C.selecao(options.equipes) })]);
        sheet.addRow([]);
      }
      const header = sheet.addRow(schema.map(col => col.titulo));
      header.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF093D72' } };
      header.alignment = { vertical: 'middle', wrapText: true }; header.height = 36;
      sheet.views = [{ state: 'frozen', ySplit: header.number }];
      sheet.autoFilter = { from: { row: header.number, column: 1 }, to: { row: header.number + rows.length, column: schema.length } };
      const widths = schema.map(col => Math.min(48, Math.max(14, col.titulo.length + 2)));
      const pos = schema.findIndex(col => col.id === 'classificacao');
      const colors = { 'ÓTIMO': 'FFCDDDFD', BOM: 'FFD5EFD9', SUFICIENTE: 'FFFFEDB0', REGULAR: 'FFFFD8B6' };
      for (const { cells } of rows) {
        const row = sheet.addRow(cells);
        row.font = { name: 'Arial', size: 11 }; row.alignment = { vertical: 'middle', wrapText: true };
        cells.forEach((value, i) => { widths[i] = Math.min(48, Math.max(widths[i], String(value ?? '').length + 2)); });
        const cor = colors[String(cells[pos] || '').trim().toUpperCase()];
        if (cor) row.getCell(pos + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cor } };
      }
      schema.forEach((col, i) => {
        const column = sheet.getColumn(i + 1); column.width = widths[i];
        if (col.id === 'coCnes' || col.id === 'coEquipe') column.numFmt = '@';
      });
      sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `${header.number}:${header.number}` };
    }
    if (resumo.parcial) {
      const sheet = workbook.addWorksheet(C.nomeGuia('Pendências', usados));
      sheet.addRow(['RELATÓRIO PARCIAL — estes itens não foram incluídos']);
      sheet.addRow(['Competência', 'Indicador', 'Motivo']);
      for (const failure of resumo.falhas || []) sheet.addRow([C.formatarCompetencia(failure.competencia), failure.codigo, failure.erro]);
      sheet.columns.forEach(col => { col.width = 35; });
    }
    return workbook;
  }
  root.SiapsExcel = { criarWorkbook };
  if (typeof module === 'object') module.exports = root.SiapsExcel;
})(globalThis);
