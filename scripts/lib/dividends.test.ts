/**
 * Proventos: duplicatas da fonte, parcelas, natureza e janelas de DY (SPEC-v2 §E7).
 * Uso: npx tsx --test scripts/lib/dividends.test.ts
 *
 * Fixture com linhas REAIS de brapi_dividends/brapi_stock_splits/brapi_quotes lidas (anon,
 * somente leitura) em 07/10/2026: scripts/lib/fixtures/proventos-2026-10-07.json.
 *
 * Antes × depois, 1ª rodada (dividends() da fundação × régua do app + guardas 1–3, 07/10/2026):
 *   CMIG4 R$ 11,86  DY 12m 5,42% → 9,61%   média 5 anos R$ 0,7095 → R$ 1,2684
 *   PETR4 R$ 54,52  DY 12m 5,49% → 6,70%   média 5 anos R$ 8,4593 → R$ 8,4796
 *   BBSE3 R$ 40,30  DY 12m 11,39% → 11,39% média 5 anos R$ 3,8258 → R$ 3,3914
 *   GRND3 R$ 4,36   DY 12m 43,79% → 48,88% média 5 anos R$ 0,9348 → R$ 0,9792
 *
 * Antes × depois, 2ª rodada (linha-total generalizada + cronograma revisto + um DY por página).
 * "Topo" = hero, métricas, meta description, introdução, FAQ de indicadores e pares; antes era o
 * dividend_yield do banco (corrigido só por desdobramento), agora é a régua da seção:
 *   Papel           DY do topo         DY 12m da seção    média 5 anos (R$/ação)
 *   TAEE11 44,54    6,75% → 6,75%      6,75% → 6,75%      4,0880 → 3,6234  (linha-total 09/05/2022)
 *   MOVI3  15,05    5,00% → 5,00%      5,00% → 5,00%      0,6947 → 0,5249  (linha-total 04/05/2022)
 *   GRND3   4,36   48,88% → 34,13%    48,88% → 34,13%     0,9792 → 0,8506  (cronograma revisto 12/2025)
 *   CMIG4  11,86    9,61% → 9,61%      9,61% → 9,61%      1,2684 → 1,2684
 *   PETR4  54,52    6,70% → 6,70%      6,70% → 6,70%      8,4796 → 8,4796
 *   BBSE3  40,30   11,39% → 11,39%    11,39% → 11,39%     3,3914 → 3,3914
 *   SBSP3  32,18    2,11% → 2,11%      2,11% → 2,11%      0,5083 → 0,5083
 *   VALE3  68,63    8,18% → 8,18%      8,18% → 8,18%      6,4731 → 6,4731
 *   WEGE3  51,30    3,90% → 3,90%      3,90% → 3,90%      0,9361 → 0,9361
 *   BPAC11 77,04    3,69% → 1,84%      1,84% → 1,84%      (o banco contava o lote de 29/09/2025 duas vezes)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  classifyDividendType, collapseSourceDuplicates, dedupeDividends, dividendYieldTTM, dropFoldedCorrections, dropRevisedSchedules,
  dropTotalLines, incomeWindows, isInstallment, isPastIncome, isSourceDuplicate, sameAmount,
} from './dividends';
import { adjustDividendsByTicker, splitAdjustedDividendYield, type StockSplitRow } from './splits';
import { dividends } from '../ticker/model';
import type { RawDividend } from '../types';

interface Fixture {
  asOf: string;
  prices: Record<string, number>;
  /** `dividend_yield` de brapi_quotes (o DY que o topo da página mostrava). */
  reportedDY: Record<string, number>;
  dividends: Record<string, [string, string, string, number][]>;
  splits: Record<string, [string, string, number][]>;
}
const FX: Fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'proventos-2026-10-07.json'), 'utf-8'));

const rowsOf = (t: string): RawDividend[] =>
  FX.dividends[t].map(([exDate, paymentDate, dividendType, amount]) => ({ symbol: t, exDate, paymentDate, dividendType, amount, currency: 'BRL' }));
