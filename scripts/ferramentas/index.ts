/**
 * Páginas /ferramentas/ (SPEC §3, §4 e §7) — geração no build diário.
 *
 * generateFerramentas({ outRoot }) escreve, em `outRoot`:
 *   - o bundle dos widgets (assets/js/ferramentas.js e assets/css/ferramentas.css, com hash);
 *   - os JSONs públicos com dado real (ferramentas/ranking-de-acoes/dados.json e
 *     ferramentas/fatos-relevantes/dados.json), que a landing também lê;
 *   - a página de cada ferramenta `pronto` e o hub /ferramentas/;
 * e devolve as entradas do sitemap (lastmod = data do dado ou da revisão do conteúdo).
 *
 * Ferramenta em `rascunho` nunca é escrita na raiz do site (o cron faz git add -A): só na prévia,
 * com noindex (scripts/ferramentas/preview.ts).
 *
 * Nunca derruba o build: dado vazio, velho ou incompleto vira ::warning:: no log do CI, o JSON
 * anterior não é sobrescrito e a página anterior continua no ar e no sitemap.
 */
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { macroEnabled } from '../macro';
import {
  anonClient, bestName, buildFatos, buildRanking, fetchCvmRows, fetchQuotes, readDividendsFile, TICKER_RE, validateFatos, validateRanking,
} from './data';
import { stampAssetVersions, writeBundle, type BundleResult } from './bundle';
import { buildHubModel, buildToolModel, needsData, publishProblems, seoProblems, type RenderEnv } from './model';
import { buildToolsCss, renderHub, renderToolPage } from './render';
import { DATA_JSON, HUB_PATH, HUB_URL, TOOLS, toolPath, toolUrl } from './registry';
import type { CvmRow, DividendsByTicker, FatosData, QuoteRow, RankingData, SitemapEntry, ToolContent, ToolId } from './types';

export type { SitemapEntry } from './types';

const warn = (msg: string) => console.warn(`::warning title=Ferramentas::${msg}`);
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** O que o generate-pages.ts já calculou nesta execução. */
export interface BuildInputs {
  /** widgetValuations do gerador: `divTTM` = proventos de 12 meses ajustados por desdobramento. */
  valuations?: Record<string, { divTTM?: number }>;
  /** /{TICKER}/index.html é página real (não redirect). */
  hasPage?: (ticker: string) => boolean;
  /** /airton/{TICKER}/ existentes. */
  airton?: ReadonlySet<string>;
}

/** Dados prontos (testes e prévia). `null` = a busca falhou; ausente = buscar no Supabase. */
export interface FerramentasData {
  quotes?: QuoteRow[] | null;
  cvm?: CvmRow[] | null;
  dividends?: DividendsByTicker;
}

export interface GenerateOptions {
  /** Onde escrever: a raiz do site no build; preview/ na prévia. */
  outRoot: string;
  /** Raiz do site real, para conferir páginas existentes (padrão: outRoot). */
  siteRoot?: string;
  /** Prefixo dos links de /ferramentas/, assets e JSONs ('' em produção, '/preview' na prévia). */
  basePath?: string;
  /** Prévia: escreve também as ferramentas em rascunho (com noindex). */
  includeDrafts?: boolean;
  data?: FerramentasData;
  build?: BuildInputs;
  /** false = não busca nada no Supabase (testes). */
  fetch?: boolean;
  /** Atualiza o ?v= do bundle no index.html de outRoot (a landing). Padrão: true. */
  stampLanding?: boolean;
  now?: Date;
}

// ─── Disco ────────────────────────────────────────────────────────────────

