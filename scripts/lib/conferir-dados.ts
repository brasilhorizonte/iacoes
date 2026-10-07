/**
 * Conferência das correções de dado do gerador (SPEC §6): imprime ANTES/DEPOIS por ticker.
 *
 *   npx tsx scripts/lib/conferir-dados.ts                  # SBSP3 PETR4 TAEE11 CSAN3 BBSE3
 *   npx tsx scripts/lib/conferir-dados.ts VIVT3 EGIE3      # outros tickers
 *   npx tsx scripts/lib/conferir-dados.ts --lista          # DY da lista (/acoes/, pares) que muda
 *
 * SOMENTE LEITURA: consulta o Supabase com a anon key e não escreve arquivo nenhum.
 * "Antes" = o que o build publicava (proventos como declarados, DY do banco, regras antigas do
 * valuations.json); "depois" = o que o build publica agora.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { getFinancialData, performValuation } from '../valuation';
import { fetchStockSplits, getAllTickersWithSector } from '../supabase';
import { buildModel } from '../ticker/model';
import { SCENARIO_PRESETS, DEFAULT_COST_OF_DEBT } from '../constants';
import { toShareBaseSplits } from './splits';
import { widgetValuationFields } from './valuations-json';
import { previousBusinessDayBRT, quoteDateFromTimes } from './dates';
import type { ComprehensiveValuation, FinancialData, RawDividend } from '../types';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

const brl = (v: number) => (Number.isFinite(v) ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—');
const pct = (v: number) => (Number.isFinite(v) ? `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '—');
const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length));

/** Proventos como declarados na época (desfaz o ajuste de fetchFinancials). */
const declared = (divs: RawDividend[]): RawDividend[] =>
  divs.map(d => ({ ...d, amount: d.amountDeclared ?? d.amount, amountDeclared: undefined, splitDivisor: undefined }));

/** A regra que o valuations.json usava até esta correção (cópia fiel, só para comparar). */
function oldWidget(divs: RawDividend[], val: ComprehensiveValuation) {
  const grahamFV = val.results.find(r => r.method === 'GRAHAM')?.fairValue || 0;
  const gordonFV = val.results.find(r => r.method === 'GORDON')?.fairValue || 0;
  const fiveYearsAgo = new Date(); fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const divTTM = divs.filter(d => new Date(d.exDate) >= oneYearAgo).reduce((s, d) => s + d.amount, 0);
  const five = divs.filter(d => new Date(d.exDate) >= fiveYearsAgo);
  const avgDiv5y = five.length > 0 ? five.reduce((s, d) => s + d.amount, 0) / 5 : divTTM;
  const r2 = (x: number) => Math.round(x * 100) / 100;
  return { graham: r2(grahamFV), bazin: r2(avgDiv5y > 0 ? avgDiv5y / 0.06 : 0), gordon: r2(gordonFV), divTTM: r2(divTTM), avg5: r2(five.length ? five.reduce((s, d) => s + d.amount, 0) / 5 : 0) };
}

