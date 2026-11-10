const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');
const catalog = require('../catalog.js');
const variables = [ { noParametro: 'ATENDIMENTOS', descricao: 'Atendimentos', nuIndice: 1 }, { noParametro: 'NUMERADOR', descricao: 'Numerador', nuIndice: 2 }, { noParametro: 'DENOMINADOR', descricao: 'Denominador', nuIndice: 3 }, { noParametro: 'PONTUACAO', descricao: 'Numerador/Denominador', nuIndice: 4 } ];
const team = (id, score, indicatorId = 110) => ({ coEquipe: id, coCnes: '00123', noEquipe: `Equipe ${id}`, sgEquipe: 'eSF', indicadores: [{ coIndicador: indicatorId, score, scoreFormatado: String(score), numerador: 4, denominador: 8, variaveis: { ATENDIMENTOS: 7 }, scoreClassificacao: 'BOM' }] });
const report = (competencia = '202606', indicator = catalog[0]) => ({ competencia, indicador: indicator, variaveis: variables, equipes: [team('0001', 90, indicator.id), team('0002', 10, indicator.id)] });
test('nenhuma seleção não significa todos; migração de configurações antigas é explícita', () => {
  const rows = report().equipes;
  assert.equal(C.filtrar(rows, { unidades: { modo: 'selecionados', valores: [] } }).length, 0);
  assert.equal(C.filtrar(rows, { equipes: { modo: 'selecionados', valores: [] } }).length, 0);
  assert.equal(C.filtrar(rows, { unidades: [] }).length, 2);
  const restored = C.selecao(JSON.parse(JSON.stringify({ modo: 'selecionados', valores: [] })));
  assert.equal(restored.modo, 'selecionados'); assert.equal(restored.valores.length, 0);
});
test('filtra simultaneamente unidade e equipe sem alterar a origem', () => {
  const rows = report().equipes;
  assert.equal(C.filtrar(rows, { equipes: { modo: 'selecionados', valores: ['0001'] }, unidades: { modo: 'selecionados', valores: ['outra'] } }).length, 0);
  assert.equal(rows.length, 2);
});
test('pontuação usa score bruto e ordenação global, ausentes sempre no fim', () => {
  const a = report(), b = report('202607'); b.equipes = [team('3', 80), team('4', 20), team('5', null)];
  b.equipes[0].indicadores[0].scoreFormatado = '0,8';
  const out = C.tabela([{ relatorio: a, equipes: a.equipes }, { relatorio: b, equipes: b.equipes }], { ordenacao: { campo: 'score', direcao: 'desc' } });
  assert.deepEqual(out.rows.map(r => r.score), [90, 80, 20, 10, null]);
  const asc = C.ordenar(out.rows, out.schema, { campo: 'score', direcao: 'asc' });
  assert.deepEqual(asc.map(r => r.score), [10, 20, 80, 90, null]);
});
test('esquema único alinha metadata enxuta com numerador, denominador e score', () => {
  const r = report(); r.variaveis = variables.slice(0, 1);
  const full = C.tabela([{ relatorio: r, equipes: r.equipes }], { modoDados: 'completo' });
  assert.equal(full.schema.length, full.rows[0].cells.length);
  assert.deepEqual(full.rows[0].cells.slice(8), [7, 4, 8, '90', 'BOM']);
});
test('modo detalhado independe do modo usado antes e C7 mantém esquema especial', () => {
  const r = report(); const blocks = [{ relatorio: r, equipes: r.equipes }];
  assert.equal(C.tabela(blocks, { modoDados: 'analitico' }).schema.length, 10);
  assert.equal(C.tabela(blocks, { modoDados: 'completo' }).schema.length, 13);
  assert.equal(C.esquema(variables, 109).some(c => c.id === 'numerador'), false);
});
test('não usa indicador errado nem lista ambígua sem identificador', () => {
  assert.throws(() => C.indicadorDaEquipe(team('1', 77, 999), 110), /não corresponde/);
  assert.throws(() => C.indicadorDaEquipe({ indicadores: [{ score: 1 }, { score: 2 }] }, 110), /não corresponde/);
  assert.equal(C.indicadorDaEquipe({ indicadores: [{ score: 2 }] }, 110).score, 2);
  assert.throws(() => C.indicadorDaEquipe({ indicadores: [] }, 110), /sem dados/);
});
test('paginação lê todos os grupos e rejeita contratos incompletos', () => {
  assert.equal(C.pagina({ content: [{ equipes: [team('1', 1)] }, { equipes: [team('2', 2)] }], hasNext: false }).equipes.length, 2);
  assert.throws(() => C.pagina({ content: [], totalPages: 3 }), /Formato/);
  assert.throws(() => C.pagina({ content: [], hasNext: true }), /sem retornar/);
});
test('deduplicação exige INE e acusa conflitos', () => {
  const t = team('1', 20);
  assert.equal(C.deduplicar([t, { ...t }]).length, 1);
  assert.throws(() => C.deduplicar([{ noEquipe: 'A' }, { noEquipe: 'B' }]), /sem INE/);
  assert.throws(() => C.deduplicar([t, { ...t, noEquipe: 'Outro' }]), /conflitantes/);
});
test('variáveis homônimas entre indicadores mantêm células independentes', () => {
  const a = report(), b = report('202606', catalog[1]);
  const out = C.tabela([{ relatorio: a, equipes: a.equipes }, { relatorio: b, equipes: b.equipes }]);
  const cols = out.schema.filter(c => c.param === 'ATENDIMENTOS');
  assert.equal(cols.length, 2); assert.notEqual(cols[0].titulo, cols[1].titulo);
  const index = out.schema.findIndex(c => c.id === cols[1].id);
  assert.equal(out.rows[0].cells[index], null);
});
test('validação de meses e nomes de guias respeita limites e colisões', () => {
  for (const value of ['199912', '202613', '210101', 'abcd01', '20261']) assert.equal(C.competenciaValida(value), false);
  assert.equal(C.competenciaValida('202612'), true);
  const used = new Set(); const a = C.nomeGuia('Equipes/Teste', used), b = C.nomeGuia('equipes/teste', used);
  assert.notEqual(a.toLowerCase(), b.toLowerCase()); assert.ok(b.length <= 31);
});
test('grupos reaproveitam blocos por relatório, sem um bloco por equipe', () => {
  const r = report(); const groups = C.grupos([r], { unificacao: { modo: 'unificado', agruparPor: 'sequencia' } });
  assert.equal(groups.length, 1); assert.equal(groups[0].blocos.length, 1); assert.equal(groups[0].blocos[0].equipes.length, 2);
  assert.equal(C.grupos([r], { equipes: { modo: 'selecionados', valores: [] } }).length, 0);
});
test('catálogo completo tem IDs únicos e os 31 esquemas geram linhas alinhadas', () => {
  assert.equal(catalog.length, 31); assert.equal(new Set(catalog.map(i => i.id)).size, 31);
  for (const indicador of catalog) {
    const r = report('202606', indicador);
    for (const modoDados of ['completo', 'analitico']) {
      const table = C.tabela([{ relatorio: r, equipes: r.equipes }], { modoDados });
      assert.equal(table.schema.length, table.rows[0].cells.length, indicador.codigo);
      assert.equal(table.schema.at(-1).id, 'classificacao');
    }
  }
});
