/**
 * Dados das páginas /ferramentas/: ranking (cortes de sanidade, DY de 5 anos, provento atípico,
 * mediana do setor), fatos relevantes (datas de publicação × entrada no feed) e o produtor do
 * dados.json do backtest (Ibovespa × CDI). Sem rede.
 * Uso: npx tsx --test scripts/ferramentas/data.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  BACKTEST_JSON, buildBacktest, buildFatos, buildRanking, mergeDividendInputs, produceBacktest, RANKING_DEFAULTS, readBacktestFile,
  readDividendsFile, validateBacktest, validateRanking, addMonths,
  type DailyClose, type DividendsInfo, type MonthlyRate, type RankingQuote,
} from './data';
import type { CvmRow, RankingKey } from './types';

const NOW = new Date('2026-10-07T23:00:00Z');   // quarta, 20h BRT (horário do cron)
const T_TODAY = '2026-10-07T19:45:00+00:00';

// ─── Ranking ──────────────────────────────────────────────────────────────

let seq = 0;
function q(symbol: string, o: Partial<RankingQuote> = {}): RankingQuote {
  seq += 1;
  return {
    symbol,
    price: 10 + (seq % 7),
    marketCap: 2e9 + seq * 1e8,
    pl: 4 + (seq % 13),
    pvp: 0.5 + (seq % 9) / 4,
    roePct: 5 + (seq % 25),
    sector: ['Financeiro', 'Utilidade Pública', 'Consumo Cíclico', 'Materiais Básicos'][seq % 4],
    time: T_TODAY,
    volume: 1e6 + seq * 1000,
    shortName: `Empresa ${symbol}`,
    longName: `Empresa ${symbol} S.A.`,
    archived: false,
    statementDate: '2026-06-30',
    ...o,
  };
}

/** 80 papéis comuns + os casos reais de 07/10/2026 (valores de brapi_quotes, leitura anon). */
function quotes(): RankingQuote[] {
  seq = 0;
  const out: RankingQuote[] = [];
  for (let i = 0; i < 80; i++) out.push(q(`B${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}B3`));
  out.push(
    // HAPV3: VPA de R$ 95,62 (PL de R$ 48 bi ÷ 502,6 mi de ações depois do grupamento 15:1) e cotação de R$ 8,64.
    q('HAPV3', { price: 8.64, marketCap: 4442765357, pl: -25.01, pvp: 0.0904, lpa: -0.3454, vpa: 95.6216, roePct: -0.36, sector: 'Saúde' }),
    // BSLI4: P/L do banco feito com a cotação da BSLI3 (2,08 ÷ 1,4364) e DRE parada em 30/06/2025.
    q('BSLI4', { price: 2.42, marketCap: 1067717010, pl: 1.4481, pvp: 0.2952, lpa: 1.4364, vpa: 8.1965, roePct: 17.52, sector: 'Financeiro', statementDate: '2025-06-30', volume: 9e7 }),
    // GRND3: DY de 12 meses 48,9% contra DY médio de 5 anos de 22,5% (proventos de dez/2025).
    q('GRND3', { price: 4.36, marketCap: 3.9e9, pl: 6.1, pvp: 1.1, roePct: 18, sector: 'Consumo Cíclico' }),
    // LOGG-like: 24% de DY de 12 meses (abaixo do teto de 25%), mas 3× a média de 5 anos.
    q('LOGX3', { price: 20, marketCap: 2.5e9, sector: 'Financeiro' }),
    // P/L absurdo e ROE acima de 100%.
    q('PLAB3', { pl: 150, roePct: 120 }),
    // Sem demonstrativo nos últimos 2 anos.
    q('SEMD3', { statementDate: null, pl: 0.5, pvp: 0.21, roePct: 95 }),
  );
  return out;
}