/** /{T}/index.html existe e não é stub de redirect (mesma regra do hasRealPage do gerador). */
export function realPage(siteRoot: string, ticker: string): boolean {
  let fd: number | null = null;
  try {
    fd = openSync(join(siteRoot, ticker, 'index.html'), 'r');
    const buf = Buffer.alloc(2048);
    const n = readSync(fd, buf, 0, buf.length, 0);
    return !buf.toString('utf-8', 0, n).includes('http-equiv="refresh"');
  } catch {
    return false;
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

function airtonOnDisk(siteRoot: string): Set<string> {
  const dir = join(siteRoot, 'airton');
  if (!existsSync(dir)) return new Set();
  return new Set(readdirSync(dir).filter((d) => TICKER_RE.test(d) && existsSync(join(dir, d, 'index.html'))));
}

function tickersOnDisk(siteRoot: string): string[] {
  try {
    return readdirSync(siteRoot).filter((d) => TICKER_RE.test(d) && statSync(join(siteRoot, d)).isDirectory());
  } catch {
    return [];
  }
}

/** Entrada do sitemap de uma página que já está no disco (dado da execução falhou). */
function existingEntry(outRoot: string, t: ToolContent): SitemapEntry | null {
  const file = join(outRoot, toolPath(t), 'index.html');
  if (!existsSync(file)) return null;
  const html = readFileSync(file, 'utf-8');
  if (/<meta name="robots" content="noindex/.test(html)) return null;   // rascunho perdido no disco
  const lastmod = /"dateModified":"(\d{4}-\d{2}-\d{2})"/.exec(html)?.[1] ?? t.contentRevised;
  return { loc: toolUrl(t), lastmod, changefreq: needsData(t) ? 'daily' : 'monthly', priority: '0.8' };
}

function existingEntries(outRoot: string): SitemapEntry[] {
  const out: SitemapEntry[] = [];
  const hub = join(outRoot, HUB_PATH, 'index.html');
  if (existsSync(hub)) {
    const lastmod = /"dateModified":"(\d{4}-\d{2}-\d{2})"/.exec(readFileSync(hub, 'utf-8'))?.[1];
    if (lastmod) out.push({ loc: HUB_URL, lastmod, changefreq: 'weekly', priority: '0.8' });
  }
  for (const t of TOOLS) if (t.status === 'pronto') { const e = existingEntry(outRoot, t); if (e) out.push(e); }
  return out;
}

function writeJson(outRoot: string, path: string, data: unknown): void {
  const file = join(outRoot, path);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, JSON.stringify(data), 'utf-8');
}

// ─── Dados ────────────────────────────────────────────────────────────────

function produceRanking(quotes: QuoteRow[], dividends: DividendsByTicker, hasPage: (t: string) => boolean, outRoot: string, now: Date): RankingData | null {
  const { data, excluded } = buildRanking(quotes, dividends, { hasPage });
  const { problems, warnings } = validateRanking(data, now);
  for (const x of excluded) warn(`ranking: ${x.t} — ${x.reason}`);
  for (const w of warnings) warn(`ranking: ${w}`);
  if (problems.length) {
    warn(`ranking não atualizado (o dados.json anterior continua): ${problems.join('; ')}`);
    return null;
  }
  writeJson(outRoot, DATA_JSON.ranking, data);
  return data;
}

function produceFatos(cvm: CvmRow[], quotes: QuoteRow[] | null, look: { page: (t: string) => boolean; airton: (t: string) => boolean; known: string[] }, outRoot: string, now: Date): FatosData | null {
  const names = new Map<string, string>((quotes ?? []).map((q) => [q.symbol, bestName(q.shortName, q.longName)]));
  const data = buildFatos(cvm, { ...look, names, now });
  const { problems, warnings } = validateFatos(data, now);
  for (const w of warnings) warn(`fatos relevantes: ${w}`);
  if (problems.length) {
    warn(`fatos relevantes não atualizados (o dados.json anterior continua): ${problems.join('; ')}`);
    return null;
  }
  writeJson(outRoot, DATA_JSON.fatos, data);
  return data;
}

function stampLanding(outRoot: string, b: BundleResult): void {
  const file = join(outRoot, 'index.html');
  if (!existsSync(file)) return;
  const html = readFileSync(file, 'utf-8');
  const out = stampAssetVersions(html, b);
  if (out !== html) {
    writeFileSync(file, out, 'utf-8');
    console.log(`🧰 index.html: ?v= do bundle de ferramentas atualizado (js ${b.jsHash}, css ${b.cssHash})`);
  }
}

// ─── Geração ──────────────────────────────────────────────────────────────

export async function generateFerramentas(opts: GenerateOptions): Promise<SitemapEntry[]> {
  const outRoot = opts.outRoot;
  const siteRoot = opts.siteRoot ?? outRoot;
  const basePath = opts.basePath ?? '';
  const now = opts.now ?? new Date();
  try {
    buildToolsCss();

    let bundle: BundleResult | null = null;
    try {
      bundle = writeBundle(outRoot);
      if (opts.stampLanding !== false) stampLanding(outRoot, bundle);
    } catch (e) {
      warn(`bundle dos widgets não gerado (as páginas saem só com o conteúdo do servidor): ${errMsg(e)}`);
    }

    const hasPage = opts.build?.hasPage ?? ((t: string) => realPage(siteRoot, t));
    const airtonSet = opts.build?.airton ?? airtonOnDisk(siteRoot);

    let quotes = opts.data?.quotes;
    let cvm = opts.data?.cvm;
    if ((quotes === undefined || cvm === undefined) && opts.fetch !== false) {
      try {
        const sb = anonClient();
        if (quotes === undefined) quotes = await fetchQuotes(sb).catch((e) => { warn(`brapi_quotes: ${errMsg(e)}`); return null; });
        if (cvm === undefined) cvm = await fetchCvmRows(sb, now).catch((e) => { warn(`cvm_documents: ${errMsg(e)}`); return null; });
      } catch (e) {
        warn(`Supabase indisponível (ranking e fatos ficam como estão): ${errMsg(e)}`);
      }
    }

    // Proventos: valuations.json do disco (último build) por baixo, o desta execução por cima.
    const dividends: DividendsByTicker = { ...readDividendsFile(siteRoot), ...(opts.data?.dividends ?? {}) };
    for (const [t, v] of Object.entries(opts.build?.valuations ?? {})) {
      if (v && typeof v.divTTM === 'number' && Number.isFinite(v.divTTM) && v.divTTM >= 0) dividends[t] = { divTTM: v.divTTM };
    }

    const ranking = quotes ? produceRanking(quotes, dividends, hasPage, outRoot, now) : null;
    const known = quotes ? quotes.map((q) => q.symbol) : tickersOnDisk(siteRoot);
    const fatos = cvm ? produceFatos(cvm, quotes ?? null, { page: hasPage, airton: (t) => airtonSet.has(t), known }, outRoot, now) : null;

    const candidates = TOOLS.filter((t) => t.status === 'pronto' || opts.includeDrafts);
    const hasData = (t: ToolContent) => !needsData(t) || (t.dataSource === 'ranking' ? !!ranking : !!fatos);
    const render = candidates.filter(hasData);
    const kept = candidates.filter((t) => !hasData(t) && existingEntry(outRoot, t));
    const published = new Set<ToolId>([...render, ...kept].map((t) => t.id));

    const env: RenderEnv = {
      published,
      macroPage: macroEnabled() && existsSync(join(siteRoot, 'macro', 'indicador-de-buffett', 'index.html')),
      basePath,
      assets: { js: bundle ? `${basePath}${bundle.jsUrl}` : null, css: bundle ? `${basePath}${bundle.cssUrl}` : null },
      ranking,
      fatos,
    };

    const entries: SitemapEntry[] = [];
    const written: string[] = [];
    for (const t of render) {
      try {
        const m = buildToolModel(t, env);
        for (const p of seoProblems(m)) warn(`${t.id}: ${p}`);
        if (t.status === 'pronto') for (const p of publishProblems(t)) warn(`${t.id}: ${p}`);
        const dir = join(outRoot, toolPath(t));
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'index.html'), renderToolPage(m), 'utf-8');
        written.push(t.status === 'pronto' ? t.slug : `${t.slug} (rascunho)`);
        if (t.status === 'pronto') entries.push({ loc: m.url, lastmod: m.dateModified, changefreq: m.refDate ? 'daily' : 'monthly', priority: '0.8' });
      } catch (e) {
        warn(`${t.id}: página não regerada (a anterior continua): ${errMsg(e)}`);
        published.delete(t.id);
        const prev = t.status === 'pronto' ? existingEntry(outRoot, t) : null;
        if (prev) { entries.push(prev); published.add(t.id); }
      }
    }
    for (const t of kept) {
      if (t.status !== 'pronto') continue;
      const prev = existingEntry(outRoot, t);
      if (prev) entries.push(prev);
    }

    const hub = buildHubModel(env);
    mkdirSync(join(outRoot, HUB_PATH), { recursive: true });
    writeFileSync(join(outRoot, HUB_PATH, 'index.html'), renderHub(hub), 'utf-8');
    entries.unshift({ loc: HUB_URL, lastmod: hub.dateModified, changefreq: 'weekly', priority: '0.8' });

    console.log(
      `🧰 Ferramentas: hub + ${written.length} página(s) [${written.join(', ') || '—'}]` +
      ` · ranking ${ranking ? `${ranking.count} ações (${ranking.dateBR})` : 'mantido'}` +
      ` · fatos ${fatos ? `${fatos.count} documentos (${fatos.updatedBR})` : 'mantido'}` +
      ` · bundle ${bundle ? `js ${bundle.jsHash} (${bundle.widgets.join(', ') || 'só runtime'})` : 'ausente'}`,
    );
    return entries;
  } catch (e) {
    warn(`erro ao gerar as ferramentas (as páginas anteriores continuam): ${errMsg(e)}`);
    return existingEntries(outRoot);
  }
}
