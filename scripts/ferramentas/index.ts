/**
 * Páginas /ferramentas/ (SPEC §3, §4 e §7) — geração no build diário.
 *
 * generateFerramentas({ outRoot }) escreve, em `outRoot`:
 *   - o bundle dos widgets (assets/js/ferramentas.js + assets/css/ferramentas.css; o widget
 *     pesado em assets/js/ferramentas-calc.js; todos com hash no ?v=);
 *   - os JSONs públicos com dado real (ferramentas/fatos-relevantes/dados.json sempre, porque a
 *     landing lê; ferramentas/ranking-de-acoes/dados.json e ferramentas/backtest-de-carteira/dados.json
 *     só com a ferramenta `pronto` — ver dataJsonPublishable; na prévia, todos);
 *   - a página de cada ferramenta `pronto` e o hub /ferramentas/;
 *   - ferramentas/publicadas.json: ids das ferramentas prontas com página no disco, caminhos,
 *     JSONs de dado e bundle — a landing liga um quadro só se a página dele está publicada;
 * e devolve as entradas do sitemap (lastmod = data do dado ou da atualização do conteúdo).
 *
 * Ferramenta em `rascunho` nunca é escrita na raiz do site (o cron faz git add -A): só na prévia,
 * com noindex (scripts/ferramentas/preview.ts).
 *
 * Nunca derruba o build: dado vazio, velho ou incompleto vira ::warning:: no log do CI, o JSON
 * anterior não é sobrescrito e a página anterior continua no ar e no sitemap.
 */
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  anonClient, buildFatos, buildRanking, fetchCvmRows, fetchQuotes, mergeDividendInputs, produceBacktest, readBacktestFile, readDividendsFile,
  TICKER_RE, validateFatos, validateRanking,
  type BacktestData, type DailyClose, type DividendsInfo, type MonthlyRate,
} from './data';
import { companyName } from '../lib/company-name';
import { stampAssetVersions, writeBundle, type BundleResult } from './bundle';
import {
  buildHubModel, buildToolModel, needsData, publishProblems, seoProblems, structureProblems, toolText, type DataInfo, type PageAssets, type RenderEnv,
  type ToolPageModel,
} from './model';
import { buildToolsCss, renderHub, renderToolPage } from './render';
import { DATA_JSON, HUB_PATH, HUB_URL, TOOLS, toolPath, toolUrl } from './registry';
import { unknownSections } from './sections';
import { forbiddenHits, htmlAuthorText, PUBLICADAS_PATH, type PublishedJson } from './site';
import type { CvmRow, DividendsByTicker, FatosData, QuoteRow, RankingData, SitemapEntry, ToolContent, ToolId } from './types';

export type { SitemapEntry } from './types';

const warn = (msg: string) => console.warn(`::warning title=Ferramentas::${msg}`);
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** O que o generate-pages.ts já calculou nesta execução. */
export interface BuildInputs {
  /**
   * widgetValuations do gerador: `divTTM` = proventos de 12 meses ajustados por desdobramento;
   * `avgDiv['5']` = média anual de 5 anos (vira o `dy5y` do ranking e a régua do provento atípico).
   */
  valuations?: Record<string, { divTTM?: number; avgDiv?: Record<string, number> }>;
  /**
   * Data da cotação do valuations.json desta execução (AAAA-MM-DD). Sem ela, vale o `_quoteDate`
   * do valuations.json no disco (o do build anterior: o gerador regrava o arquivo depois).
   */
  quoteDate?: string;
  /**
   * Papéis do valuations.json desta execução — o arquivo MESCLADO nas execuções com tickers na
   * linha de comando (`generate-pages.ts PETR4` publica ~335, não 1). É o {n} da calculadora. Sem
   * ele, vale o número de chaves de `valuations` (ou o do arquivo no disco).
   */
  valuationsCount?: number;
  /** /{TICKER}/index.html é página real (não redirect). */
  hasPage?: (ticker: string) => boolean;
  /** /airton/{TICKER}/ existentes. */
  airton?: ReadonlySet<string>;
}

