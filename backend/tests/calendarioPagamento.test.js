// Data-limite do pagamento do Partner: 5º dia útil do mês seguinte ao mês
// fechado (fins de semana, feriados nacionais e Carnaval; Corpus Christi
// conta como dia útil). Só informativo.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const cal = require('../src/services/calendarioPagamento');

test('Páscoa de 2026 e 2027', () => {
  assert.equal(cal.pascoa(2026).toISOString().slice(0, 10), '2026-04-05');
  assert.equal(cal.pascoa(2027).toISOString().slice(0, 10), '2027-03-28');
});

test('feriados de 2026 e 2027, dia a dia', () => {
  assert.deepEqual([...cal.feriados(2026).keys()].sort(), [
    '2026-01-01', '2026-02-16', '2026-02-17', '2026-04-03', '2026-04-21', '2026-05-01',
    '2026-09-07', '2026-10-12', '2026-11-02', '2026-11-15', '2026-11-20', '2026-12-25',
  ]);
  assert.deepEqual([...cal.feriados(2027).keys()].sort(), [
    '2027-01-01', '2027-02-08', '2027-02-09', '2027-03-26', '2027-04-21', '2027-05-01',
    '2027-09-07', '2027-10-12', '2027-11-02', '2027-11-15', '2027-11-20', '2027-12-25',
  ]);
  // Corpus Christi não é feriado aqui (ponto facultativo)
  assert.ok(!cal.feriados(2026).has('2026-06-04'));
  assert.ok(!cal.feriados(2027).has('2027-05-27'));
});

test('outubro/2026 -> 5º dia útil de novembro/2026 (2/11 é Finados)', () => {
  // 2/11 seg feriado: 3, 4, 5, 6 e 9
  assert.equal(cal.dataLimitePagamento('2026-10'), '2026-11-09');
});

test('outros meses: virada de ano, 7 de setembro, Corpus Christi útil, Carnaval não útil', () => {
  assert.equal(cal.dataLimitePagamento('2026-12'), '2027-01-08'); // 1/1 sex: 4, 5, 6, 7, 8
  assert.equal(cal.dataLimitePagamento('2027-01'), '2027-02-05'); // 1 a 5/2 (Carnaval é 8 e 9)
  assert.equal(cal.dataLimitePagamento('2026-08'), '2026-09-08'); // 1, 2, 3, 4, (7 feriado), 8
  assert.equal(cal.dataLimitePagamento('2027-08'), '2027-09-08'); // 1, 2, 3, 6, (7 feriado), 8
  assert.equal(cal.dataLimitePagamento('2026-05'), '2026-06-05'); // Corpus Christi (4/6) conta como útil
  assert.equal(cal.dataLimitePagamento('2008-01'), '2008-02-11'); // Carnaval 4 e 5/2/2008: 1, 6, 7, 8, 11
  assert.equal(cal.dataLimitePagamento('2027-12'), '2028-01-07'); // depois de 2027 também funciona
});
