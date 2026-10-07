import 'dotenv/config';
import { mkdirSync, writeFileSync, readdirSync, statSync, openSync, readSync, closeSync } from 'fs';
import { join } from 'path';
import { getAllTickers, getTickersWithNames, getAllTickersWithSector, saveQualitativeCache, getCvmDocuments, CVM_CACHE_LIMIT } from './supabase';
import { generateAirtonTickerHTML } from './airton-template';
import { getFinancialData, performValuation } from './valuation';
import { generateTickerPage, buildTickerCss } from './ticker/render';
import { buildModel } from './ticker/model';
import { widgetValuationFields } from './lib/valuations-json';
import { quoteDateFromTimes } from './lib/dates';
import { generateIndexHTML, generateSectorPage, generateSitemap, generateRobots, sectorSlug } from './template';
import { generateMacro, macroLlmsSection } from './macro';
import { generateFerramentas } from './ferramentas';
import { composeLlmsTxt } from './ferramentas/llms';
import { SCENARIO_PRESETS, DEFAULT_COST_OF_DEBT } from './constants';
import type { ValuationAssumptions, TickerIndexEntry } from './types';

const ROOT = join(__dirname, '..');
const BATCH_SIZE = 5;
const DELAY_MS = 300;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * /{TICKER}/index.html existe e é página de verdade — não um redirect (stub com meta refresh,
 * como ELET3 → AXIA3). Lê só o começo do arquivo: o stub se denuncia no <head>.
 *
 * ⚠️ Ter cotação não basta: AXIA6 e CTAX3 estão no Supabase, mas a geração delas falha todo
 * dia, e /acoes/, setores e pares linkavam as duas — 47 páginas com link 404 (GSC, out/2026).
 */