/** Dados prontos (testes e prévia). `null` = a busca falhou; ausente = buscar no Supabase. */
export interface FerramentasData {
  quotes?: QuoteRow[] | null;
  cvm?: CvmRow[] | null;
  dividends?: DividendsByTicker | DividendsInfo;
  /** Séries do backtest prontas (testes/prévia): null = a busca falhou; ausente = buscar. */
  backtest?: { ibov?: DailyClose[] | null; cdi?: MonthlyRate[] | null };
  /**
   * Dados extras por chave, que chegam às seções SSR em m.env.extra (além de `backtest`, que o
   * gerador preenche). Ausente = {}.
   */
  extra?: Record<string, unknown>;
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

/** Primeiros bytes de um arquivo (o <head> basta para robots/refresh). */
function head(file: string, bytes = 4096): string {
  let fd: number | null = null;
  try {
    fd = openSync(file, 'r');
    const buf = Buffer.alloc(bytes);
    const n = readSync(fd, buf, 0, buf.length, 0);
    return buf.toString('utf-8', 0, n);
  } catch {
    return '';
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

/**
 * /macro/indicador-de-buffett/ está PUBLICADA no disco: existe, não é noindex nem redirect. É o que
 * decide o card "Painel macro" do hub e os links para lá (link só para página que existe; a
 * landing já linka a página do Buffett, que está no ar). A trava MACRO_BUFFETT_ENABLED decide se
 * o macro é REGERADO, não se a página publicada existe.
 */
export function macroPagePublished(siteRoot: string): boolean {
  const file = join(siteRoot, 'macro', 'indicador-de-buffett', 'index.html');
  if (!existsSync(file)) return false;
  const h = head(file);
  return !!h && !/<meta name="robots" content="noindex/.test(h) && !h.includes('http-equiv="refresh"');
}

/**
 * Data e tamanho do valuations.json (para os tokens {data}/{n} da calculadora). O tamanho vem do
 * arquivo que o gerador grava nesta execução (`valuationsCount`, mesclado na execução parcial);
 * sem ele, das chaves de `valuations`; sem as duas, do arquivo no disco.
 */
export function valuationsInfo(siteRoot: string, build?: BuildInputs): DataInfo | null {
  let date = build?.quoteDate ?? '';
  const total = build?.valuationsCount;
  let n = typeof total === 'number' && Number.isFinite(total) && total > 0
    ? Math.floor(total)
    : build?.valuations ? Object.keys(build.valuations).length : 0;
  if (!date || !n) {
    try {
      const v = JSON.parse(readFileSync(join(siteRoot, 'valuations.json'), 'utf-8')) as Record<string, unknown>;
      if (!date && typeof v._quoteDate === 'string') date = v._quoteDate;
      if (!n) n = Object.keys(v).filter((k) => !k.startsWith('_')).length;
    } catch { /* sem valuations.json: a calculadora fica sem a data no texto */ }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !n) return null;
  return { date, dateBR: `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`, n };
}

/**
 * Ferramenta dona de cada JSON de dado (null = sai sempre). O do ranking tem tickers reais
 * ordenados por indicador e o do backtest só serve à página dele: os dois só vão para a raiz (e
 * para o `data` do publicadas.json) com a ferramenta `pronto` — JSON público de ranking com a
 * página em rascunho era o risco apontado na crítica (d)3. O dos fatos sai sempre: a landing usa.
 */
const DATA_OWNER: Record<keyof typeof DATA_JSON, ToolId | null> = { ranking: 'ranking', fatos: null, backtest: 'backtest' };

/**
 * O JSON de dado `key` pode ir para o disco e para o publicadas.json nesta execução? Na prévia
 * (`includeDrafts`), sempre. JSON que já estava no disco de uma publicação anterior não é apagado:
 * a página antiga ainda o lê pelo data-src (a regra ferramentas-links do validate-html reprovaria).
 */
export function dataJsonPublishable(key: keyof typeof DATA_JSON, opts: { includeDrafts?: boolean; tools?: readonly Pick<ToolContent, 'id' | 'status'>[] } = {}): boolean {
  const owner = DATA_OWNER[key];
  if (owner === null || opts.includeDrafts) return true;
  return (opts.tools ?? TOOLS).some((t) => t.id === owner && t.status === 'pronto');
}

/** publicadas.json: o que a landing (e qualquer página) lê para saber o que está no ar (contrato em site.ts). */
function publishedJson(outRoot: string, basePath: string, published: ReadonlySet<ToolId>, bundle: BundleResult | null, includeDrafts: boolean): PublishedJson {
  const tools = TOOLS.filter((t) => t.status === 'pronto' && published.has(t.id) && existsSync(join(outRoot, toolPath(t), 'index.html')));
  const data: PublishedJson['data'] = {};
  for (const k of Object.keys(DATA_JSON) as (keyof typeof DATA_JSON)[]) {
    if (dataJsonPublishable(k, { includeDrafts }) && existsSync(join(outRoot, DATA_JSON[k]))) data[k] = `${basePath}${DATA_JSON[k]}`;
  }
  return {
    v: 1,
    hub: `${basePath}${HUB_PATH}`,
    ids: tools.map((t) => t.id),
    tools: tools.map((t) => ({ id: t.id, slug: t.slug, path: `${basePath}${toolPath(t)}`, name: t.name, widget: t.widget.id, illustrative: t.widget.illustrative })),
    data,
    assets: bundle
      ? {
        js: `${basePath}${bundle.jsUrl}`,
        css: `${basePath}${bundle.cssUrl}`,
        groups: Object.fromEntries(Object.entries(bundle.groups).map(([g, x]) => [g, { js: `${basePath}${x.js.url}`, css: x.css ? `${basePath}${x.css.url}` : null }])),
      }
      : null,
  };
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

/** `write` = false: valida e devolve o dado (para as páginas da execução) sem gravar o JSON (ranking em rascunho). */
function produceRanking(quotes: QuoteRow[], dividends: DividendsInfo, hasPage: (t: string) => boolean, outRoot: string, now: Date, write: boolean): RankingData | null {
  const { data, excluded } = buildRanking(quotes, dividends, { hasPage });
  const { problems, warnings } = validateRanking(data, now);
  for (const x of excluded) warn(`ranking: ${x.t} — ${x.reason}`);
  for (const w of warnings) warn(`ranking: ${w}`);
  if (problems.length) {
    warn(`ranking não atualizado (o dados.json anterior continua): ${problems.join('; ')}`);
    return null;
  }
  if (write) writeJson(outRoot, DATA_JSON.ranking, data);
  return data;
}

function produceFatos(cvm: CvmRow[], quotes: QuoteRow[] | null, look: { page: (t: string) => boolean; airton: (t: string) => boolean; known: string[] }, outRoot: string, now: Date): FatosData | null {
  // Nome limpo ("Petroleo Brasileiro", não "Petroleo Brasileiro SA Pfd"): scripts/lib/company-name.ts.
  const names = new Map<string, string>((quotes ?? []).map((q) => [q.symbol, companyName(q.shortName, q.longName)]));
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

/** Avisos de texto no HTML renderizado (termos proibidos fora dos blocos data-fonte). */
function textWarnings(t: ToolContent, html: string): string[] {
  return [...new Set([...forbiddenHits(htmlAuthorText(html), 'page'), ...forbiddenHits(toolText(t), t.id)])];
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
      for (const s of bundle.skipped) warn(`widget ${s.id} fora do bundle por erro de sintaxe (os outros funcionam): ${s.reason}`);
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
        if (quotes === undefined) quotes = await fetchQuotes(sb, now).catch((e) => { warn(`brapi_quotes: ${errMsg(e)}`); return null; });
        if (cvm === undefined) cvm = await fetchCvmRows(sb, now).catch((e) => { warn(`cvm_documents: ${errMsg(e)}`); return null; });
      } catch (e) {
        warn(`Supabase indisponível (ranking e fatos ficam como estão): ${errMsg(e)}`);
      }
    }

    // Proventos (DADOS-API §6.1): valuations.json do disco (último build) por baixo, os passados à
    // mão (testes/prévia) no meio e os desta execução por cima — com a média de 5 anos (dy5y).
    const dividends = mergeDividendInputs(readDividendsFile(siteRoot), opts.data?.dividends, opts.build?.valuations);

    // JSON de ranking e de backtest só com a ferramenta `pronto` (na prévia, sempre): o dado é
    // montado e validado do mesmo jeito e chega às páginas desta execução, mas o arquivo público não.
    const writeRanking = dataJsonPublishable('ranking', { includeDrafts: opts.includeDrafts });
    const writeBacktest = dataJsonPublishable('backtest', { includeDrafts: opts.includeDrafts });

    const ranking = quotes ? produceRanking(quotes, dividends, hasPage, outRoot, now, writeRanking) : null;
    const known = quotes ? quotes.map((q) => q.symbol) : tickersOnDisk(siteRoot);
    const fatos = cvm ? produceFatos(cvm, quotes ?? null, { page: hasPage, airton: (t) => airtonSet.has(t), known }, outRoot, now) : null;

    // Backtest (SPEC-v2 §B8, DADOS-API §3): Ibovespa × CDI reais. Sem dado novo, vale o arquivo
    // anterior (o produtor não sobrescreve com dado ruim). Chega às seções SSR em m.env.extra.backtest.
    let backtest: BacktestData | null = null;
    if (opts.data?.backtest || opts.fetch !== false) {
      backtest = await produceBacktest({ outRoot, now, data: opts.data?.backtest, fetch: opts.fetch, write: writeBacktest });
    }
    backtest ??= readBacktestFile(outRoot) ?? (siteRoot !== outRoot ? readBacktestFile(siteRoot) : null);

    const candidates = TOOLS.filter((t) => t.status === 'pronto' || opts.includeDrafts);
    const available: Partial<Record<ToolContent['dataSource'], boolean>> = { ranking: !!ranking, fatos: !!fatos, backtest: !!backtest };
    const hasData = (t: ToolContent) => !needsData(t) || !!available[t.dataSource];
    const render = candidates.filter(hasData);
    const kept = candidates.filter((t) => !hasData(t) && existingEntry(outRoot, t));
    const published = new Set<ToolId>([...render, ...kept].map((t) => t.id));

    const assets: PageAssets = {
      js: bundle ? `${basePath}${bundle.jsUrl}` : null,
      css: bundle ? `${basePath}${bundle.cssUrl}` : null,
      byWidget: bundle
        ? Object.fromEntries(Object.entries(bundle.byWidget).map(([id, x]) => [id, { js: `${basePath}${x.js}`, css: x.css ? `${basePath}${x.css}` : null }]))
        : {},
    };
    const env: RenderEnv = {
      published,
      macroPage: macroPagePublished(siteRoot),
      basePath,
      assets,
      ranking,
      fatos,
      valuations: valuationsInfo(siteRoot, opts.build),
      extra: { ...(opts.data?.extra ?? {}), backtest },
      // Links do conteúdo para /{TICKER}/ e /airton/{T}/ só para página que existe (resolveHref).
      pages: { ticker: hasPage, airton: (t) => airtonSet.has(t) },
    };

    // Duas passadas. (1) Monta todas as páginas em memória: a ferramenta que falha sai do
    // `published` (a não ser que a página anterior continue no disco) antes de qualquer página ser
    // escrita. (2) Se alguma saiu, remonta as outras com o `published` final. Sem isso, as páginas
    // montadas antes dela (ordem de TOOLS) linkavam uma página que não existe, e a regra
    // ferramentas-links do validate-html reprovaria o build do dia inteiro (tickers inclusive).
    const page = (t: ToolContent) => { const m = buildToolModel(t, env); return { m, html: renderToolPage(m) }; };
    const results: ({ t: ToolContent; m: ToolPageModel; html: string } | { t: ToolContent; prev: SitemapEntry })[] = [];
    let dropped = false;
    for (const t of render) {
      try {
        for (const p of structureProblems(t)) warn(`${t.id}: ${p}`);
        const missing = unknownSections(t);
        if (missing.length) throw new Error(`seção SSR não registrada em sections/index.ts: ${missing.join(', ')}`);
        const r = page(t);
        for (const p of seoProblems(r.m)) warn(`${t.id}: ${p}`);
        if (t.status === 'pronto') for (const p of publishProblems(t)) warn(`${t.id}: ${p}`);
        results.push({ t, ...r });
      } catch (e) {
        warn(`${t.id}: página não regerada (a anterior continua): ${errMsg(e)}`);
        const prev = t.status === 'pronto' ? existingEntry(outRoot, t) : null;
        if (prev) results.push({ t, prev });
        else { published.delete(t.id); dropped = true; }
      }
    }
    if (dropped) {
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if ('prev' in r) continue;
        try { results[i] = { t: r.t, ...page(r.t) }; } catch (e) { warn(`${r.t.id}: página não remontada sem a ferramenta que saiu do ar: ${errMsg(e)}`); }
      }
    }

    const entries: SitemapEntry[] = [];
    const written: string[] = [];
    for (const r of results) {
      if ('prev' in r) { entries.push(r.prev); continue; }
      const { t, m, html } = r;
      try {
        for (const p of textWarnings(t, html)) warn(`${t.id}: termo proibido no texto autoral: ${p}`);
        const dir = join(outRoot, toolPath(t));
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'index.html'), html, 'utf-8');
        written.push(t.status === 'pronto' ? t.slug : `${t.slug} (rascunho)`);
        if (t.status === 'pronto') entries.push({ loc: m.url, lastmod: m.dateModified, changefreq: m.refDate ? 'daily' : 'monthly', priority: '0.8' });
      } catch (e) {
        warn(`${t.id}: página não gravada (a anterior continua): ${errMsg(e)}`);
        const prev = t.status === 'pronto' ? existingEntry(outRoot, t) : null;
        if (prev) entries.push(prev);
        else published.delete(t.id);
      }
    }
    for (const t of kept) {
      if (t.status !== 'pronto') continue;
      const prev = existingEntry(outRoot, t);
      if (prev) entries.push(prev);
    }
    // Ordem estável no sitemap: a de TOOLS, com a página regerada ou mantida do dia anterior.
    const order = new Map(TOOLS.map((t, i) => [toolUrl(t), i]));
    entries.sort((a, b) => (order.get(a.loc) ?? TOOLS.length) - (order.get(b.loc) ?? TOOLS.length));