const splitsOf = (t: string): StockSplitRow[] => (FX.splits[t] ?? []).map(([ex_date, label, factor]) => ({ ticker: t, ex_date, label, factor }));
/** O mesmo caminho do gerador: ajuste por desdobramento (supabase.ts) antes do modelo. */
const adjusted = (t: string): RawDividend[] => adjustDividendsByTicker(rowsOf(t), splitsOf(t), t, FX.asOf);
const on = (t: string, exDate: string) => rowsOf(t).filter((d) => d.exDate === exDate);

// 07/10/2026, 20h BRT (o horário do cron) — "hoje" em BRT = 2026-10-07.
const NOW = new Date('2026-10-07T23:00:00Z');
const TODAY = '2026-10-07';

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);
const div = (exDate: string, amount: number, dividendType = 'JCP', paymentDate = ''): RawDividend =>
  ({ symbol: 'TEST3', exDate, paymentDate, dividendType, amount, currency: 'BRL' });

test('natureza: os rótulos reais da tabela (com e sem acento)', () => {
  assert.equal(classifyDividendType('DIVIDENDO'), 'dividendo');
  assert.equal(classifyDividendType('JCP'), 'jcp');
  assert.equal(classifyDividendType('Juros sobre capital próprio'), 'jcp');
  assert.equal(classifyDividendType('RENDIMENTO'), 'rendimento');
  assert.equal(classifyDividendType('REST CAP DIN'), 'capital');
  assert.equal(classifyDividendType('AMORTIZAÇÃO'), 'capital');
  assert.equal(classifyDividendType('AMORTIZACAO'), 'capital');
  assert.equal(classifyDividendType(''), 'outro');
});

test('mesmo valor: precisões diferentes entre lotes casam; valores diferentes não', () => {
  assert.ok(sameAmount(0.30584806, 0.30584806747));     // CMIG4: 8 × 11 casas
  assert.ok(sameAmount(0.01725, 0.017249826));          // BBDC3: 5 × 9 casas
  assert.ok(sameAmount(0.11840131614, 0.1184));         // arredondado a 4 casas: 0,001%
  assert.ok(!sameAmount(3.7192566, 3.701840165));       // VALE3 08/03/2022: 0,47% — ficam as duas (ver dividends.ts)
  assert.ok(!sameAmount(0.1184, 0.1186));               // 0,17%: outro valor
});

test('PARCELAS ficam: CMIG4 paga cada JCP em duas metades (junho e dezembro)', () => {
  const [a, b] = on('CMIG4', '2025-12-23');
  assert.equal(a.amount, b.amount);
  assert.ok(isInstallment(a, b));
  assert.ok(!isSourceDuplicate(a, b));
  assert.equal(collapseSourceDuplicates([a, b]).length, 2);
});

test('lote velho (8 casas) + lote novo com as duas parcelas: CMIG4 30/04/2021 fica com 2 dividendos e 2 JCP', () => {
  const rows = on('CMIG4', '2021-04-30');
  assert.equal(rows.length, 5);
  const out = collapseSourceDuplicates(rows);
  const dv = out.filter((d) => d.dividendType === 'DIVIDENDO');
  const jcp = out.filter((d) => d.dividendType === 'JCP');
  assert.equal(dv.length, 2);
  assert.deepEqual(dv.map((d) => d.paymentDate).sort(), ['2021-06-30', '2021-12-29']);
  assert.equal(jcp.length, 2);
});

test('dividendo e JCP de MESMO valor na mesma data-com são dois eventos (SBSP3 28/04/2022)', () => {
  const rows = on('SBSP3', '2022-04-28');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].amount, rows[1].amount);
  assert.equal(collapseSourceDuplicates(rows).length, 2);
});

test('duplicata em datas-com seguidas com pagamento-marcador (RIAA3 26 e 27/06/2018): fica 1, com o pagamento real', () => {
  const out = collapseSourceDuplicates(rowsOf('RIAA3'));
  assert.equal(out.length, 1);
  assert.equal(out[0].exDate, '2018-06-26');             // a linha mais antiga
  assert.equal(out[0].paymentDate, '2019-05-10');        // o pagamento real (o outro era a própria data-com)
});

test('pagamento deslocado 1 dia entre lotes é o mesmo pagamento (PETR4 27/04/2023)', () => {
  const rows = on('PETR4', '2023-04-27').filter((d) => d.dividendType === 'DIVIDENDO' && Math.abs(d.amount - 0.49806827) < 1e-9);
  assert.deepEqual(rows.map((d) => d.paymentDate), ['2023-12-26', '2023-12-27']);
  assert.ok(!isInstallment(rows[0], rows[1]));
  const out = collapseSourceDuplicates(rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].paymentDate, '2023-12-27');
});

