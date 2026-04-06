import 'dotenv/config';
import { mkdirSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { getAllTickers, getTickersWithNames, getAllTickersWithSector, getPeersBySector, fetchQualitativeScore, saveQualitativeCache } from './supabase';
import { getFinancialData, performValuation } from './valuation';
import { generateTickerHTML, generateIndexHTML, generateSectorPage, generateSitemap, generateRobots, sectorSlug } from './template';
import { SCENARIO_PRESETS, DEFAULT_COST_OF_DEBT } from './constants';
import type { ValuationAssumptions, TickerIndexEntry, PeerTicker } from './types';

const ROOT = join(__dirname, '..');
const BATCH_SIZE = 5;
const DELAY_MS = 300;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

let allTickerData: TickerIndexEntry[] = [];
const tickerLastmod: Record<string, string> = {};

interface WidgetValuation {
  name: string;
  sector: string;
  price: number;
  graham: number;
  bazin: number;
  gordon: number;
  lpa: number;
  vpa: number;
  divTTM: number;
  avgDiv: Record<string, number>; // dividends by year-window: "1","3","5","10"
}
const widgetValuations: Record<string, WidgetValuation> = {};

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

    // Extrair lastmod dinâmico (data mais recente dos dados financeiros)
    const allDates = [
      ...data._rawIncome.map(d => d.end_date),
      ...data._rawBalance.map(d => d.end_date),
      ...data._rawCashFlow.map(d => d.end_date),
      ...data._rawDividends.map(d => d.exDate),
    ].filter(Boolean).map(d => new Date(d).getTime()).filter(t => !isNaN(t));
    if (allDates.length > 0) {
      const maxDate = new Date(Math.max(...allDates));
      const today = new Date();
      const capped = maxDate > today ? today : maxDate;
      tickerLastmod[ticker] = capped.toISOString().split('T')[0];
    }

    const peers: PeerTicker[] = getPeersBySector(allTickerData, ticker, 8);
    const qualScore = await fetchQualitativeScore(ticker);
    const html = generateTickerHTML(data, val, peers, qualScore);
    const dir = join(ROOT, ticker);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html, 'utf-8');

    // Widget valuation data (Graham, Bazin, Gordon)
    const grahamFV = val.results.find(r => r.method === 'GRAHAM')?.fairValue || 0;
    const gordonFV = val.results.find(r => r.method === 'GORDON')?.fairValue || 0;
    const fiveYearsAgo = new Date(); fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const recentDivs = data._rawDividends.filter(d => new Date(d.exDate) >= oneYearAgo);
    const divTTM = recentDivs.reduce((sum, d) => sum + d.amount, 0);
    const fiveYearDivs = data._rawDividends.filter(d => new Date(d.exDate) >= fiveYearsAgo);
    const avgDiv5y = fiveYearDivs.length > 0 ? fiveYearDivs.reduce((s, d) => s + d.amount, 0) / 5 : divTTM;
    const bazinFV = avgDiv5y > 0 ? avgDiv5y / 0.06 : 0;

    // Compute avg dividends for multiple year windows
    const now = new Date();
    const avgDivByWindow: Record<string, number> = {};
    for (const y of [1, 3, 5, 10]) {
      const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - y);
      const windowDivs = data._rawDividends.filter(d => new Date(d.exDate) >= cutoff);
      avgDivByWindow[String(y)] = windowDivs.length > 0
        ? Math.round((windowDivs.reduce((s, d) => s + d.amount, 0) / y) * 100) / 100
        : 0;
    }

    widgetValuations[ticker] = {
      name: data.fundamentals.name,
      sector: data.fundamentals.sector,
      price: data.price,
      graham: Math.round(grahamFV * 100) / 100,
      bazin: Math.round(bazinFV * 100) / 100,
      gordon: Math.round(gordonFV * 100) / 100,
      lpa: Math.round(data.fundamentals.lpa * 100) / 100,
      vpa: Math.round(data.fundamentals.vpa * 100) / 100,
      divTTM: Math.round(divTTM * 100) / 100,
      avgDiv: avgDivByWindow,
    };

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

      // Generate sector pages (/acoes/{setor}/index.html)
      const sectors = [...new Set(indexTickers.map(t => t.sector).filter(Boolean))].sort();
      for (const sector of sectors) {
        const sectorTickers = indexTickers.filter(t => t.sector === sector).sort((a, b) => b.marketCap - a.marketCap);
        if (sectorTickers.length === 0) continue;
        const slug = sectorSlug(sector);
        const sectorDir = join(ROOT, 'acoes', slug);
        mkdirSync(sectorDir, { recursive: true });
        writeFileSync(join(sectorDir, 'index.html'), generateSectorPage(sector, sectorTickers), 'utf-8');
      }
      console.log(`📂 ${sectors.length} páginas de setor geradas (/acoes/{setor}/)`);
    }

    // Sitemap includes ALL existing ticker pages on disk, not just current run
    const allTickerDirs = readdirSync(ROOT).filter(d => {
      if (d === 'acoes' || d === 'assets' || d === 'scripts' || d === 'node_modules' || d.startsWith('.')) return false;
      if (d !== d.toUpperCase()) return false;
      const p = join(ROOT, d, 'index.html');
      try { return statSync(p).isFile(); } catch { return false; }
    });
    // Get sectors for sitemap
    const allSectors = [...new Set(allTickerData.map(t => t.sector).filter(Boolean))].sort();
    const sitemap = generateSitemap(allTickerDirs, allSectors, tickerLastmod);
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

    // Generate valuations.json for landing page widget
    // Data de fechamento = dia útil anterior em BRT (o build roda após o fechamento)
    const nowBRT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    nowBRT.setDate(nowBRT.getDate() - 1); // dia anterior (fechamento)
    // Pular fim de semana: se caiu no domingo, volta para sexta; se sábado, volta para sexta
    const dow = nowBRT.getDay();
    if (dow === 0) nowBRT.setDate(nowBRT.getDate() - 2);
    else if (dow === 6) nowBRT.setDate(nowBRT.getDate() - 1);
    const quoteDate = nowBRT.toISOString().split('T')[0];
    const valuationsWithMeta = { _quoteDate: quoteDate, ...widgetValuations };
    writeFileSync(join(ROOT, 'valuations.json'), JSON.stringify(valuationsWithMeta), 'utf-8');
    console.log(`📊 valuations.json gerado (${Object.keys(widgetValuations).length} tickers, data: ${today})`);
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

  saveQualitativeCache();
  console.log(`\n✅ Concluído: ${success} geradas, ${failed} falhas (de ${tickers.length} total)\n`);
}

main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