function divs(qs: RankingQuote[]): DividendsInfo {
  const d: DividendsInfo = {};
  qs.forEach((x, i) => { const p = x.price ?? 10; d[x.symbol] = { divTTM: p * (0.01 + (i % 10) / 100), avg5: p * (0.01 + (i % 10) / 100) * 0.9 }; });
  d.GRND3 = { divTTM: 2.131042156, avg5: 0.9791645222 };   // dado real (scripts/lib/dividends.test.ts)
  d.LOGX3 = { divTTM: 4.8, avg5: 1.6 };                       // 24% × 8%
  return d;
}

const hasPage = () => true;
const rank = () => buildRanking(quotes(), divs(quotes()), { hasPage });
const row = (t: string) => rank().data.rows.find((r) => r.t === t)!;

test('ranking: formato da fundação intacto, só com campos a mais (dy5y, dyAtypical, sectorMedian, limites)', () => {
  const { data } = rank();
  for (const k of ['date', 'dateBR', 'minMarketCap', 'count', 'rows', 'top', 'limits']) assert.ok(k in data, k);
  for (const r of data.rows) {
    assert.deepEqual(Object.keys(r), ['t', 'name', 'sector', 'price', 'dy', 'pl', 'pvp', 'roe', 'mcap', 'dy5y', 'dyAtypical']);
    assert.equal(typeof r.dyAtypical, 'boolean');
  }
  for (const k of ['dyMax', 'roeMax', 'plMin', 'topN']) assert.equal(typeof (data.limits as unknown as Record<string, unknown>)[k], 'number', k);
  assert.deepEqual(Object.keys(data.top).sort(), ['dy', 'pl', 'pvp', 'roe']);
  assert.equal(data.limits.dyMax, 0.25);
  assert.equal(data.limits.dyVs5yMax, 2);
  assert.equal(data.minMarketCap, 1e9);
  assert.deepEqual(validateRanking(data, NOW), { problems: [], warnings: [] });
});

test('ranking: DY de 12 meses ao lado do DY médio de 5 anos; provento atípico fora da aba DY (GRND3)', () => {
  const g = row('GRND3');
  assert.equal(g.dy, 0.4888);                  // 2,1310 ÷ 4,36
  assert.equal(g.dy5y, 0.2246);                // 0,9792 ÷ 4,36
  assert.equal(g.dyAtypical, true);
  const { data, excluded } = rank();
  assert.ok(!data.top.dy.includes('GRND3'));
  assert.ok(data.top.pl.includes('GRND3') || data.top.pl.length === 20);   // continua nas outras abas
  assert.ok(excluded.some((x) => x.t === 'GRND3' && /fora da aba dy: .*25,0% \(provento atípico\)/.test(x.reason)));
  // 24% passa no teto de 25%, mas é 3× a média de 5 anos.
  const l = row('LOGX3');
  assert.equal(l.dy, 0.24);
  assert.equal(l.dy5y, 0.08);
  assert.equal(l.dyAtypical, true);
  assert.ok(!data.top.dy.includes('LOGX3'));
  assert.ok(excluded.some((x) => x.t === 'LOGX3' && /2× o DY médio de 5 anos \(8,0%\)/.test(x.reason)));
  // Aba DY ordenada, sem atípico, todos ≤ 25% e ≤ 2× a média de 5 anos.
  const byT = new Map(data.rows.map((r) => [r.t, r]));
  const dys = data.top.dy.map((t) => byT.get(t)!);
  assert.equal(dys.length, 20);
  for (let i = 1; i < dys.length; i++) assert.ok((dys[i - 1].dy as number) >= (dys[i].dy as number));
  assert.ok(dys.every((r) => !r.dyAtypical && (r.dy as number) <= 0.25 && (r.dy as number) <= 2 * (r.dy5y as number)));
});

test('ranking: DY acima de 50% nem é publicado (e é atípico)', () => {
  const qs = quotes();
  const d = divs(qs);
  d[qs[0].symbol] = { divTTM: (qs[0].price as number) * 0.7, avg5: 1 };
  const r = buildRanking(qs, d, { hasPage }).data.rows.find((x) => x.t === qs[0].symbol)!;
  assert.equal(r.dy, null);
  assert.equal(r.dyAtypical, true);
});