test('atualização monetária embutida: BBSE3 10/02/2022 conta dividendo + rendimento uma vez', () => {
  const rows = collapseSourceDuplicates(on('BBSE3', '2022-02-10'));
  assert.equal(rows.length, 3);                            // 0,9171545 + 0,012893915 e a soma 0,93004838205
  const out = dropFoldedCorrections(rows);
  assert.deepEqual(out.map((d) => d.amount).sort(), [0.012893915, 0.9171545]);
  close(out.reduce((s, d) => s + d.amount, 0), 0.93004838205, 1e-7);
  // PETR4 13/04/2022 (2,861076 + 0,1091725 = 2,9702487) e 14/04/2021.
  for (const ex of ['2022-04-13', '2021-04-14']) {
    const p = dedupeDividends(on('PETR4', ex));
    assert.equal(p.length, 2, ex);
    assert.ok(p.some((d) => d.dividendType === 'RENDIMENTO'), ex);
  }
});

test('linha idêntica repetida conta uma vez; valor zero e data inválida saem', () => {
  const a = div('2025-05-10', 0.5, 'DIVIDENDO', '2025-06-01');
  const out = dedupeDividends([a, { ...a }, div('2025-05-10', 0, 'DIVIDENDO'), div('', 1), div('lixo', 1)]);
  assert.equal(out.length, 1);
});

test('mesma natureza e valor a mais de 3 dias são eventos diferentes (pagador mensal)', () => {
  const out = dedupeDividends([div('2026-01-02', 0.018182, 'JCP', '2026-02-02'), div('2026-02-02', 0.018182, 'JCP', '2026-03-02')]);
  assert.equal(out.length, 2);
});

test('data-com futura e restituição de capital ficam na lista e fora do DY e das médias', () => {
  // CXSE3: dividendo com data-com em 03/11/2026 (anunciado). VIVT3: REST CAP DIN de 22/05/2026.
  const fut = dedupeDividends(rowsOf('CXSE3'));
  assert.equal(fut.length, 1);
  assert.ok(fut[0].exDate > TODAY);
  assert.equal(incomeWindows(fut, TODAY).ttm, 0);
  assert.ok(!isPastIncome(fut[0], TODAY));
  const vivt = dedupeDividends(rowsOf('VIVT3'));
  const rest = vivt.filter((d) => classifyDividendType(d.dividendType) === 'capital');
  assert.ok(rest.length >= 1 && rest.every((d) => d.exDate <= TODAY));
  const income = vivt.filter((d) => isPastIncome(d, TODAY)).reduce((s, d) => (d.exDate > '2025-10-07' ? s + d.amount : s), 0);
  close(incomeWindows(vivt, TODAY).ttm, income, 1e-12);
  // E a página mostra a restituição na tabela, sem somar no DY.
  const m = dividends({ _rawDividends: rowsOf('VIVT3'), price: 30 }, NOW);
  assert.ok(m.recent.some((r) => r.type === 'REST CAP DIN'));
  close(m.ttm, income, 1e-12);
});

test('janelas: (hoje − N anos, hoje]; data-com no limite de 12 meses fica fora, hoje entra', () => {
  const rows = [div('2025-10-07', 1, 'DIVIDENDO'), div('2025-10-08', 2, 'DIVIDENDO'), div('2026-10-07', 4, 'DIVIDENDO'), div('2026-10-08', 8, 'DIVIDENDO')];
  const w = incomeWindows(rows, TODAY);
  assert.equal(w.ttm, 6);                                  // 08/10/2025 e 07/10/2026
  close(w.avg['3'], 7 / 3);
  close(w.avg['10'], 0.7);
});

// ─── Linha-total ao lado das parcelas (guarda 3 generalizada) ──────────────────────────

const amounts = (rows: readonly RawDividend[]) => rows.map((d) => d.amount).sort((a, b) => a - b);
const sum = (rows: readonly RawDividend[]) => rows.reduce((s, d) => s + d.amount, 0);

