/**
 * Ajuste de proventos por desdobramento, grupamento e bonificação.
 * Uso: npx tsx --test scripts/lib/*.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adjustDividendsByTicker, adjustDividendsForSplits, baseTicker, isIncomeDividend, splitAdjustedDividendYield,
  splitDivisor, splitsInPrice, toShareBaseSplits, type StockSplitRow,
} from './splits';
import type { RawDividend } from '../types';

const div = (exDate: string, amount: number, dividendType = 'JCP', symbol = 'TEST3'): RawDividend =>
  ({ symbol, amount, exDate, paymentDate: '', dividendType, currency: 'BRL' });

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);

// Cadeia real de SBSP3 em brapi_stock_splits (lida em 06/10/2026, anon).
const SBSP3_SPLITS: StockSplitRow[] = [
  { ticker: 'SBSP3', ex_date: '2007-06-01', label: 'GRUPAMENTO', factor: 0.008 },
  { ticker: 'SBSP3', ex_date: '2013-04-22', label: 'DESDOBRAMENTO', factor: 3 },
  { ticker: 'SBSP3', ex_date: '2025-12-23', label: 'BONIFICACAO', factor: 1.03 },
  { ticker: 'SBSP3', ex_date: '2026-03-19', label: 'BONIFICACAO', factor: 1.0016098 },
  { ticker: 'SBSP3', ex_date: '2026-04-28', label: 'DESDOBRAMENTO', factor: 5 },
];

// Proventos reais de SBSP3 em brapi_dividends (os mais recentes, como declarados).
const SBSP3_DIVS: RawDividend[] = [
  div('2026-03-19', 0.83342453884, 'JCP', 'SBSP3'),
  div('2025-12-23', 2.64389299, 'JCP', 'SBSP3'),
  div('2025-04-29', 2.679, 'JCP', 'SBSP3'),
  div('2025-04-29', 1.0514724, 'DIVIDENDO', 'SBSP3'),
  div('2024-04-25', 1.4404, 'JCP', 'SBSP3'),
];

// 06/10/2026, 20h BRT (o horário do cron).
const NOW = new Date('2026-10-06T23:00:00Z');

test('desdobramento 5:1 divide por 5 o provento com data-com antes do evento', () => {
  const splits = toShareBaseSplits([{ ex_date: '2026-04-28', label: 'DESDOBRAMENTO', factor: 5 }]);
  const [antes, depois] = adjustDividendsForSplits([div('2026-03-01', 1), div('2026-05-01', 0.3)], splits);
  close(antes.amount, 0.2);
  assert.equal(antes.amountDeclared, 1);
  assert.equal(antes.splitDivisor, 5);
  assert.equal(depois.amount, 0.3);              // já nasceu na base nova
  assert.equal(depois.amountDeclared, undefined);
  assert.equal(depois.splitDivisor, undefined);
});

test('grupamento 1:10 multiplica por 10 o provento antigo', () => {
  const splits = toShareBaseSplits([{ ex_date: '2024-07-01', label: 'GRUPAMENTO', factor: 0.1 }]);
  const [antes, depois] = adjustDividendsForSplits([div('2024-01-10', 0.05), div('2024-08-01', 0.7)], splits);
  close(antes.amount, 0.5);
  assert.equal(antes.splitDivisor, 0.1);
  assert.equal(depois.amount, 0.7);
});

test('evento na MESMA data-com do provento também divide (régua inclusiva do app)', () => {
  // Fixture real: CSAN3 pagou R$ 1,0305928 com desdobramento 1:4 na data-com de 05/05/2021;
  // o adjusted_close da BRAPI implica 1,0306 ÷ 4.
  const splits = toShareBaseSplits([
    { ex_date: '2008-10-22', label: 'BONIFICACAO', factor: 2 },
    { ex_date: '2021-05-05', label: 'DESDOBRAMENTO', factor: 4 },
  ]);
  assert.equal(splitDivisor(splits, '2021-05-05'), 4);
  assert.equal(splitDivisor(splits, '2021-05-06'), 1);
  assert.equal(splitDivisor(splits, '2007-07-27'), 8);   // acumula os dois
  close(adjustDividendsForSplits([div('2021-05-05', 1.0305928)], splits)[0].amount, 1.0305928 / 4);
});

test('eventos múltiplos acumulam o fator — SBSP3 (2 bonificações + desdobramento 5:1)', () => {
  const splits = toShareBaseSplits(SBSP3_SPLITS);
  close(splitDivisor(splits, '2025-04-29'), 1.03 * 1.0016098 * 5);   // ≈ 5,1583, o número do app
  close(splitDivisor(splits, '2025-12-23'), 1.03 * 1.0016098 * 5);   // bonificação no mesmo dia entra
  close(splitDivisor(splits, '2026-03-19'), 1.0016098 * 5);
  close(splitDivisor(splits, '2026-04-29'), 1);
  // Provento de 2010: atravessa o desdobramento 3:1 de 2013 e os três eventos recentes.
  close(splitDivisor(splits, '2010-02-26'), 3 * 1.03 * 1.0016098 * 5);
  // Provento de 2006: atravessa também o grupamento 1:125 de 2007 (fator 0,008).
  close(splitDivisor(splits, '2006-04-10'), 0.008 * 3 * 1.03 * 1.0016098 * 5);
});

test('eventos múltiplos com grupamento no meio — PETR4 (bonificação, grupamento 1:100, desdobramento 2:1)', () => {
  const splits = toShareBaseSplits([
    { ex_date: '1994-03-25', label: 'BONIFICACAO', factor: 1.3333334 },
    { ex_date: '2000-06-21', label: 'GRUPAMENTO', factor: 0.01 },
    { ex_date: '2008-04-25', label: 'DESDOBRAMENTO', factor: 2 },
  ]);
  const [p1990, p1999, p2005, p2010] = adjustDividendsForSplits(
    [div('1990-05-01', 1), div('1999-05-01', 1), div('2005-05-01', 1), div('2010-05-01', 1)], splits);
  close(p1990.amount, 1 / (1.3333334 * 0.01 * 2));
  close(p1999.amount, 1 / (0.01 * 2));   // ×50
  close(p2005.amount, 0.5);
  assert.equal(p2010.amount, 1);
});

test('só DESDOBRAMENTO, GRUPAMENTO e BONIFICACAO contam; fator e data inválidos são ignorados', () => {
  const splits = toShareBaseSplits([
    { ex_date: '2014-10-03', label: 'CIS RED CAP', factor: 100 },      // CSAN3 real: 100 = percentual
    { ex_date: '2015-01-01', label: 'INCORPORACAO', factor: 3 },
    { ex_date: '2016-01-01', label: 'RESG TOTAL RV', factor: 7 },
    { ex_date: '2017-01-01', label: 'REST CAP ACOES', factor: 9 },
    { ex_date: '2018-01-01', label: 'DESDOBRAMENTO', factor: 0 },
    { ex_date: '2018-01-02', label: 'DESDOBRAMENTO', factor: -4 },
    { ex_date: '2018-01-03', label: 'DESDOBRAMENTO', factor: 'abc' },
    { ex_date: '2018-01-04', label: 'DESDOBRAMENTO', factor: null },
    { ex_date: null, label: 'DESDOBRAMENTO', factor: 2 },
    { ex_date: '2021-05-05', label: 'desdobramento', factor: 4 },     // caixa baixa vale
    { ex_date: '2022-01-01', label: 'Bonificação', factor: 1.1 },     // acento vale
  ]);
  assert.deepEqual(splits, [{ exDate: '2021-05-05', factor: 4 }, { exDate: '2022-01-01', factor: 1.1 }]);
  close(splitDivisor(splits, '2013-01-01'), 4.4);
  // Divisor ignora fator ruim mesmo que alguém monte a lista à mão.
  assert.equal(splitDivisor([{ exDate: '2021-05-05', factor: 0 }, { exDate: '2021-05-05', factor: NaN }], '2021-01-01'), 1);
});

test('ticker sem eventos: os proventos saem idênticos (mesmo objeto)', () => {
  const divs = [div('2026-01-10', 1.2), div('2025-07-01', 0.8)];
  const out = adjustDividendsByTicker(divs, [], 'TEST3');
  assert.equal(out[0], divs[0]);
  assert.equal(out[1], divs[1]);
  const out2 = adjustDividendsForSplits(divs, []);
  assert.equal(out2[0], divs[0]);
});

test('reaplicar o ajuste não divide duas vezes', () => {
  const splits = toShareBaseSplits(SBSP3_SPLITS);
  const once = adjustDividendsForSplits(SBSP3_DIVS, splits);
  const twice = adjustDividendsForSplits(once, splits);
  for (let i = 0; i < once.length; i++) {
    close(twice[i].amount, once[i].amount, 1e-12);
    assert.equal(twice[i].amountDeclared, SBSP3_DIVS[i].amount);
  }
  // E sem eventos volta ao valor declarado.
  const reset = adjustDividendsForSplits(once, []);
  assert.equal(reset[0].amount, SBSP3_DIVS[0].amount);
  assert.equal(reset[0].amountDeclared, undefined);
});

test('ajuste por ticker: cada classe usa os próprios eventos; ".SA" e caixa não importam', () => {
  const rows: StockSplitRow[] = [
    { ticker: 'AAAA3', ex_date: '2026-01-01', label: 'DESDOBRAMENTO', factor: 2 },
    { ticker: 'aaaa4.sa', ex_date: '2026-01-01', label: 'DESDOBRAMENTO', factor: 4 },
  ];
  const out = adjustDividendsByTicker([
    div('2025-06-01', 1, 'JCP', 'AAAA3'),
    div('2025-06-01', 1, 'JCP', 'AAAA4.SA'),
    div('2025-06-01', 1, 'JCP', 'AAAA11'),     // unit sem linha própria: não herda das classes
    div('2025-06-01', 1, 'JCP', ''),           // sem ticker: usa o papel consultado
  ], rows, 'AAAA3');
  assert.deepEqual(out.map(d => d.amount), [0.5, 0.25, 1, 0.5]);
  assert.equal(baseTicker(' sbsp3.SA '), 'SBSP3');
});

test('SBSP3: DY de 12 meses cai de ~10,9% (cru) para ~2,1% (ajustado) a R$ 31,94', () => {
  const adjusted = adjustDividendsByTicker(SBSP3_DIVS, SBSP3_SPLITS, 'SBSP3');
  const reported = 0.10887030459737007;   // brapi_quotes.dividend_yield de 06/10/2026
  const dy = splitAdjustedDividendYield(adjusted, 31.94, reported, NOW);
  const expected = (2.64389299 / (1.03 * 1.0016098 * 5) + 0.83342453884 / (1.0016098 * 5)) / 31.94;
  close(dy, expected);
  assert.ok(dy > 0.020 && dy < 0.023, `DY ${dy}`);
  // O "cru" é exatamente o que o banco publica: soma dos dois proventos da janela ÷ preço.
  close((2.64389299 + 0.83342453884) / 31.94, reported, 1e-6);
});

test('DY: sem provento ajustado na janela, o número do banco fica intacto', () => {
  // PETR4/TAEE11: eventos antigos (2008, 2012) não tocam os últimos 12 meses.
  const splits: StockSplitRow[] = [{ ticker: 'TEST3', ex_date: '2012-12-04', label: 'DESDOBRAMENTO', factor: 3 }];
  const divs = adjustDividendsByTicker([div('2026-08-20', 1.1), div('2026-02-20', 0.9), div('2011-05-01', 3)], splits, 'TEST3');
  assert.equal(divs[2].splitDivisor, 3);                  // o antigo foi ajustado…
  assert.equal(splitAdjustedDividendYield(divs, 43.7, 0.0688, NOW), 0.0688);   // …mas o DY não muda
  assert.equal(splitAdjustedDividendYield([], 43.7, 0.0688, NOW), 0.0688);
  assert.equal(splitAdjustedDividendYield([], 43.7, NaN, NOW), 0);
});

test('DY ajustado segue a régua do banco: só renda, data-com em (hoje − 12 meses, hoje]', () => {
  const splits: StockSplitRow[] = [{ ticker: 'TEST3', ex_date: '2026-09-30', label: 'DESDOBRAMENTO', factor: 2 }];
  const divs = adjustDividendsByTicker([
    div('2026-09-01', 2, 'DIVIDENDO'),     // entra: 1,00 ajustado
    div('2025-10-07', 4, 'JCP'),           // 1º dia da janela: entra, 2,00
    div('2025-10-06', 8, 'JCP'),           // hoje − 12 meses: fora, como em incomeWindows (dividends.ts)
    div('2026-05-01', 6, 'REST CAP DIN'),  // restituição de capital não é renda: fora
    div('2026-10-20', 10, 'DIVIDENDO'),    // data-com futura: fora
    div('2026-06-01', 0.5, 'RENDIMENTO'),  // entra: 0,25
  ], splits, 'TEST3');
  close(splitAdjustedDividendYield(divs, 10, 0.9, NOW), (1 + 2 + 0.25) / 10);
  assert.equal(splitAdjustedDividendYield(divs, 0, 0.9, NOW), 0);   // sem preço não há DY
  assert.ok(isIncomeDividend('Dividendo') && isIncomeDividend('jcp') && !isIncomeDividend('AMORTIZAÇÃO'));
});

test('evento repetido pela fonte em dias seguidos conta uma vez — MGLU3 real (8:1 em 2017 e 2019 gravados em dobro)', () => {
  // brapi_stock_splits de MGLU3 em 06/10/2026: cada desdobramento aparece em D e D+1.
  const rows: StockSplitRow[] = [
    { ex_date: '2015-09-30', label: 'GRUPAMENTO', factor: 0.125 }, { ex_date: '2015-10-01', label: 'GRUPAMENTO', factor: 0.125 },
    { ex_date: '2017-09-04', label: 'DESDOBRAMENTO', factor: 8 }, { ex_date: '2017-09-05', label: 'DESDOBRAMENTO', factor: 8 },
    { ex_date: '2019-08-05', label: 'DESDOBRAMENTO', factor: 8 }, { ex_date: '2019-08-06', label: 'DESDOBRAMENTO', factor: 8 },
    { ex_date: '2020-10-13', label: 'DESDOBRAMENTO', factor: 4 },
    { ex_date: '2024-05-24', label: 'GRUPAMENTO', factor: 0.1 },
    { ex_date: '2025-12-29', label: 'BONIFICACAO', factor: 1.05 },
  ];
  const splits = toShareBaseSplits(rows);
  assert.deepEqual(splits.map(s => s.exDate), ['2015-09-30', '2017-09-04', '2019-08-05', '2020-10-13', '2024-05-24', '2025-12-29']);
  // Provento de 2018: um desdobramento 8:1 pela frente, não dois (26,88 com a duplicata).
  close(splitDivisor(splits, '2018-05-02'), 8 * 4 * 0.1 * 1.05);
  close(splitDivisor(splits, '2017-01-02'), 8 * 8 * 4 * 0.1 * 1.05);
});

test('repetição só colapsa com mesmo rótulo, mesmo fator e até 3 dias', () => {
  const splits = toShareBaseSplits([
    { ex_date: '2016-10-17', label: 'BONIFICACAO', factor: 1.1 }, { ex_date: '2016-10-18', label: 'BONIFICACAO', factor: 1.1 },   // ITUB4: uma
    { ex_date: '2008-04-04', label: 'BONIFICACAO', factor: 1.5 }, { ex_date: '2008-04-16', label: 'BONIFICACAO', factor: 1.5 },   // 12 dias: duas
    { ex_date: '2009-06-08', label: 'GRUPAMENTO', factor: 0.02 }, { ex_date: '2009-06-08', label: 'DESDOBRAMENTO', factor: 50 },   // rótulos diferentes: duas
    { ex_date: '2020-01-10', label: 'BONIFICACAO', factor: 1.1 }, { ex_date: '2020-01-11', label: 'BONIFICACAO', factor: 1.2 },   // fatores diferentes: duas
  ]);
  assert.equal(splits.length, 7);
  assert.equal(splits.filter(s => s.exDate.startsWith('2016-10')).length, 1);
});

test('evento que a cotação ainda não reflete (data-com hoje ou futura) não ajusta', () => {
  const rows: StockSplitRow[] = [{ ticker: 'TEST3', ex_date: '2026-04-28', label: 'DESDOBRAMENTO', factor: 5 }];
  const divs = [div('2026-03-01', 1)];
  // Antes e NA data-com (o build das 20h vê o fechamento das ações antigas): valor declarado.
  assert.equal(adjustDividendsByTicker(divs, rows, 'TEST3', '2026-04-01')[0].amount, 1);
  assert.equal(adjustDividendsByTicker(divs, rows, 'TEST3', '2026-04-28')[0].amount, 1);
  // No pregão seguinte a cotação já está desdobrada: ajusta.
  close(adjustDividendsByTicker(divs, rows, 'TEST3', '2026-04-29')[0].amount, 0.2);
  assert.deepEqual(splitsInPrice([{ exDate: '2026-04-28', factor: 5 }, { exDate: '2026-05-01', factor: 2 }], '2026-04-30'), [{ exDate: '2026-04-28', factor: 5 }]);
  // E o DY volta a ser o do banco enquanto o evento não acontece.
  const reported = 0.105;
  assert.equal(splitAdjustedDividendYield(adjustDividendsByTicker([div('2026-03-01', 3.5)], rows, 'TEST3', '2026-04-28'), 33.3, reported, new Date('2026-04-28T23:00:00Z')), reported);
});