async function conferir(ticker: string, reportedDY: Map<string, number>): Promise<string | null> {
  let data: FinancialData;
  try {
    data = await getFinancialData(ticker);
  } catch (e: any) {
    console.log(`\n${ticker}: sem dados (${e.message})`);
    return null;
  }
  const val = performValuation(data, { ...SCENARIO_PRESETS.BASE, costOfDebt: DEFAULT_COST_OF_DEBT, taxRate: 0.34 });
  const reported = reportedDY.get(ticker) ?? 0;
  const before: FinancialData = { ...data, _rawDividends: declared(data._rawDividends), fundamentals: { ...data.fundamentals, divYield: reported } };
  const mA = buildModel(before, val, [], []);
  const mD = buildModel(data, val, [], []);
  const old = oldWidget(before._rawDividends, val);
  const now = widgetValuationFields(mD);

  const events = toShareBaseSplits(await fetchStockSplits([ticker]));
  const touched = data._rawDividends.filter(d => d.splitDivisor !== undefined);

  console.log(`\n${ticker} — ${data.fundamentals.name} — ${brl(data.price)} (regular_market_time ${data.quoteTime ?? '—'})`);
  console.log(`  eventos de base: ${events.length ? events.sort((a, b) => a.exDate.localeCompare(b.exDate)).map(s => `${s.exDate} ×${s.factor}`).join(' · ') : 'nenhum'}`);
  console.log(`  proventos ajustados: ${touched.length} de ${data._rawDividends.length}${touched.length ? ` (ex.: ${touched[0].exDate} ${brl(touched[0].amountDeclared!)} → ${brl(touched[0].amount)}, ÷${touched[0].splitDivisor!.toFixed(4)})` : ''}`);
  const rows: [string, string, string][] = [
    ['Página: DY (hero, métricas, SEO)', pct(reported), pct(data.fundamentals.divYield)],
    ['Página: DY 12m (seção proventos)', pct(mA.div.dyTTM), pct(mD.div.dyTTM)],
    ['Página: proventos 12m', brl(mA.div.ttm), brl(mD.div.ttm)],
    ['Página: média 5 anos', brl(mA.div.avg['5']), brl(mD.div.avg['5'])],
    ['Página: Graham', brl(mA.calc.graham.fv), brl(mD.calc.graham.fv)],
    ['Página: Bazin (DY 6%)', brl(mA.calc.bazin.fv), brl(mD.calc.bazin.fv)],
    ['Página: Gordon (14% / 4%)', brl(mA.calc.gordon.fv), brl(mD.calc.gordon.fv)],
    ['valuations.json: graham', String(old.graham), String(now.graham)],
    ['valuations.json: bazin', String(old.bazin), String(now.bazin)],
    ['valuations.json: gordon', String(old.gordon), String(now.gordon)],
    ['valuations.json: divTTM', String(old.divTTM), String(now.divTTM)],
    ['valuations.json: avgDiv["5"]', String(old.avg5), String(now.avgDiv['5'])],
  ];
  console.log(`  ${pad('', 36)} ${pad('antes', 16)} depois`);
  for (const [k, a, d] of rows) console.log(`  ${pad(k, 36)} ${pad(a, 16)} ${d}${a === d ? '' : '   ←'}`);
  // As duas réguas do json agora batem com o que a página mostra.
  const parity = brl(now.graham) === brl(mD.calc.graham.fv) && brl(now.bazin) === brl(mD.calc.bazin.fv) && brl(now.gordon) === brl(mD.calc.gordon.fv);
  console.log(`  valuations.json = página? ${parity ? 'sim' : 'NÃO'}`);
  return data.quoteTime ?? null;
}

async function lista() {
  const { data, error } = await supabase.from('brapi_quotes').select('symbol,dividend_yield').or('market_cap.gt.0,price.gt.0');
  if (error) throw new Error(error.message);
  const raw = new Map((data ?? []).map((r: any) => [String(r.symbol).toUpperCase(), Number(r.dividend_yield) || 0]));
  const entries = await getAllTickersWithSector();
  const changed = entries.filter(e => Math.abs((raw.get(e.ticker) ?? 0) - e.divYield) > 1e-9);
  console.log(`\nDY da lista (/acoes/, setores, pares): ${changed.length} de ${entries.length} tickers mudam`);
  for (const e of changed.sort((a, b) => (raw.get(b.ticker) ?? 0) - b.divYield - ((raw.get(a.ticker) ?? 0) - a.divYield))) {
    console.log(`  ${pad(e.ticker, 7)} ${pad(pct(raw.get(e.ticker) ?? 0), 9)} → ${pct(e.divYield)}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--lista')) return lista();
  const tickers = args.length ? args.map(t => t.toUpperCase()) : ['SBSP3', 'PETR4', 'TAEE11', 'CSAN3', 'BBSE3'];
  const { data, error } = await supabase.from('brapi_quotes').select('symbol,dividend_yield').in('symbol', tickers);
  if (error) throw new Error(error.message);
  const reportedDY = new Map((data ?? []).map((r: any) => [String(r.symbol).toUpperCase(), Number(r.dividend_yield) || 0]));

  const times: (string | null)[] = [];
  for (const t of tickers) times.push(await conferir(t, reportedDY));

  const nowDate = new Date();
  console.log(`\n_quoteDate: antes ${previousBusinessDayBRT(nowDate)} (dia útil anterior ao build) · depois ${quoteDateFromTimes(times, nowDate)} (maior regular_market_time em BRT)`);
}

main().catch(err => { console.error(err); process.exit(1); });