test('linha-total sai e as parcelas ficam: TAEE11 09/05/2022 (2,323063 = 1,8963242 + 0,42673913)', () => {
  const rows = on('TAEE11', '2022-05-09');
  assert.equal(rows.length, 4);                            // as 2 parcelas, o total e o total do outro lote
  const out = dedupeDividends(rows);
  assert.deepEqual(amounts(out), [0.42673913, 1.8963242]);
  close(sum(out), 2.323063, 1e-6);                        // 2,32306333: 0,00001% de diferença
});

test('linha-total: MOVI3 04/05/2022 e ALLD3 06/12/2024 (JCP em duas metades)', () => {
  assert.deepEqual(amounts(dedupeDividends(on('MOVI3', '2022-05-04'))), [0.246834494, 0.602049747]);
  const alld = dedupeDividends(on('ALLD3', '2024-12-06'));
  assert.equal(alld.length, 2);
  assert.deepEqual(alld.map((d) => d.paymentDate).sort(), ['2025-04-15', '2025-08-29']);
  close(sum(alld), 1.2970586, 1e-6);
});

test('linha-total sem pagamento e com data-com 3 dias antes das parcelas sai (UNIP3 24 × 27/07/2017)', () => {
  const out = dedupeDividends(on('UNIP3', '2017-07-24').concat(on('UNIP3', '2017-07-27')));
  assert.deepEqual(amounts(out), [1.1727272, 3.049982]);
});

test('atualização monetária com pagamento-marcador também sai (BAZA3 28/04/2025: JCP 7,4178 e dividendo 0,594459)', () => {
  // A régua antiga exigia o pagamento do RENDIMENTO perto do total; o lote grava a própria data-com.
  const out = dedupeDividends(on('BAZA3', '2025-04-28'));
  const byKind = (k: string) => amounts(out.filter((d) => classifyDividendType(d.dividendType) === k));
  assert.deepEqual(byKind('jcp'), [7.1086183]);
  assert.deepEqual(byKind('dividendo'), [0.5696813]);
  assert.deepEqual(byKind('rendimento'), [0.024777723, 0.3091823]);
  close(sum(out), 7.4178 + 0.594459, 1e-6);
});

test('PARCELA verdadeira igual à soma de outras fica: o pagamento dela não é o de nenhuma delas', () => {
  // GRND3 26/12/2025: a 1ª parcela (0,443380332 em 14/01) = 2 × 0,221690166 (18/03 e 10/06).
  const g = dropTotalLines(collapseSourceDuplicates(on('GRND3', '2025-12-26')));
  assert.deepEqual(amounts(g), [0.199503977, 0.221690166, 0.221690166, 0.443380332]);
  // PETR4 27/04/2023: 1,3728669 (19/05) = 0,8747986 (16/06) + 0,49806827 (27/12), três pagamentos reais.
  const p = dedupeDividends(on('PETR4', '2023-04-27')).filter((d) => d.dividendType === 'DIVIDENDO');
  assert.deepEqual(p.map((d) => d.paymentDate).sort(), ['2023-05-19', '2023-06-16', '2023-12-27']);
  // PETR4 23/12/2024: JCP de 0,6641033 em 20/02 = 0,01053822 + 0,65356508 pagos em 20/03.
  const j = dedupeDividends(on('PETR4', '2024-12-23'));
  assert.ok(j.some((d) => d.amount === 0.6641033 && d.paymentDate === '2025-02-20'));
  // EALT3 19/01/2022: 0,01402 (2023) = 0,00701 + 0,00701 (2022); 11 parcelas, nenhuma sai.
  assert.equal(dedupeDividends(on('EALT3', '2022-01-19')).length, 11);
});