test('ranking: média de 5 anos absurda não é publicada (HAPV3: provento de 2022 × 15 do grupamento = 56% ao ano)', () => {
  const qs = quotes();
  const d = divs(qs);
  d.HAPV3 = { divTTM: 0, avg5: 4.855 };                    // valor real de 07/10/2026 (R$ 1,61303 de 10/02/2022 × 15 ÷ 5)
  const { data, excluded } = buildRanking(qs, d, { hasPage });
  const h = data.rows.find((x) => x.t === 'HAPV3')!;
  assert.equal(h.dy, 0);
  assert.equal(h.dy5y, null);
  assert.ok(!data.top.dy.includes('HAPV3'));
  assert.ok(excluded.some((x) => x.t === 'HAPV3' && /DY médio de 5 anos de 56,2% acima de 50,0%/.test(x.reason)));
});

test('ranking: sem a média de 5 anos em NENHUM papel, a aba DY usa só o teto de 25% e o log avisa', () => {
  const qs = quotes();
  const only: DividendsInfo = {};
  for (const [t, v] of Object.entries(divs(qs))) only[t] = { divTTM: v.divTTM };
  const { data } = buildRanking(qs, only, { hasPage });
  assert.ok(data.rows.every((r) => r.dy5y === null));
  assert.ok(data.top.dy.length === 20);
  assert.ok(data.top.dy.includes('LOGX3'));               // 24%: sem a régua de 2×, passa
  assert.ok(!data.top.dy.includes('GRND3'));              // 48,9%: o teto pega
  const v = validateRanking(data, NOW);
  assert.deepEqual(v.problems, []);
  assert.match(v.warnings.join(), /régua de 2×/);
  // Com a média de 5 anos em alguns papéis, quem não tem fica fora da aba DY (não dá para conferir).
  only.BAAB3 = { divTTM: 0.5, avg5: 0.5 };
  const strict = buildRanking(qs, only, { hasPage }).data;
  assert.ok(strict.top.dy.every((t) => strict.rows.find((r) => r.t === t)!.dy5y !== null));
});

test('ranking: cortes de P/L (0,1 a 100), P/VP (0,2 a 20) e ROE (até 100%)', () => {
  const { data, excluded } = rank();
  const byT = new Map(data.rows.map((r) => [r.t, r]));
  const pick = (k: RankingKey) => data.top[k].map((t) => byT.get(t)!);
  assert.ok(pick('pl').every((r) => (r.pl as number) >= 0.1 && (r.pl as number) < 100));
  assert.ok(pick('pvp').every((r) => (r.pvp as number) >= 0.2 && (r.pvp as number) <= 20));
  assert.ok(pick('roe').every((r) => (r.roe as number) > 0 && (r.roe as number) <= 1));
  assert.equal(byT.get('PLAB3')!.roe, 1.2);              // 120%: publicado (abaixo do teto de 150%), fora da aba
  assert.ok(!data.top.roe.includes('PLAB3'));
  assert.ok(excluded.some((x) => x.t === 'PLAB3' && /fora da aba roe: ROE de 120,0% acima de 100,0%/.test(x.reason)));
});

test('ranking: HAPV3 com P/VP 0,09 fica fora da aba P/VP (dado coerente, abaixo do corte de 0,2)', () => {
  const { data, excluded } = rank();
  assert.equal(row('HAPV3').pvp, 0.09);
  assert.ok(!data.top.pvp.includes('HAPV3'));
  assert.ok(excluded.some((x) => x.t === 'HAPV3' && /P\/VP de 0,09 fora da faixa \(0,20 a 20\)/.test(x.reason)));
});

