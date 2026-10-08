/**
 * valuations.json: Graham, Bazin e Gordon iguais aos números padrão da página de ticker.
 * Uso: npx tsx --test scripts/lib/*.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildValuationsJson, cents, countValuations, perShare, perShareSigned, readValuationsFile, widgetValuationFields } from './valuations-json';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildModel } from '../ticker/model';
import { brl } from '../ticker/lib/format';
import { ValuationMethodType, type ComprehensiveValuation, type FinancialData, type RawDividend } from '../types';

const DAY = 86400000;
/** Data-com N dias atrás (as janelas da página são relativas a hoje). */
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);
const div = (exDate: string, amount: number, dividendType = 'JCP'): RawDividend =>
  ({ symbol: 'TEST3', amount, exDate, paymentDate: '', dividendType, currency: 'BRL' });

function fixture(o: { price: number; lpa: number; vpa: number; dividends: RawDividend[]; gordonCapm?: number; grahamEquity?: number }) {
  const f = {
    symbol: 'TEST3', name: 'Empresa Teste S.A.', sector: 'Utilidade Pública', subSector: 'Saneamento', type: 'ON',
    price: o.price, date: '06/10/2026', min52Week: o.price * 0.8, max52Week: o.price * 1.2, volMed2m: 1e7,
    marketCap: o.price * 1e9, firmValue: o.price * 1.2e9, lastBalanceDate: '31/12/2025', sharesOutstanding: 1e9,
    changeDay: 0.01, change12m: 0.1, pl: o.lpa > 0 ? o.price / o.lpa : 0, pvp: o.price / o.vpa, pebit: 8, psr: 1.5,
    divYield: 0.05, evEbitda: 6, evEbit: 8, lpa: o.lpa, vpa: o.vpa, grossMargin: 0.4, ebitMargin: 0.2,
    ebitdaMargin: 0.3, netMargin: 0.1, roic: 0.12, roe: 0.15, currentLiquidity: 1.4, debtEquity: 0.8, debtEbitda: 2,
  };
  const data: FinancialData = {
    ticker: 'TEST3', price: o.price, currency: 'BRL', sharesOutstanding: 1e9, beta: 1, wacc: 0.12, growthRate: 0.05,
    roe: 0.15, payoutRatio: 0.25, revenue: 1e10, ebit: 2e9, netIncome: o.lpa * 1e9, interestExpenses: 1e8, taxRate: 0.34,
    equity: o.vpa * 1e9, debt: 5e9, cashAndEquivalents: 1e9, investedCapital: 1e10, freeCashFlow: 1e9, depreciation: 5e8,
    volatility: 0.3, sectorPE: 8, sectorEVEBITDA: 6, currentPE: f.pl, currentEVEBITDA: 6, currentEPS: o.lpa,
    _rawIncome: [], _rawBalance: [], _rawCashFlow: [], _rawDividends: o.dividends, fundamentals: f, businessSummary: null,
  };
  const r = (method: ValuationMethodType, fairValue: number) => ({ method, fairValue, weight: 0.2, upside: 0, details: '', trace: { formula: '', inputs: {}, steps: [], finalResult: fairValue } });
  const val: ComprehensiveValuation = {
    ticker: 'TEST3', currentPrice: o.price, weightedFairValue: o.price, totalUpside: 0, calculatedWacc: 0.14,
    // O modelo ponderado tem o seu próprio "Gordon" (LPA com ke de CAPM) e "Graham" (VPA = PL ÷ ações):
    // é o que o valuations.json publicava antes. Ficam diferentes de propósito para provar que não vazam.
    results: [r(ValuationMethodType.DCF, 0), r(ValuationMethodType.GORDON, o.gordonCapm ?? -15.69), r(ValuationMethodType.GRAHAM, o.grahamEquity ?? 99.99)],
    priceRange: { min: 0, max: 0 }, sensitivityMatrix: [],
  };
  return { data, val };
}