    const hub = buildHubModel(env);
    mkdirSync(join(outRoot, HUB_PATH), { recursive: true });
    writeFileSync(join(outRoot, HUB_PATH, 'index.html'), renderHub(hub), 'utf-8');
    entries.unshift({ loc: HUB_URL, lastmod: hub.dateModified, changefreq: 'weekly', priority: '0.8' });

    // Depois das páginas: o publicadas.json só lista o que ficou de fato no disco.
    const pub = publishedJson(outRoot, basePath, published, bundle, !!opts.includeDrafts);
    writeJson(outRoot, PUBLICADAS_PATH, pub);

    const groups = bundle ? Object.entries(bundle.groups).map(([g, x]) => `${g}: ${x.widgets.join(', ')}`) : [];
    const draftJson = (write: boolean) => (write ? '' : ', sem dados.json: ferramenta em rascunho');
    console.log(
      `🧰 Ferramentas: hub + ${written.length} página(s) [${written.join(', ') || '—'}]` +
      ` · publicadas [${pub.ids.join(', ') || '—'}]` +
      ` · ranking ${ranking ? `${ranking.count} ações (${ranking.dateBR}${draftJson(writeRanking)})` : 'mantido'}` +
      ` · fatos ${fatos ? `${fatos.count} documentos (${fatos.updatedBR})` : 'mantido'}` +
      ` · backtest ${backtest ? `até ${backtest.updated}${writeBacktest ? '' : ' (sem dados.json: ferramenta em rascunho)'}` : 'ausente'}` +
      ` · bundle ${bundle ? `js ${bundle.jsHash} (${bundle.widgets.join(', ') || 'só runtime'})${groups.length ? ` + ${groups.join('; ')}` : ''}` : 'ausente'}`,
    );
    return entries;
  } catch (e) {
    warn(`erro ao gerar as ferramentas (as páginas anteriores continuam): ${errMsg(e)}`);
    return existingEntries(outRoot);
  }
}