test('ranking: BSLI4 com P/L 1,45 fica fora (balanço de 30/06/2025 e P/L com a cotação de outra classe)', () => {
  const { data, excluded } = rank();
  assert.equal(row('BSLI4').pl, 1.45);
  for (const k of ['pl', 'pvp', 'roe'] as RankingKey[]) assert.ok(!data.top[k].includes('BSLI4'), k);
  assert.ok(excluded.some((x) => x.t === 'BSLI4' && /fora da aba pl: último demonstrativo de 30\/06\/2025 \(464 dias\)/.test(x.reason)));
  // Só a conferência interna (sem o balanço velho) também barra: P/L 1,45 × cotação ÷ LPA = 1,68.
  const qs = quotes().map((x) => (x.symbol === 'BSLI4' ? { ...x, statementDate: '2026-06-30' } : x));
  const r = buildRanking(qs, divs(qs), { hasPage });
  assert.ok(!r.data.top.pl.includes('BSLI4'));
  assert.ok(r.excluded.some((x) => x.t === 'BSLI4' && /P\/L do banco \(1,45\) diferente de cotação ÷ LPA \(1,68\)/.test(x.reason)));
  assert.ok(r.data.top.pvp.includes('BSLI4') || r.data.top.pvp.length === 20); // P/VP coerente: pode entrar
  // Sem demonstrativo nos últimos 2 anos: fora de P/L, P/VP e ROE.
  for (const k of ['pl', 'pvp', 'roe'] as RankingKey[]) assert.ok(!r.data.top[k].includes('SEMD3'), k);
  // Sem a conferência (statementDate ausente, ex.: busca falhou), ninguém é barrado por ela.
  const noCheck = quotes().map((x) => { const { statementDate, ...rest } = x; void statementDate; return rest as RankingQuote; });
  assert.ok(!buildRanking(noCheck, divs(noCheck), { hasPage }).excluded.some((x) => /demonstrativo/.test(x.reason)));
});

test('ranking: mediana do setor por indicador, só com valores dentro dos cortes e com 3+ empresas', () => {
  const { data } = rank();
  const fin = data.sectorMedian['Financeiro'];
  assert.ok(fin && fin.count >= 3);
  const rows = data.rows.filter((r) => r.sector === 'Financeiro');
  assert.equal(fin.count, rows.length);
  // P/L: BSLI4 (balanço velho) não entra; a mediana é dos P/L dentro da faixa.
  const pls = rows.filter((r) => r.t !== 'BSLI4' && r.pl !== null && r.pl >= 0.1 && r.pl < 100).map((r) => r.pl as number).sort((a, b) => a - b);
  const mid = Math.floor(pls.length / 2);
  assert.equal(fin.pl, Math.round((pls.length % 2 ? pls[mid] : (pls[mid - 1] + pls[mid]) / 2) * 100) / 100);
  // DY: atípicos fora (LOGX3).
  const dys = rows.filter((r) => r.dy !== null && !r.dyAtypical).map((r) => r.dy as number);
  assert.ok(!dys.includes(0.24));
  // Setor com 1 empresa (Saúde: HAPV3): sem mediana.
  assert.deepEqual(data.sectorMedian['Saúde'], { dy: data.sectorMedian['Saúde'].dy, pl: null, pvp: null, roe: null, count: 1 });
  assert.equal(data.sectorMedian['Saúde'].dy, null);
});

test('ranking: JSON leve para a landing', () => {
  assert.ok(JSON.stringify(rank().data).length < 60_000);
});