test('cents: inválido, zero ou negativo vira 0; arredonda como a página exibe', () => {
  assert.equal(cents(-15.69), 0);
  assert.equal(cents(0), 0);
  assert.equal(cents(NaN), 0);
  assert.equal(cents(Infinity), 0);
  // Meio centavo: arredonda como o brl() da página, não como toFixed (1.005.toFixed(2) = "1.00").
  for (const v of [25.645, 1.005, 2.675, 60.3149999, 0.125, 1234.5678, 15.97]) assert.equal(brl(cents(v)), brl(v));
  assert.equal(cents(1234.5678), 1234.57);
  assert.equal(perShare(0.6789691234), 0.678969);
  assert.equal(perShare(-1), 0);
});

test('Graham, Bazin e Gordon do valuations.json = os números padrão da página', () => {
  const dividends = [
    div(daysAgo(40), 0.5), div(daysAgo(200), 0.7, 'DIVIDENDO'),     // 12 meses
    div(daysAgo(200), 0.7, 'DIVIDENDO'),                             // duplicata da fonte: a página conta uma vez
    div(daysAgo(500), 1.1), div(daysAgo(900), 0.9), div(daysAgo(1500), 1.3),
    div(daysAgo(2500), 2.0), div(daysAgo(3400), 0.4),
  ];
  const { data, val } = fixture({ price: 31.94, lpa: 2.2812153161154405, vpa: 12.816964929144072, dividends });
  const m = buildModel(data, val, [], []);
  const w = widgetValuationFields(m);

  // O que a página exibe (SSR; o JS do cliente só recalcula quando o usuário mexe).
  assert.equal(brl(w.graham), brl(m.calc.graham.fv));
  assert.equal(brl(w.bazin), brl(m.calc.bazin.fv));
  assert.equal(brl(w.gordon), brl(m.calc.gordon.fv));

  // E as fórmulas com as premissas padrão do site.
  const avg5 = (0.5 + 0.7 + 1.1 + 0.9 + 1.3) / 5;
  assert.equal(w.graham, cents(Math.sqrt(22.5 * 2.2812153161154405 * 12.816964929144072)));
  assert.equal(w.bazin, cents(avg5 / 0.06));
  assert.equal(w.gordon, cents(avg5 * 1.04 / (0.14 - 0.04)));
  assert.notEqual(w.graham, 99.99);   // não é mais o Graham do modelo ponderado

  // Proventos: os mesmos da página (12m e médias por janela), com 6 casas.
  assert.equal(w.divTTM, perShare(m.div.ttm));
  assert.equal(w.divTTM, 1.2);
  assert.deepEqual(w.avgDiv, { '1': perShare(m.div.avg['1']), '3': perShare(m.div.avg['3']), '5': perShare(m.div.avg['5']), '10': perShare(m.div.avg['10']) });
  assert.equal(w.avgDiv['5'], perShare(avg5));
  // A calculadora da página guarda a mesma precisão em data-avg.
  assert.equal(String(w.avgDiv['5']), String(Number(m.div.avg['5'].toFixed(6))));
});

test('CSAN3: LPA negativo zera Graham e o Gordon do LPA (−15,69) não vaza para o arquivo', () => {
  const dividends = [div(daysAgo(800), 0.75), div(daysAgo(1400), 0.6, 'DIVIDENDO'), div(daysAgo(2600), 3.0)];
  const { data, val } = fixture({ price: 4.96, lpa: -2.2417448603437706, vpa: 1.2525844325428037, dividends, gordonCapm: -15.69 });
  const w = widgetValuationFields(buildModel(data, val, [], []));
  assert.equal(w.graham, 0);
  assert.equal(w.divTTM, 0);
  assert.equal(w.bazin, cents((0.75 + 0.6) / 5 / 0.06));
  assert.equal(w.gordon, cents((0.75 + 0.6) / 5 * 1.04 / 0.1));
  assert.ok(w.gordon > 0);
});

test('sem proventos em 5 anos: Bazin e Gordon 0 (antes o Bazin caía no TTM e o Gordon no LPA)', () => {
  const { data, val } = fixture({ price: 50, lpa: 5, vpa: 30, dividends: [div(daysAgo(2400), 1)], gordonCapm: 61.2 });
  const w = widgetValuationFields(buildModel(data, val, [], []));
  assert.equal(w.bazin, 0);
  assert.equal(w.gordon, 0);
  assert.ok(w.graham > 0);
  assert.equal(w.avgDiv['10'], 0.1);
});

