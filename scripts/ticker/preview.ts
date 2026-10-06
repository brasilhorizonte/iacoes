/**
 * Gera SÓ as páginas de ticker pedidas, sem mexer em sitemap, índices nem valuations.json.
 * Uso: npx tsx scripts/ticker/preview.ts PETR4 VALE3
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getAllTickersWithSector, getCvmDocuments } from '../supabase';
import { getFinancialData, performValuation } from '../valuation';
import { SCENARIO_PRESETS, DEFAULT_COST_OF_DEBT } from '../constants';
import { generateTickerPage, buildTickerCss } from './render';

async function main() {
  const tickers = process.argv.slice(2).map(t => t.toUpperCase());
  if (!tickers.length) { console.error('Informe ao menos um ticker.'); process.exit(1); }
  buildTickerCss();
  const all = await getAllTickersWithSector();
  for (const t of tickers) {
    const data = await getFinancialData(t);
    const val = performValuation(data, { ...SCENARIO_PRESETS.BASE, costOfDebt: DEFAULT_COST_OF_DEBT, taxRate: 0.34 });
    const dir = join(__dirname, '..', '..', t);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), generateTickerPage(data, val, all, getCvmDocuments(t)), 'utf-8');
    console.log(`  ✓ ${t}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