test('proventos do ranking: valuations.json do disco + execução, com a média de 5 anos', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ferr-div-'));
  try {
    writeFileSync(join(dir, 'valuations.json'), JSON.stringify({
      _quoteDate: '2026-10-06',
      PETR4: { divTTM: 3.6, avgDiv: { 1: 3.6, 3: 6, 5: 8.48, 10: 5 } },
      VELH3: { divTTM: 1, avgDiv: { 5: 0.8 } },
      RUIM3: { divTTM: 'x' },
    }));
    const file = readDividendsFile(dir);
    assert.deepEqual(file, { PETR4: { divTTM: 3.6, avg5: 8.48 }, VELH3: { divTTM: 1, avg5: 0.8 } });
    const merged = mergeDividendInputs(file, { NOVA3: { divTTM: 2 } }, {
      PETR4: { divTTM: 3.66, avgDiv: { '5': 8.4796 } },
      VELH3: { divTTM: 1.1 },               // execução sem avgDiv: fica a média que havia
      ERRO3: { divTTM: -1 },
    });
    assert.deepEqual(merged, {
      PETR4: { divTTM: 3.66, avg5: 8.4796 },
      VELH3: { divTTM: 1.1, avg5: 0.8 },
      NOVA3: { avg5: null, divTTM: 2 },
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ─── Fatos relevantes ─────────────────────────────────────────────────────

const cvm = (o: Partial<CvmRow>): CvmRow => ({
  ticker: 'PCAR3', doc_type: 'FR', date: '2026-10-07', published_date: '2026-10-07',
  summary: 'Fato Relevante - Reorganização societária - Date 2026-10-07',
  ai_summary: 'O GPA comunicou ao mercado a aprovação de uma reorganização societária envolvendo subsidiárias, sem efeito no capital social.',
  link: 'https://www.rad.cvm.gov.br/doc/pcar', source_created_at: '2026-10-07T15:25:04.382243+00:00', company_name: 'CIA BRASILEIRA DE DISTRIBUICAO',
  ...o,
});
const look = { page: () => true, airton: (t: string) => t === 'PCAR3', known: ['PCAR3', 'LREN3', 'ZAMP3', 'IGTI3', 'IGTI11'] };

test('fatos: só FR e CM com resumo; data de publicação × hora de entrada no feed (rotulada)', () => {
  const d = buildFatos([
    cvm({}),
    // Linha real (ZAMP3): publicada em 05/10, entrou no feed às 21:40 UTC = 18:40 BRT do mesmo dia.
    cvm({ ticker: 'ZAMP3', date: '2026-10-05', published_date: '2026-10-05', source_created_at: '2026-10-05T21:40:12.024463+00:00', link: 'https://x/zamp' }),
    // Entrou no feed no dia seguinte ao da publicação.
    cvm({ ticker: 'LREN3', doc_type: 'CM', date: '2026-10-05', published_date: '2026-10-05', source_created_at: '2026-10-06T12:20:05Z', link: 'https://x/lren' }),
    cvm({ ticker: 'IGTI3', doc_type: 'PR', link: 'https://x/pr' }),      // PR: fora
    cvm({ ticker: 'IGTI3', doc_type: 'ITR', link: 'https://x/itr' }),    // ITR: fora
    cvm({ ticker: 'IGTI3', source_created_at: null, link: 'https://x/semhora' }),
  ], { ...look, names: new Map([['PCAR3', 'GPA']]), now: NOW });
  // Mais recente primeiro: data de publicação e, no mesmo dia, a entrada no feed.
  assert.deepEqual(d.items.map((i) => i.t), ['PCAR3', 'IGTI3', 'LREN3', 'ZAMP3']);
  assert.ok(d.items.every((i) => i.type === 'FR' || i.type === 'CM'));
  const p = d.items[0];
  assert.equal(p.publishedDate, '2026-10-07');
  assert.equal(p.date, '2026-10-07');                    // campo antigo continua (igual)
  assert.equal(p.feedDate, '2026-10-07');
  assert.equal(p.feedTime, '12:25');                     // 15:25 UTC = 12:25 BRT
  assert.equal(p.time, '12:25');                         // campo antigo continua (igual)
  assert.equal(p.feedLabel, 'entrou no feed às 12:25');
  const z = d.items.find((i) => i.t === 'ZAMP3')!;
  assert.equal(z.feedLabel, 'entrou no feed às 18:40');
  const l = d.items.find((i) => i.t === 'LREN3')!;
  assert.equal(l.publishedDate, '2026-10-05');
  assert.equal(l.feedDate, '2026-10-06');
  assert.equal(l.feedLabel, 'entrou no feed em 06/10 às 09:20');
  const s = d.items.find((i) => i.t === 'IGTI3')!;
  assert.equal(s.feedTime, null);
  assert.equal(s.feedLabel, null);
  for (const i of d.items) assert.match(i.publishedDate, /^\d{4}-\d{2}-\d{2}$/);
});

// ─── Backtest: Ibovespa × CDI ─────────────────────────────────────────────

/** Fechamentos diários sintéticos: 2 pregões por mês, o último no dia 28 (ou 27). */
function ibovFixture(from = '1999-12', to = '2026-10', growth = 0.01): DailyClose[] {
  const out: DailyClose[] = [];
  let v = 17000;
  for (let m = from; m <= to; m = addMonths(m, 1)) {
    out.push({ date: `${m}-10`, close: Math.round(v * 0.99 * 100) / 100 });
    v *= 1 + growth;
    out.push({ date: `${m}-${m.endsWith('-02') ? '27' : '28'}`, close: Math.round(v * 100) / 100 });
  }
  return out;
}
function cdiFixture(from = '2000-01', to = '2026-10', rate = 1): MonthlyRate[] {
  const out: MonthlyRate[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push({ month: m, rate: m === to ? 0.2 : rate });
  return out;
}

test('backtest: formato exato, base 100 em jan/2000, só meses completos e tabela de 1, 5, 10 e 15 anos', () => {
  const { data, gaps } = buildBacktest(ibovFixture(), cdiFixture(), { now: NOW });
  assert.deepEqual(gaps, []);
  assert.deepEqual(Object.keys(data), ['updated', 'ibov', 'cdi', 'table']);
  assert.deepEqual(Object.keys(data.ibov), ['name', 'note', 'series']);
  assert.deepEqual(Object.keys(data.cdi), ['name', 'series']);
  assert.equal(data.ibov.name, 'Ibovespa');
  // O Ibovespa é índice de RETORNO TOTAL pela metodologia da B3 ("Tipo de retorno: Total"): os
  // pontos já trazem os proventos reinvestidos. Dizer "índice de preço" ou "sem dividendos" é falso.
  assert.equal(data.ibov.note, 'índice de retorno total, com proventos reinvestidos');
  assert.doesNotMatch(data.ibov.note, /índice de preço|sem dividendos|sem proventos/i);
  assert.equal(data.cdi.name, 'CDI');
  assert.deepEqual(data.ibov.series[0], ['2000-01', 100]);
  assert.deepEqual(data.cdi.series[0], ['2000-01', 100]);
  // Outubro/2026 é o mês corrente (parcial): fica fora. Último ponto = set/2026, último pregão dele.
  assert.equal(data.ibov.series[data.ibov.series.length - 1][0], '2026-09');
  assert.equal(data.updated, '2026-09-28');
  assert.equal(data.ibov.series.length, 321);                       // jan/2000 a set/2026
  // CDI de 1% a.m. composto: 12 meses = 12,68%.
  assert.equal(data.cdi.series[12][1], 112.68);
  assert.deepEqual(data.table.map((t) => t.years), [1, 5, 10, 15]);
  for (const t of data.table) {
    assert.deepEqual(Object.keys(t), ['years', 'ibov', 'cdi']);
    const n = data.cdi.series.length - 1;
    const i = n - 12 * t.years;
    assert.equal(t.cdi, Math.round((data.cdi.series[n][1] / data.cdi.series[i][1] - 1) * 1e4) / 1e4);
    assert.equal(t.ibov, Math.round((data.ibov.series[n][1] / data.ibov.series[i][1] - 1) * 1e4) / 1e4);
  }
  assert.equal(data.table[0].cdi, 0.1268);
  assert.equal(data.table[0].ibov, 0.1268);                         // 1% ao mês nos dois
  assert.deepEqual(validateBacktest(data, NOW, gaps), { problems: [], warnings: [] });
  assert.ok(JSON.stringify(data).length < 20_000);
});

test('backtest: buraco, série curta, dado parado e valor absurdo não publicam', () => {
  const holes = ibovFixture().filter((d) => !d.date.startsWith('2015-03'));
  const r1 = buildBacktest(holes, cdiFixture(), { now: NOW });
  assert.match(validateBacktest(r1.data, NOW, r1.gaps).problems.join(), /meses sem dado: 2015-03 \(Ibovespa\)/);
  const r2 = buildBacktest(ibovFixture('2015-01'), cdiFixture('2015-01'), { now: NOW });
  assert.match(validateBacktest(r2.data, NOW, r2.gaps).problems.join(), /mínimo 181/);
  const r3 = buildBacktest(ibovFixture(), cdiFixture('2000-01', '2026-06'), { now: NOW });
  assert.match(validateBacktest(r3.data, NOW, r3.gaps).problems.join(), /2026-06 \(4 meses\)/);
  const crash = ibovFixture().map((d) => (d.date === '2010-05-28' ? { ...d, close: d.close * 3 } : d));
  const r4 = buildBacktest(crash, cdiFixture(), { now: NOW });
  assert.match(validateBacktest(r4.data, NOW, r4.gaps).problems.join(), /Ibovespa variou/);
  const r5 = buildBacktest(ibovFixture(), cdiFixture().map((c) => (c.month === '2012-07' ? { ...c, rate: 9 } : c)), { now: NOW });
  assert.match(validateBacktest(r5.data, NOW, r5.gaps).problems.join(), /CDI de 9,00%|CDI de 9.00%/);
  // Mês passado ainda sem CDI (no 1º dia útil): publica com aviso.
  const r6 = buildBacktest(ibovFixture(), cdiFixture('2000-01', '2026-08'), { now: NOW });
  const v6 = validateBacktest(r6.data, NOW, r6.gaps);
  assert.deepEqual(v6.problems, []);
  assert.match(v6.warnings.join(), /2026-08/);
});

test('backtest: produtor escreve o dados.json e, com dado ruim ou vazio, mantém o anterior e avisa', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ferr-bt-'));
  const warnings: string[] = [];
  const w = console.warn;
  console.warn = (m: unknown) => { warnings.push(String(m)); };
  try {
    const ok = await produceBacktest({ outRoot: dir, now: NOW, fetch: false, data: { ibov: ibovFixture(), cdi: cdiFixture() } });
    assert.ok(ok);
    const file = join(dir, BACKTEST_JSON);
    assert.ok(existsSync(file));
    assert.equal(BACKTEST_JSON, 'ferramentas/backtest-de-carteira/dados.json');
    const before = readFileSync(file, 'utf-8');
    assert.deepEqual(JSON.parse(before), ok);
    assert.deepEqual(readBacktestFile(dir), ok);
    // Vazio, buraco e falha de busca: o arquivo não muda.
    assert.equal(await produceBacktest({ outRoot: dir, now: NOW, fetch: false, data: { ibov: [], cdi: cdiFixture() } }), null);
    assert.equal(await produceBacktest({ outRoot: dir, now: NOW, fetch: false, data: { ibov: ibovFixture('2020-01'), cdi: cdiFixture('2020-01') } }), null);
    assert.equal(await produceBacktest({ outRoot: dir, now: NOW, fetch: false, data: { ibov: null, cdi: null } }), null);
    assert.equal(readFileSync(file, 'utf-8'), before);
    assert.ok(warnings.length >= 3);
    assert.ok(warnings.every((m) => /^::warning title=Ferramentas::backtest não atualizado \(o dados\.json anterior continua\)/.test(m)));
  } finally {
    console.warn = w;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('backtest: arquivo corrompido no disco não é lido como bom', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ferr-bt2-'));
  try {
    mkdirSync(join(dir, 'ferramentas', 'backtest-de-carteira'), { recursive: true });
    writeFileSync(join(dir, BACKTEST_JSON), '{"updated":"ontem"}');
    assert.equal(readBacktestFile(dir), null);
    assert.equal(readBacktestFile(join(dir, 'nada')), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cortes publicados nos limites batem com RANKING_DEFAULTS', () => {
  const { limits } = rank().data;
  assert.equal(limits.plMin, RANKING_DEFAULTS.plMin);
  assert.equal(limits.plMax, RANKING_DEFAULTS.plMax);
  assert.equal(limits.pvpMin, RANKING_DEFAULTS.pvpMin);
  assert.equal(limits.pvpMax, RANKING_DEFAULTS.pvpMax);
  assert.equal(limits.roeMin, RANKING_DEFAULTS.roeMin);
  assert.equal(limits.roeMax, RANKING_DEFAULTS.roeMax);
  assert.equal(limits.statementMaxAgeDays, 200);
});