test('qualquer valor inválido ou negativo vindo do modelo vira 0 (LPA/VPA negativos mantêm o sinal)', () => {
  const w = widgetValuationFields({
    calc: { graham: { lpa: -1, vpa: 2, fv: NaN }, bazin: { fv: -3 }, gordon: { fv: -15.69 } },
    div: { ttm: -1, dyTTM: 0, avg: { '1': NaN, '3': Infinity, '5': -2, '10': 0 }, byYear: [], recent: [], totalPayments: 0, firstYear: null, lastYearTotal: null },
  });
  assert.deepEqual(w, { graham: 0, bazin: 0, gordon: 0, lpa: -1, vpa: 2, divTTM: 0, avgDiv: { '1': 0, '3': 0, '5': 0, '10': 0 } });
  const bad = widgetValuationFields({
    calc: { graham: { lpa: NaN, vpa: -Infinity, fv: 0 }, bazin: { fv: 0 }, gordon: { fv: 0 } },
    div: { ttm: 0, dyTTM: 0, avg: { '1': 0, '3': 0, '5': 0, '10': 0 }, byYear: [], recent: [], totalPayments: 0, firstYear: null, lastYearTotal: null },
  });
  assert.equal(bad.lpa, 0);
  assert.equal(bad.vpa, 0);
  assert.ok(Object.is(perShareSigned(-0.0000001), 0));   // sem "-0" no arquivo
});

test('Graham recalculado a partir de lpa/vpa do arquivo = graham publicado (a landing recalcula)', () => {
  // HBOR3 real (brapi_quotes, 06/10/2026): com 2 casas (0,03 × 10,82) a landing mostrava R$ 2,70;
  // a página mostra R$ 2,88.
  const cases: [number, number][] = [
    [0.034045300735432285, 10.819853575771138],   // HBOR3
    [0.028346971006719023, 1.5199633336897393],   // KLBN4
    [2.2812153161154405, 12.816964929144072],     // SBSP3
    [-2.2417448603437706, 1.2525844325428037],    // CSAN3: LPA negativo
  ];
  for (const [lpa, vpa] of cases) {
    const { data, val } = fixture({ price: 10, lpa, vpa, dividends: [] });
    const m = buildModel(data, val, [], []);
    const w = widgetValuationFields(m);
    const recalc = w.lpa > 0 && w.vpa > 0 ? Math.sqrt(22.5 * w.lpa * w.vpa) : 0;
    assert.equal(brl(cents(recalc)), brl(cents(m.calc.graham.fv)), `LPA ${lpa}`);
    assert.equal(cents(recalc), w.graham);
    assert.equal(Math.sign(w.lpa), Math.sign(lpa));
  }
});

// ─── Arquivo inteiro: execução com tickers na linha de comando mescla (SPEC-v2 §E3) ─────────

test('valuations.json: execução parcial (tickers na linha de comando) mescla com o anterior, não trunca', () => {
  const previous = {
    _quoteDate: '2026-10-06',
    PETR4: { name: 'Petrobras', price: 53.98, divTTM: 3.0 },
    VALE3: { name: 'Vale', price: 60.1, divTTM: 5.6 },
    _outro: 'metadado antigo',
    RUIM3: 'não é objeto',
  };
  const current = { PETR4: { name: 'Petrobras', price: 54.52, divTTM: 3.66 }, WEGE3: { name: 'WEG', price: 40, divTTM: 0.9 } };
  const out = buildValuationsJson(current, '2026-10-07', { partial: true, previous });
  assert.deepEqual(Object.keys(out), ['_quoteDate', 'PETR4', 'VALE3', 'WEGE3']);
  assert.deepEqual(out.PETR4, current.PETR4);                 // o desta execução vence
  assert.deepEqual(out.VALE3, previous.VALE3);                // o resto continua
  assert.equal(out._quoteDate, '2026-10-06');                 // mistura dias: fica a data mais antiga
  // Todos os papéis do arquivo regerados agora: a data é a desta execução.
  assert.equal(buildValuationsJson({ ...current, VALE3: { price: 61 } }, '2026-10-07', { partial: true, previous })._quoteDate, '2026-10-07');
  // Sem arquivo anterior (ou inválido): só esta execução, como antes.
  assert.deepEqual(buildValuationsJson(current, '2026-10-07', { partial: true, previous: null }), { _quoteDate: '2026-10-07', ...current });
});