test('linha-total: natureza diferente, diferença acima de 0,01% ou data-com a 4 dias não tiram nada; total e subtotal saem', () => {
  const total = div('2025-05-10', 0.3, 'DIVIDENDO', '2025-06-01');
  // Parcelas JCP não fecham um total de dividendo.
  assert.equal(dedupeDividends([total, div('2025-05-10', 0.2, 'JCP', '2025-06-01'), div('2025-05-10', 0.1, 'JCP', '2025-09-01')]).length, 3);
  // 0,30004 ≠ 0,2 + 0,1 (0,013%, acima do teto de 0,01%).
  assert.equal(dedupeDividends([div('2025-05-10', 0.30004, 'DIVIDENDO', '2025-06-01'), div('2025-05-10', 0.2, 'DIVIDENDO', '2025-06-01'), div('2025-05-10', 0.1, 'DIVIDENDO', '2025-09-01')]).length, 3);
  // Cópia arredondada (LAVV3 14/11/2024): 0,3000004 contra 0,2 + 0,1 (0,00013%) é linha-total.
  assert.equal(dedupeDividends([div('2025-05-10', 0.3000004, 'DIVIDENDO', '2025-06-01'), div('2025-05-10', 0.2, 'DIVIDENDO', '2025-06-01'), div('2025-05-10', 0.1, 'DIVIDENDO', '2025-09-01')]).length, 2);
  // Data-com a 4 dias: outro provento.
  assert.equal(dedupeDividends([total, div('2025-05-14', 0.2, 'DIVIDENDO', '2025-06-01'), div('2025-05-14', 0.1, 'DIVIDENDO', '2025-09-01')]).length, 3);
  // A mesma soma com o pagamento de uma parcela sai; sem pagamento real (só o marcador), também.
  assert.equal(dedupeDividends([total, div('2025-05-10', 0.2, 'DIVIDENDO', '2025-06-01'), div('2025-05-10', 0.1, 'DIVIDENDO', '2025-09-01')]).length, 2);
  assert.equal(dedupeDividends([div('2025-05-10', 0.3, 'DIVIDENDO', '2025-05-10'), div('2025-05-10', 0.2, 'DIVIDENDO', '2025-06-01'), div('2025-05-10', 0.1, 'DIVIDENDO', '2025-09-01')]).length, 2);
  // Total de 3 parcelas e o subtotal de 2 delas: saem os dois, ficam as 3 parcelas.
  const p = [div('2025-05-10', 0.5, 'JCP', '2025-06-01'), div('2025-05-10', 0.3, 'JCP', '2025-07-01'), div('2025-05-10', 0.2, 'JCP', '2025-08-01')];
  assert.deepEqual(amounts(dedupeDividends([...p, div('2025-05-10', 1.0, 'JCP', '2025-06-01'), div('2025-05-10', 0.8, 'JCP', '2025-06-01')])), [0.2, 0.3, 0.5]);
  assert.equal(dropFoldedCorrections, dropTotalLines);     // nome antigo continua valendo
});

// ─── Cronograma revisto (guarda 4) ──────────────────────────────────────────────────────

test('cronograma revisto: GRND3 dez/2025 conta o extraordinário uma vez, com as datas da antecipação', () => {
  const rows = on('GRND3', '2025-12-24').concat(on('GRND3', '2025-12-26'));
  assert.equal(rows.length, 6);
  close(sum(rows), 1.086264641 + 0.642884309, 1e-9);       // contava 0,642884309 a mais
  const out = dedupeDividends(rows);
  close(sum(out), 1.086264641, 1e-9);
  assert.deepEqual(out.map((d) => `${d.exDate} ${d.paymentDate} ${d.amount}`).sort(), [
    '2025-12-24 2026-02-25 0.332535249',                   // cronograma revisto (lote brapi)
    '2025-12-24 2026-05-20 0.31034906',
    '2025-12-26 2026-01-14 0.443380332',                   // 1ª parcela, paga antes da revisão
  ]);
});

