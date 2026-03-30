import 'dotenv/config';
import { mkdirSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { getAllTickers, getTickersWithNames, getAllTickersWithSector, getPeersBySector } from './supabase';
import { getFinancialData, performValuation } from './valuation';
import { generateTickerHTML, generateIndexHTML, generateSitemap, generateRobots } from './template';
import { SCENARIO_PRESETS, DEFAULT_COST_OF_DEBT } from './constants';
import type { ValuationAssumptions, TickerIndexEntry, PeerTicker } from './types';

const ROOT = join(__dirname, '..');
const BATCH_SIZE = 5;
const DELAY_MS = 300;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

let allTickerData: TickerIndexEntry[] = [];

async function generatePage(ticker: string): Promise<boolean> {
  try {
    const data = await getFinancialData(ticker);
    const assumptions: ValuationAssumptions = {
      ...SCENARIO_PRESETS.BASE,
      costOfDebt: DEFAULT_COST_OF_DEBT,
      taxRate: 0.34
    };
    const val = performValuation(data, assumptions);

    if (!val.weightedFairValue || !Number.isFinite(val.weightedFairValue)) {
      console.warn(`  ⚠ ${ticker}: valuation inválido, pulando`);
      return false;
    }

    const peers: PeerTicker[] = getPeersBySector(allTickerData, ticker, 8);
    const html = generateTickerHTML(data, val, peers);
    const dir = join(ROOT, ticker);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html, 'utf-8');

    const upside = (val.totalUpside * 100).toFixed(1);
    console.log(`  ✓ ${ticker}: R$ ${data.price.toFixed(2)} → R$ ${val.weightedFairValue.toFixed(2)} (${upside}%)`);
    return true;
  } catch (err: any) {
    console.warn(`  ✗ ${ticker}: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('\n🚀 iAções — Gerador de Páginas Estáticas\n');

  // Check env
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('❌ Faltando SUPABASE_URL ou SUPABASE_ANON_KEY no .env');
    process.exit(1);
  }

  // Fetch all tickers with sector data (for peers and index page)
  console.log('📊 Buscando dados de setor...');
  allTickerData = await getAllTickersWithSector();
  console.log(`   ${allTickerData.length} tickers com dados de setor\n`);

  // Get tickers (or use CLI args)
  const cliTickers = process.argv.slice(2).map(t => t.toUpperCase());
  let tickers: string[];

  if (cliTickers.length > 0) {
    tickers = cliTickers;
    console.log(`📋 Gerando ${tickers.length} ticker(s) via CLI: ${tickers.join(', ')}\n`);
  } else {
    console.log('📋 Buscando tickers ativos no Supabase...');
    tickers = await getAllTickers();
    console.log(`   Encontrados: ${tickers.length} tickers\n`);
  }

  let success = 0;
  let failed = 0;
  const generated: string[] = [];

  // Process in batches
  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const batch = tickers.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(generatePage));
    results.forEach((ok, j) => {
      if (ok) {
        success++;
        generated.push(batch[j]);
      } else {
        failed++;
      }
    });
    if (i + BATCH_SIZE < tickers.length) await sleep(DELAY_MS);
  }

  // Generate index page, sitemap, robots.txt and tickers.json
  if (generated.length > 0) {
    // Generate /acoes/index.html — always lists ALL tickers from Supabase
    const indexTickers = allTickerData.filter(t => t.price > 0);
    if (indexTickers.length > 0) {
      const indexHTML = generateIndexHTML(indexTickers);
      const acoesDir = join(ROOT, 'acoes');
      mkdirSync(acoesDir, { recursive: true });
      writeFileSync(join(acoesDir, 'index.html'), indexHTML, 'utf-8');
      console.log(`\n📋 /acoes/index.html gerado (${indexTickers.length} tickers)`);
    }

    // Sitemap includes ALL existing ticker pages on disk, not just current run
    const allTickerDirs = readdirSync(ROOT).filter(d => {
      if (d === 'acoes' || d === 'assets' || d === 'scripts' || d === 'node_modules' || d.startsWith('.')) return false;
      const p = join(ROOT, d, 'index.html');
      try { return statSync(p).isFile(); } catch { return false; }
    });
    const sitemap = generateSitemap(allTickerDirs);
    writeFileSync(join(ROOT, 'sitemap.xml'), sitemap, 'utf-8');
    console.log(`📄 sitemap.xml gerado (${allTickerDirs.length} tickers)`);

    const robots = generateRobots();
    writeFileSync(join(ROOT, 'robots.txt'), robots, 'utf-8');
    console.log('🤖 robots.txt gerado');

    // Generate tickers.json — includes ALL tickers with pages on disk
    const allTickers = await getTickersWithNames();
    const tickersIndex = allTickers.filter(t => allTickerDirs.includes(t.ticker));
    writeFileSync(join(ROOT, 'tickers.json'), JSON.stringify(tickersIndex), 'utf-8');
    console.log(`🔍 tickers.json gerado (${tickersIndex.length} tickers)`);
  }

  // Ping search engines to re-crawl sitemap
  console.log('\n🔔 Pingando search engines...');
  const sitemapUrl = 'https://iacoes.com.br/sitemap.xml';
  const pingUrls = [
    `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
    `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
  ];
  for (const url of pingUrls) {
    try {
      const res = await fetch(url);
      const engine = url.includes('google') ? 'Google' : 'Bing';
      console.log(`   ${engine}: ${res.ok ? '✓ OK' : '✗ ' + res.status}`);
    } catch (err: any) {
      console.warn(`   Ping falhou: ${err.message}`);
    }
  }

  console.log(`\n✅ Concluído: ${success} geradas, ${failed} falhas (de ${tickers.length} total)\n`);
}

main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