test('valuations.json: execução completa grava só esta execução (papel que saiu do universo sai do arquivo)', () => {
  const out = buildValuationsJson({ PETR4: { price: 54.52 } }, '2026-10-07', { partial: false, previous: { _quoteDate: '2026-10-06', VELH3: { price: 1 } } });
  assert.deepEqual(out, { _quoteDate: '2026-10-07', PETR4: { price: 54.52 } });
});

test('valuations.json: leitura do arquivo anterior tolera ausente e inválido', () => {
  const dir = mkdtempSync(join(tmpdir(), 'val-json-'));
  try {
    assert.equal(readValuationsFile(join(dir, 'nao-existe.json')), null);
    writeFileSync(join(dir, 'a.json'), '{quebrado');
    assert.equal(readValuationsFile(join(dir, 'a.json')), null);
    writeFileSync(join(dir, 'b.json'), '[1,2]');
    assert.equal(readValuationsFile(join(dir, 'b.json')), null);
    writeFileSync(join(dir, 'c.json'), '{"_quoteDate":"2026-10-06","PETR4":{"price":1}}');
    assert.deepEqual(readValuationsFile(join(dir, 'c.json')), { _quoteDate: '2026-10-06', PETR4: { price: 1 } });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generate-pages.ts: execução com tickers na linha de comando passa pelo buildValuationsJson (mescla)', () => {
  const src = readFileSync(join(__dirname, '..', 'generate-pages.ts'), 'utf-8');
  assert.match(src, /const partial = cliTickers\.length > 0;/);
  assert.match(src, /buildValuationsJson\(widgetValuations, quoteDate, \{ partial, previous: partial \? readValuationsFile\(valuationsFile\) : null \}\)/);
  assert.doesNotMatch(src, /\{ _quoteDate: quoteDate, \.\.\.widgetValuations \}/);   // o jeito antigo truncava
});

test('generate-pages.ts: a calculadora de /ferramentas/ recebe a data do valuations.json DESTA execução', () => {
  // Sem `quoteDate` no build, o generateFerramentas lia o `_quoteDate` do arquivo de ontem (o
  // valuations.json só é regravado depois) e a página dizia "Dados de <ontem>".
  const src = readFileSync(join(__dirname, '..', 'generate-pages.ts'), 'utf-8');
  const calc = src.indexOf('const valuationsWithMeta = buildValuationsJson(');
  const call = src.indexOf('await generateFerramentas(');
  assert.ok(calc > 0 && call > 0 && calc < call, 'o conteúdo do valuations.json precisa existir antes do generateFerramentas');
  assert.match(src, /build: \{ valuations: widgetValuations, quoteDate: String\(valuationsWithMeta\._quoteDate\),/);
});

test('generate-pages.ts: o {n} da calculadora é o total do valuations.json MESCLADO (execução parcial não diz "1 ação")', () => {
  // Numa execução `generate-pages.ts PETR4`, widgetValuations tem 1 papel, mas o arquivo gravado
  // (mesclado com o anterior) tem ~335: o build passa a contagem do arquivo, não a da execução.
  const src = readFileSync(join(__dirname, '..', 'generate-pages.ts'), 'utf-8');
  const total = src.indexOf('const valuationsTotal = countValuations(valuationsWithMeta);');
  const call = src.indexOf('await generateFerramentas(');
  assert.ok(total > 0 && total < call, 'a contagem do arquivo mesclado sai antes do generateFerramentas');
  assert.match(src, /build: \{[^}]*\bvaluationsCount: valuationsTotal\b[^}]*\}/);
  // A contagem ignora as chaves de metadado (_quoteDate) e conta o que fica no arquivo mesclado.
  const previous = { _quoteDate: '2026-10-06', PETR4: { price: 1 }, VALE3: { price: 2 }, WEGE3: { price: 3 } };
  const merged = buildValuationsJson({ PETR4: { price: 54.52 } }, '2026-10-07', { partial: true, previous });
  assert.equal(countValuations(merged), 3);
  assert.equal(countValuations(buildValuationsJson({ PETR4: { price: 54.52 } }, '2026-10-07', { partial: false, previous })), 1);
});