test('cronograma revisto: natureza diferente, data-com a 4 dias, soma diferente ou parcela anterior não saem', () => {
  const revised = [div('2025-12-24', 0.3, 'DIVIDENDO', '2026-02-25'), div('2025-12-24', 0.2, 'DIVIDENDO', '2026-05-20')];
  const original = (ex: string, type = 'DIVIDENDO') =>
    [div(ex, 0.4, type, '2026-01-14'), div(ex, 0.25, type, '2026-03-18'), div(ex, 0.25, type, '2026-06-10')];
  // As parcelas de B a partir do 1º pagamento de A saem; a de 14/01 (antes da revisão) fica.
  assert.deepEqual(amounts(dropRevisedSchedules(collapseSourceDuplicates([...revised, ...original('2025-12-26')]))), [0.2, 0.3, 0.4]);
  assert.equal(dropRevisedSchedules(collapseSourceDuplicates([...revised, ...original('2025-12-26', 'JCP')])).length, 5);
  assert.equal(dropRevisedSchedules(collapseSourceDuplicates([...revised, ...original('2025-12-28')])).length, 5);
  const off = [div('2025-12-24', 0.3, 'DIVIDENDO', '2026-02-25'), div('2025-12-24', 0.2002, 'DIVIDENDO', '2026-05-20')];
  assert.equal(dropRevisedSchedules(collapseSourceDuplicates([...off, ...original('2025-12-26')])).length, 5);
  // Grupo revisto sem pagamento real não decide nada.
  const noPay = [div('2025-12-24', 0.3, 'DIVIDENDO', ''), div('2025-12-24', 0.2, 'DIVIDENDO', '2026-05-20')];
  assert.equal(dropRevisedSchedules(collapseSourceDuplicates([...noPay, ...original('2025-12-26')])).length, 5);
});

// ─── Papéis reais: antes × depois (o cabeçalho tem os números) ─────────────────────────

const EXPECT: Record<string, { ttm: number; avg5: number; dy: number }> = {
  CMIG4: { ttm: 1.13935195218, avg5: 1.26838446850, dy: 0.0961 },
  PETR4: { ttm: 3.65542598, avg5: 8.47955807400, dy: 0.0670 },
  BBSE3: { ttm: 4.5900913116, avg5: 3.39137035812, dy: 0.1139 },
  GRND3: { ttm: 1.488157847, avg5: 0.85058766040, dy: 0.3413 },   // era 2,131042156 / 0,9791645222 / 48,88%
  TAEE11: { ttm: 3.00645720978, avg5: 3.62341301766, dy: 0.0675 }, // média de 5 anos era 4,0880
  MOVI3: { ttm: 0.75186692, avg5: 0.52488104760, dy: 0.0500 },     // média de 5 anos era 0,6947
  SBSP3: { ttm: 0.67896918279, avg5: 0.50833091860, dy: 0.0211 },
  VALE3: { ttm: 5.612492955, avg5: 6.47311010200, dy: 0.0818 },
  WEGE3: { ttm: 2.003246712, avg5: 0.93613586120, dy: 0.0390 },
};

for (const t of Object.keys(EXPECT)) {
  test(`${t}: DY de 12 meses e média de 5 anos com dado real de 07/10/2026`, () => {
    const m = dividends({ _rawDividends: adjusted(t), price: FX.prices[t] }, NOW);
    close(m.ttm, EXPECT[t].ttm);
    close(m.avg['5'], EXPECT[t].avg5);
    close(m.avg['1'], m.ttm, 1e-12);
    assert.equal(Math.round(m.dyTTM * 1e4) / 1e4, EXPECT[t].dy);
    // Um DY só na página: o do topo (dividendYieldTTM, que valuation.ts grava em divYield) é o da seção.
    assert.equal(dividendYieldTTM(adjusted(t), FX.prices[t], FX.reportedDY[t], TODAY), m.dyTTM);
    // Gráfico por ano e contagem só com renda já ocorrida; a tabela mostra o mais recente primeiro.
    assert.ok(m.byYear.every((y) => y.year <= 2026));
    assert.ok(m.recent[0].ex >= m.recent[m.recent.length - 1].ex);
  });
}

// ─── Um DY por página ───────────────────────────────────────────────────────────────────

test('DY do topo = régua da seção: BPAC11 3,69% (banco, lote de 29/09/2025 contado duas vezes) → 1,84%', () => {
  const rows = adjusted('BPAC11');
  assert.equal(Math.round(FX.reportedDY.BPAC11 * 1e4) / 1e4, 0.0369);
  const dy = dividendYieldTTM(rows, FX.prices.BPAC11, FX.reportedDY.BPAC11, TODAY);
  assert.equal(Math.round(dy * 1e4) / 1e4, 0.0184);
  assert.equal(dy, dividends({ _rawDividends: rows, price: FX.prices.BPAC11 }, NOW).dyTTM);
});