function hasRealPage(ticker: string): boolean {
  let fd: number | null = null;
  try {
    fd = openSync(join(ROOT, ticker, 'index.html'), 'r');
    const buf = Buffer.alloc(2048);
    const n = readSync(fd, buf, 0, buf.length, 0);
    return !buf.toString('utf-8', 0, n).includes('http-equiv="refresh"');
  } catch {
    return false;
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

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
// regular_market_time de cada ticker publicado no valuations.json (vira o `_quoteDate`)
const quoteTimes: (string | null | undefined)[] = [];

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

    // Página de ticker: React + shadcn/ui renderizados para HTML estático (scripts/ticker/).
    const html = generateTickerPage(data, val, allTickerData, getCvmDocuments(ticker));
    const dir = join(ROOT, ticker);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html, 'utf-8');

    // /airton/{TICKER}/ — só existe para ticker com documento real na CVM.
    // Sem documento não há página: um mock vazio seria pior do que nada.
    const airtonDocs = getCvmDocuments(ticker, CVM_CACHE_LIMIT);
    if (airtonDocs.length > 0) {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
      const cutoffISO = cutoff.toISOString().slice(0, 10);
      const in90 = airtonDocs.filter(d => d.date >= cutoffISO).length;
      const airtonHtml = generateAirtonTickerHTML({
        symbol: ticker,
        name: data.fundamentals.name,
        sector: data.fundamentals.sector,
        docs: airtonDocs,
        docsIn90Days: in90,
        docsIn90DaysCapped: in90 >= CVM_CACHE_LIMIT,
      });
      const airtonDir = join(ROOT, 'airton', ticker);
      mkdirSync(airtonDir, { recursive: true });
      writeFileSync(join(airtonDir, 'index.html'), airtonHtml, 'utf-8');
    }

    // valuations.json (landing e calculadora): Graham, Bazin e Gordon são os números padrão
    // que a página de ticker mostra — saem do mesmo modelo, com os proventos já ajustados por
    // desdobramento. Proventos (12m e médias por janela) idem. Preço justo inválido ou negativo
    // vira 0; LPA/VPA saem com 6 casas e sinal (recalcular o Graham com eles dá o `graham`).
    const w = widgetValuationFields(buildModel(data, val, allTickerData, getCvmDocuments(ticker)));
    widgetValuations[ticker] = {
      name: data.fundamentals.name,
      sector: data.fundamentals.sector,
      price: data.price,
      graham: w.graham,
      bazin: w.bazin,
      gordon: w.gordon,
      lpa: w.lpa,
      vpa: w.vpa,
      divTTM: w.divTTM,
      avgDiv: w.avgDiv,
    };
    quoteTimes.push(data.quoteTime);

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

  console.log('🎨 Compilando CSS das páginas de ticker (Tailwind + shadcn)...');
  buildTickerCss();

  // Fetch all tickers with sector data (for peers and index page)
  console.log('📊 Buscando dados de setor...');
  allTickerData = await getAllTickersWithSector();
  // Pares só linkam quem já tem página (de runs anteriores); ticker novo entra no dia seguinte.
  for (const t of allTickerData) t.hasPage = hasRealPage(t.ticker);
  console.log(`   ${allTickerData.length} tickers com dados de setor (${allTickerData.filter(t => t.hasPage).length} com página)\n`);

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
    // /airton/{TICKER}/ existentes no disco — alimenta os links de /acoes/, setores e o sitemap
    const airtonDirs = readdirSync(join(ROOT, 'airton')).filter(d => {
      if (d !== d.toUpperCase() || d.startsWith('.')) return false;
      try { return statSync(join(ROOT, 'airton', d, 'index.html')).isFile(); } catch { return false; }
    }).sort();
    const airtonSet = new Set(airtonDirs);

    // Ferramentas (/ferramentas/): hub, páginas prontas, dados.json do ranking e dos fatos
    // relevantes e o bundle dos widgets. Roda antes do macro para o rodapé das páginas macro já
    // achar o hub no disco. O DY do ranking usa os proventos desta execução (widgetValuations,
    // ajustados por desdobramento). Nunca derruba o build: dado ruim vira ::warning::.
    const toolEntries = await generateFerramentas({
      outRoot: ROOT,
      build: { valuations: widgetValuations, hasPage: hasRealPage, airton: airtonSet },
    });
    const toolsLink = toolEntries.length ? { href: '/ferramentas/', label: 'Ferramentas para analisar ações' } : undefined;

    // Páginas macro (/macro/): trava MACRO_BUFFETT_ENABLED; nunca derruba o build.
    const macroEntries = await generateMacro({ outRoot: ROOT });
    const macroLink = macroEntries.length ? { href: '/macro/indicador-de-buffett/', label: 'A bolsa está cara? Veja o Indicador de Buffett de hoje' } : undefined;

    // Generate /acoes/index.html — todos os tickers do Supabase QUE TÊM PÁGINA (inclui os gerados agora)
    const indexTickers = allTickerData.filter(t => t.price > 0 && hasRealPage(t.ticker));
    if (indexTickers.length > 0) {
      const indexHTML = generateIndexHTML(indexTickers, airtonSet, macroLink, toolsLink);
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
        writeFileSync(join(sectorDir, 'index.html'), generateSectorPage(sector, sectorTickers, airtonSet), 'utf-8');
      }
      console.log(`📂 ${sectors.length} páginas de setor geradas (/acoes/{setor}/)`);
    }

    // Sitemap includes ALL existing ticker pages on disk, not just current run — menos os redirects
    // (ELET3 → AXIA3 etc.): URL que redireciona não vai para o sitemap.
    const allTickerDirs = readdirSync(ROOT).filter(d => {
      if (d === 'acoes' || d === 'assets' || d === 'scripts' || d === 'node_modules' || d.startsWith('.')) return false;
      if (d !== d.toUpperCase()) return false;
      return hasRealPage(d);
    });
    // Get sectors for sitemap
    const allSectors = [...new Set(allTickerData.map(t => t.sector).filter(Boolean))].sort();
    const sitemap = generateSitemap(allTickerDirs, allSectors, tickerLastmod, airtonDirs, [...macroEntries, ...toolEntries]);
    writeFileSync(join(ROOT, 'sitemap.xml'), sitemap, 'utf-8');
    console.log(`📄 sitemap.xml gerado (${allTickerDirs.length} tickers, ${airtonDirs.length} páginas /airton/{TICKER}/, ${toolEntries.length} de ferramentas)`);

    // llms.txt com dono único: ferramentas + macro (só com a trava ligada) + links gerais.
    writeFileSync(join(ROOT, 'llms.txt'), composeLlmsTxt({ toolEntries, macroSection: macroLlmsSection(ROOT) }), 'utf-8');
    console.log('🤖 llms.txt gerado');

    const robots = generateRobots();
    writeFileSync(join(ROOT, 'robots.txt'), robots, 'utf-8');
    console.log('🤖 robots.txt gerado');

    // Generate tickers.json — includes ALL tickers with pages on disk
    const allTickers = await getTickersWithNames();
    const tickersIndex = allTickers.filter(t => allTickerDirs.includes(t.ticker));
    writeFileSync(join(ROOT, 'tickers.json'), JSON.stringify(tickersIndex), 'utf-8');
    console.log(`🔍 tickers.json gerado (${tickersIndex.length} tickers)`);

    // Generate valuations.json for landing page widget
    // Data da cotação = maior regular_market_time (em BRT) entre os tickers do arquivo — o build
    // das 20h BRT publica a cotação do próprio dia. Sem horário válido: dia útil anterior.
    const quoteDate = quoteDateFromTimes(quoteTimes);
    const valuationsWithMeta = { _quoteDate: quoteDate, ...widgetValuations };
    writeFileSync(join(ROOT, 'valuations.json'), JSON.stringify(valuationsWithMeta), 'utf-8');
    console.log(`📊 valuations.json gerado (${Object.keys(widgetValuations).length} tickers, data: ${quoteDate})`);
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