test('DY do topo: sem nenhum provento na base fica o do banco; com proventos e nada em 12 meses, 0', () => {
  assert.equal(dividendYieldTTM([], 30, 0.05, TODAY), 0.05);             // não inventa zero
  assert.equal(dividendYieldTTM([], 30, NaN, TODAY), 0);
  assert.equal(dividendYieldTTM([div('', 1), div('2025-01-01', 0)], 30, 0.05, TODAY), 0.05);   // só linha inválida
  assert.equal(dividendYieldTTM([div('2024-05-10', 1, 'DIVIDENDO', '2024-06-01')], 30, 0.05, TODAY), 0);
  assert.equal(dividendYieldTTM([div('2026-05-10', 1, 'DIVIDENDO', '2026-06-01')], 0, 0.05, TODAY), 0.05);   // sem cotação
  // Restituição de capital não é renda (ENJU3: o banco somava e dava 28%).
  assert.equal(dividendYieldTTM([div('2026-05-10', 1, 'REST CAP DIN', '2026-06-01')], 10, 0.1, TODAY), 0);
});

test('janela de 12 meses igual nas duas réguas: data-com em hoje − 12 meses fica fora das duas', () => {
  const rows = adjustDividendsByTicker([
    div('2025-10-07', 8, 'DIVIDENDO', '2025-11-01'),       // hoje − 12 meses: fora
    div('2025-10-08', 2, 'DIVIDENDO', '2025-11-01'),       // entra
    div('2026-10-07', 1, 'JCP', '2026-11-01'),             // hoje: entra
  ], [{ ticker: 'TEST3', ex_date: '2026-01-05', label: 'DESDOBRAMENTO', factor: 2 }], 'TEST3', TODAY);
  const ttm = incomeWindows(dedupeDividends(rows), TODAY).ttm;
  close(ttm, 1 + 1, 1e-12);                                // 2 ÷ 2 (desdobramento) + 1
  close(splitAdjustedDividendYield(rows, 10, 0.5, NOW) * 10, ttm, 1e-12);
  close(dividendYieldTTM(rows, 10, 0.5, TODAY) * 10, ttm, 1e-12);
});

test('CMIG4: proventos de 12 meses = R$ 1,14 (as duas metades de cada JCP), como no app', () => {
  const m = dividends({ _rawDividends: adjusted('CMIG4'), price: FX.prices.CMIG4 }, NOW);
  assert.equal(m.ttm.toFixed(2), '1.14');
  // JCP de 22/09/2026 em duas metades (30/06/2027 e 30/12/2027): as duas na tabela.
  assert.equal(m.recent.filter((r) => r.ex === '2026-09-22').length, 2);
});

test('PETR4: JCP de 01/06/2026 pago em 20/08 e 21/09 conta as duas parcelas', () => {
  const m = dividends({ _rawDividends: adjusted('PETR4'), price: FX.prices.PETR4 }, NOW);
  const p = m.recent.filter((r) => r.ex === '2026-06-01');
  assert.deepEqual(p.map((r) => r.pay).sort(), ['2026-08-20', '2026-09-21']);
});

test('GRND3: extraordinário de dez/2025 conta uma vez e o DY de 12 meses passa de 25% (o ranking marca como provento atípico)', () => {
  const m = dividends({ _rawDividends: adjusted('GRND3'), price: FX.prices.GRND3 }, NOW);
  assert.ok(m.dyTTM > 0.25);                               // 34,13%: atípico pelo teto, não pelo 2× (0,8506 × 2 = 1,70)
  assert.ok(m.ttm < 2 * m.avg['5']);
  // Na tabela: a 1ª parcela de 26/12 (paga antes da revisão) e as duas datas novas de 24/12.
  assert.deepEqual(m.recent.filter((r) => r.ex === '2025-12-26').map((r) => r.pay), ['2026-01-14']);
  assert.deepEqual(m.recent.filter((r) => r.ex === '2025-12-24').map((r) => r.pay).sort(), ['2026-02-25', '2026-05-20']);
});

test('BBSE3: média de 5 anos sem a linha com a correção embutida (10/02/2022) e sem as cópias do lote novo', () => {
  const m = dividends({ _rawDividends: adjusted('BBSE3'), price: FX.prices.BBSE3 }, NOW);
  // Soma conferida à mão: 10 distribuições semestrais de 02/2022 a 08/2026 (com as correções) = 16,9568.
  close(m.avg['5'] * 5, 16.9568517906, 1e-6);
});
