/**
 * Modelo das páginas /ferramentas/: tudo já resolvido para o template (textos com os tokens de
 * dado expandidos, deep link, links internos só para páginas que existem, ItemList, datas) e as
 * regras que os testes e o gerador conferem (limites de SEO, termos proibidos, conteúdo pronto).
 * Funções puras: nada de I/O aqui.
 */
import { SITE } from '../ticker/model';
import { isoToBR } from '../ticker/lib/format';
import { appHref } from './links';
import { DATA_JSON, HUB, HUB_PATH, HUB_URL, SITE_CARDS, TOOLS, toolByPath, toolPath, toolUrl } from './registry';
import type { BacktestData } from './data';
import type { Block, FatosData, RankingData, RankingKey, RankingRow, ToolContent, ToolId } from './types';

// Termos proibidos moram na ponte leve (o validate-html também usa): reexportados aqui.
export { FORBIDDEN, forbiddenHits, htmlAuthorText, stripExternal } from './site';

/** URLs do bundle de widgets com ?v=hash (null = bundle ausente: só o conteúdo do servidor). */
export interface PageAssets {
  /** /assets/js/ferramentas.js?v=… — runtime + widgets leves. */
  js: string | null;
  /** /assets/css/ferramentas.css?v=… */
  css: string | null;
  /** Widgets pesados em arquivo próprio (ex.: calc → ferramentas-calc.js): só a página deles carrega. */
  byWidget?: Record<string, { js: string; css: string | null }>;
}

export interface RenderEnv {
  /** Ferramentas com página no ar depois desta execução (links internos só para estas). */
  published: ReadonlySet<ToolId>;
  /** /macro/indicador-de-buffett/ está publicada no disco (existe e não é noindex). */
  macroPage: boolean;
  /** '' em produção; '/preview' (ou '/preview/<id>') na prévia local (links de /ferramentas/, assets e JSONs). */
  basePath: string;
  assets: PageAssets;
  ranking: RankingData | null;
  fatos: FatosData | null;
  /** Data e tamanho do valuations.json (token {data}/{n} da calculadora), quando conhecidos. */
  valuations?: DataInfo | null;
  /**
   * Dados extras do build por chave, para as seções SSR (m.env.extra). Hoje: `backtest`
   * (BacktestData de data.ts: Ibovespa × CDI reais, ou null sem dado).
   */
  extra?: Record<string, unknown>;
  /**
   * Páginas do site que existem nesta execução: /{TICKER}/ (página real, não redirect) e
   * /airton/{T}/. O gerador sempre passa; sem isto (testes, rascunho fora do build), os links do
   * conteúdo para essas páginas saem como estão.
   */
  pages?: { ticker: (t: string) => boolean; airton: (t: string) => boolean };
}

/** Ibovespa × CDI desta execução (ou do arquivo anterior), quando há. */
export const backtestOf = (env: Pick<RenderEnv, 'extra'>): BacktestData | null =>
  (env.extra?.backtest as BacktestData | null | undefined) ?? null;

export interface LinkCard {
  href: string;
  title: string;
  text: string;
  tool?: ToolId;
  /** Ferramenta em rascunho (só na prévia). */
  draft?: boolean;
}

export interface DataInfo {
  date: string;
  dateBR: string;
  n: number;
}

export interface ToolPageModel {
  tool: ToolContent;
  path: string;
  url: string;
  title: string;
  description: string;
  h1: string;
  answer: string;
  caption: string | null;
  /** Deep link (o mesmo nos CTAs do topo, do fim e da barra fixa; muda só o data-cta). */
  href: string;
  draft: boolean;
  /** Data do dado (só nas páginas com dado real). */
  refDate: string | null;
  /** refDate ou a data de revisão do conteúdo — nunca "hoje" (HTML idêntico entre builds). */
  dateModified: string;
  related: LinkCard[];
  /** Só URLs internas, quando a página publica lista de links do dia. */
  itemList: { name: string; url: string }[];
  /** URL (com basePath) do JSON que o widget lê, quando há. */
  dataSrc: string | null;
  env: RenderEnv;
}

export interface HubModel {
  title: string;
  description: string;
  h1: string;
  intro: string[];
  url: string;
  cards: LinkCard[];
  dateModified: string;
  env: RenderEnv;
}

// ─── Tokens de dado ───────────────────────────────────────────────────────

export function dataInfo(tool: ToolContent, env: Pick<RenderEnv, 'ranking' | 'fatos' | 'valuations' | 'extra'>): DataInfo | null {
  if (tool.dataSource === 'ranking') return env.ranking ? { date: env.ranking.date, dateBR: env.ranking.dateBR, n: env.ranking.count } : null;
  if (tool.dataSource === 'fatos') return env.fatos ? { date: env.fatos.updated, dateBR: env.fatos.updatedBR, n: env.fatos.count } : null;
  if (tool.dataSource === 'valuations') return env.valuations ?? null;
  if (tool.dataSource === 'backtest') {
    const b = backtestOf(env);
    // {data} = último pregão do último mês completo; {n} = meses da série.
    return b && /^\d{4}-\d{2}-\d{2}$/.test(b.updated)
      ? { date: b.updated, dateBR: `${b.updated.slice(8, 10)}/${b.updated.slice(5, 7)}/${b.updated.slice(0, 4)}`, n: b.ibov.series.length }
      : null;
  }
  return null;
}

// ─── JSON-LD por tipo de página (SPEC-v2 §D) ──────────────────────────────

/**
 * Tipo principal do JSON-LD. Decidido aqui, não no conteúdo, para nunca declarar grátis o que é
 * pago: `WebApplication` (com offers/isAccessibleForFree) SÓ na calculadora, que roda grátis no
 * site; `CollectionPage` + ItemList (só URLs internas) nas páginas que publicam lista diária
 * (fatos e ranking); `WebPage` nas demais (ferramenta paga ou demonstração ilustrativa).
 */
export type PageSchema = 'WebApplication' | 'CollectionPage' | 'WebPage';
export function pageSchema(t: Pick<ToolContent, 'id' | 'dataSource'>): PageSchema {
  if (t.id === 'calc') return 'WebApplication';
  if (t.dataSource === 'ranking' || t.dataSource === 'fatos') return 'CollectionPage';
  return 'WebPage';
}

/** Âncora estável de um termo definido (glossário visível e @id do DefinedTerm). */
export const termId = (name: string): string =>
  `termo-${name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

const TOKEN_RE = /\{(data|n)\}/g;
export const hasTokens = (s: string): boolean => /\{(data|n)\}/.test(s);
export const expand = (s: string, info: DataInfo | null): string =>
  info ? s.replace(TOKEN_RE, (_, k: string) => (k === 'data' ? info.dateBR : String(info.n))) : s;

/** Ferramenta com dado real só tem página quando o dado existe (senão a anterior continua). */
export const needsData = (tool: Pick<ToolContent, 'dataSource'>): boolean =>
  tool.dataSource === 'ranking' || tool.dataSource === 'fatos' || tool.dataSource === 'backtest';

/** JSON público que o widget da página lê (data-src), quando a página tem dado do build. */
export function dataJsonOf(tool: Pick<ToolContent, 'dataSource'>): string | null {
  if (tool.dataSource === 'ranking') return DATA_JSON.ranking;
  if (tool.dataSource === 'fatos') return DATA_JSON.fatos;
  if (tool.dataSource === 'backtest') return DATA_JSON.backtest;
  return null;
}

// ─── Links internos ───────────────────────────────────────────────────────

/** /{TICKER}/ ou /airton/{TICKER}/ (com âncora ou query opcionais). */
const TICKER_PAGE_RE = /^\/(airton\/)?([A-Z0-9]{4}\d{1,2})\/(?:[?#].*)?$/;

/**
 * Href interno resolvido para esta execução, ou null quando a página não existe (o texto fica
 * sem link). Páginas de ferramenta em rascunho não existem em produção; /{TICKER}/ e
 * /airton/{T}/ só com a página no disco (`env.pages`, que o gerador passa: a regra
 * ferramentas-links do validate-html só olha /ferramentas/).
 */
export function resolveHref(href: string, env: Pick<RenderEnv, 'published' | 'macroPage' | 'basePath' | 'pages'>): string | null {
  if (href.startsWith('#') || href.startsWith('/#')) return href;
  if (!href.startsWith('/')) return null;   // só link interno no conteúdo
  if (href === HUB_PATH) return `${env.basePath}${href}`;
  if (href.startsWith(HUB_PATH)) {
    const t = toolByPath(href);
    return t && env.published.has(t.id) ? `${env.basePath}${href}` : null;
  }
  if (href.startsWith('/macro/')) return env.macroPage ? href : null;
  const tk = TICKER_PAGE_RE.exec(href);
  if (tk && env.pages) return (tk[1] ? env.pages.airton(tk[2]) : env.pages.ticker(tk[2])) ? href : null;
  return href;
}

function relatedCards(current: ToolId | null, env: RenderEnv): LinkCard[] {
  const tools: LinkCard[] = TOOLS.filter((t) => t.id !== current && env.published.has(t.id)).map((t) => ({
    href: `${env.basePath}${toolPath(t)}`,
    title: t.name,
    text: t.blurb,
    tool: t.id,
    draft: t.status !== 'pronto' || undefined,
  }));
  const site: LinkCard[] = SITE_CARDS.filter((c) => !c.needsMacro || env.macroPage).map((c) => ({ href: c.href, title: c.title, text: c.text }));
  return [...tools, ...site];
}

// ─── Ranking: linhas de cada aba ──────────────────────────────────────────

export const RANKING_LABELS: Record<RankingKey, { tab: string; title: string; note: string }> = {
  dy: { tab: 'DY 12m', title: 'Maior dividend yield de 12 meses', note: 'Proventos com data-com nos últimos 12 meses ÷ cotação.' },
  pl: { tab: 'P/L', title: 'Menor P/L', note: 'Preço ÷ lucro por ação dos últimos 12 meses; só P/L a partir de 0,1.' },
  pvp: { tab: 'P/VP', title: 'Menor P/VP', note: 'Preço ÷ valor patrimonial por ação; só P/VP positivo.' },
  roe: { tab: 'ROE', title: 'Maior ROE', note: 'Lucro dos últimos 12 meses ÷ patrimônio líquido.' },
};

export function rankingRows(d: RankingData, key: RankingKey, limit?: number): RankingRow[] {
  const byT = new Map(d.rows.map((r) => [r.t, r]));
  return d.top[key].slice(0, limit ?? d.top[key].length).map((t) => byT.get(t)).filter((r): r is RankingRow => !!r);
}

/**
 * ItemList só com URLs internas e só com texto AUTORAL no `name` (ticker, rótulo do tipo e data):
 * título e resumo da CVM e nome de empresa são dado externo (SPEC-v2 §E1) e o JSON-LD não tem
 * como ser marcado com data-fonte — por isso não entram aqui.
 */
function itemListFor(tool: ToolContent, env: RenderEnv): { name: string; url: string }[] {
  const out: { name: string; url: string }[] = [];
  const seen = new Set<string>();
  const push = (name: string, path: string) => {
    const url = `${SITE}${path}`;
    if (seen.has(url) || out.length >= 30) return;
    seen.add(url);
    out.push({ name, url });
  };
  const walk = (b: Block) => {
    if (b.type === 'ranking-table' && env.ranking) for (const r of rankingRows(env.ranking, b.indicator, b.limit ?? 10)) push(r.t, `/${r.t}/`);
    if (b.type === 'fatos-list' && env.fatos) for (const it of env.fatos.items.slice(0, b.limit ?? 12)) push(`${it.t}: ${it.typeLabel} de ${isoToBR(it.date)}`, it.url);
    // Seção SSR que desenha as tabelas do ranking (ex.: sections/ranking.tsx) declara no conteúdo as
    // abas que viram ItemList: props.itemList (RankingKey[]) e props.itemLimit (padrão 10). Itens =
    // linhas do dados.json (só tickers com página, filtrados no buildRanking); URL repetida sai no push.
    if (b.type === 'ssr' && env.ranking) {
      const keys = b.props?.itemList;
      const lim = Number(b.props?.itemLimit) > 0 ? Number(b.props?.itemLimit) : 10;
      if (Array.isArray(keys)) {
        for (const k of keys) if (typeof k === 'string' && Object.prototype.hasOwnProperty.call(env.ranking.top, k)) for (const r of rankingRows(env.ranking, k as RankingKey, lim)) push(r.t, `/${r.t}/`);
      }
    }
  };
  for (const s of tool.sections) s.blocks.forEach(walk);
  return out;
}

/** Arquivos do bundle que a página carrega: o principal e, se o widget for pesado, o arquivo dele. */
export function pageAssets(m: Pick<ToolPageModel, 'tool' | 'env'>): { js: string[]; css: string[] } {
  const a = m.env.assets;
  if (!a.js) return { js: [], css: a.css ? [a.css] : [] };
  const extra = a.byWidget?.[m.tool.widget.id];
  return {
    js: [a.js, ...(extra ? [extra.js] : [])],
    css: [...(a.css ? [a.css] : []), ...(extra?.css ? [extra.css] : [])],
  };
}

// ─── Modelos ──────────────────────────────────────────────────────────────

export function buildToolModel(tool: ToolContent, env: RenderEnv): ToolPageModel {
  const info = dataInfo(tool, env);
  if (needsData(tool) && !info) throw new Error(`${tool.id}: página com dado real sem dado nesta execução`);
  const json = dataJsonOf(tool);
  const dataSrc = json ? `${env.basePath}${json}` : null;
  // A data do dado vira dateModified/"Atualizado em" só quando o HTML depende dele (página com dado
  // ou texto com {data}/{n}). A calculadora sem token lê o valuations.json no navegador: o HTML não
  // muda de um dia para o outro, e dizer "atualizado hoje" seria frescor falso.
  const usesTokens = [tool.title, tool.description, tool.h1, tool.answer, tool.widget.caption ?? ''].some(hasTokens);
  const live = !!info && (needsData(tool) || usesTokens);
  return {
    tool,
    path: toolPath(tool),
    url: toolUrl(tool),
    title: expand(tool.title, info),
    description: expand(tool.description, info),
    h1: expand(tool.h1, info),
    answer: expand(tool.answer, info),
    caption: tool.widget.caption ? expand(tool.widget.caption, info) : null,
    href: appHref(tool.cta.target),
    draft: tool.status !== 'pronto',
    refDate: live ? info!.date : null,
    dateModified: live ? info!.date : tool.contentRevised,
    related: relatedCards(tool.id, env),
    itemList: itemListFor(tool, env),
    dataSrc,
    env,
  };
}

export function buildHubModel(env: RenderEnv): HubModel {
  const dates = [HUB.contentRevised, ...TOOLS.filter((t) => env.published.has(t.id) && t.status === 'pronto').map((t) => t.contentRevised)].sort();
  return {
    title: HUB.title,
    description: HUB.description,
    h1: HUB.h1,
    intro: HUB.intro,
    url: HUB_URL,
    cards: relatedCards(null, env),
    dateModified: dates[dates.length - 1],
    env,
  };
}

// ─── Regras conferidas pelos testes e pelo gerador ────────────────────────

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;
export const BRAND_SUFFIX = ' | IAções';

/** Limites de SEO (title, description, H1, frase-resposta) já com os tokens expandidos. */
export function seoProblems(m: { title: string; description: string; h1: string; answer?: string }): string[] {
  const p: string[] = [];
  if (m.title.length > TITLE_MAX) p.push(`title com ${m.title.length} caracteres (máx. ${TITLE_MAX}): ${m.title}`);
  if (!m.title.endsWith(BRAND_SUFFIX)) p.push(`title sem "${BRAND_SUFFIX}" no fim: ${m.title}`);
  if (m.description.length > DESCRIPTION_MAX) p.push(`description com ${m.description.length} caracteres (máx. ${DESCRIPTION_MAX})`);
  if (m.description.length < 70) p.push(`description curta demais (${m.description.length})`);
  if (!m.h1.trim()) p.push('H1 vazio');
  if (m.h1.trim() === m.title.replace(BRAND_SUFFIX, '').trim()) p.push('H1 idêntico ao title');
  if (m.answer !== undefined && m.answer.trim().length < 80) p.push('frase-resposta curta demais');
  for (const [k, v] of Object.entries(m)) if (typeof v === 'string' && hasTokens(v)) p.push(`token de dado sem expandir em ${k}`);
  return p;
}

const plain = (s: string): string => s.replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

/** Texto de todos os blocos (para busca de palavra-chave e de termos proibidos). */
export function blockText(b: Block): string {
  switch (b.type) {
    case 'p': case 'h3': case 'formula': case 'note': case 'todo': return plain(b.text);
    case 'list': return b.items.map(plain).join(' ');
    case 'table': return [b.caption ?? '', b.head.join(' '), ...b.rows.map((r) => r.map(plain).join(' '))].join(' ');
    case 'cards': return b.items.map((i) => `${i.title} ${plain(i.text)}`).join(' ');
    default: return '';
  }
}

/** Todo o texto autoral de uma ferramenta (sem os links de "Outras ferramentas"). */
export function toolText(t: ToolContent): string {
  return [
    t.name, t.title, t.description, t.h1, t.answer, t.blurb, t.cta.label, plain(t.cta.note), t.finalCta.title, t.finalCta.text,
    t.finalCta.label, t.widget.label, t.widget.caption ?? '', t.sources,
    ...t.sections.flatMap((s) => [s.title, ...s.blocks.map(blockText)]),
    ...t.faq.flatMap((f) => [f.q, f.a]),
    ...(t.definedTerms ?? []).flatMap((d) => [d.name, d.description]),
  ].join('\n');
}

/** Hrefs dos links `[rótulo](href)` escritos no conteúdo (nota de acesso e blocos). */
export function contentLinks(t: ToolContent): string[] {
  const rich: string[] = [t.cta.note];
  for (const s of t.sections) {
    for (const b of s.blocks) {
      if (b.type === 'p' || b.type === 'note') rich.push(b.text);
      else if (b.type === 'list') rich.push(...b.items);
      else if (b.type === 'table') rich.push(...b.rows.flat());
      else if (b.type === 'cards') rich.push(...b.items.map((i) => i.text));
    }
  }
  return rich.flatMap((s) => [...s.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)].map((m) => m[1]));
}

/** Conteúdo publicável: o que separa `pronto` de `rascunho` (teste e gerador conferem). */
export function publishProblems(t: ToolContent): string[] {
  const p: string[] = [];
  const all = toolText(t);
  if (/\bTODO\b/.test(all) || t.sections.some((s) => s.blocks.some((b) => b.type === 'todo'))) p.push('conteúdo marcado TODO');
  if (t.faq.length < 6 || t.faq.length > 10) p.push(`FAQ com ${t.faq.length} perguntas (6 a 10)`);
  for (const id of ['o-que-e', 'como-funciona', 'na-plataforma']) if (!t.sections.some((s) => s.id === id)) p.push(`falta a seção #${id}`);
  const oQue = t.sections.find((s) => s.id === 'o-que-e');
  if (oQue && !oQue.blocks.map(blockText).join(' ').toLowerCase().includes(t.keyword.toLowerCase())) p.push(`a palavra-chave "${t.keyword}" não aparece em "O que é"`);
  for (const f of t.faq) if (/\*\*|\]\(/.test(f.q + f.a)) p.push(`FAQ com marcação (precisa ser texto puro): ${f.q}`);
  const words = all.split(/\s+/).filter(Boolean).length;
  if (words < 600) p.push(`conteúdo curto (${words} palavras; mínimo 600)`);
  // SPEC-v2 §B2: página de ferramenta não linka a tabela de planos nem cita limites de plano.
  if (contentLinks(t).some((h) => h.startsWith('/#precos'))) p.push('link para /#precos (SPEC-v2 §B2: páginas de ferramenta não linkam a tabela de planos)');
  if (/página de preços|tabela de planos/i.test(all)) p.push('texto manda para a página de preços (SPEC-v2 §B2)');
  return p;
}

/** Ids de H2 que a página já usa (o conteúdo não pode repetir). */
export const RESERVED_SECTION_IDS = ['faq', 'inicio', 'outras-ferramentas', 'autoria', 'glossario', 'cta-final', 'conteudo'];

/** Problemas estruturais que valem para toda ferramenta, pronta ou rascunho. */
export function structureProblems(t: ToolContent): string[] {
  const p: string[] = [];
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.slug)) p.push(`slug fora do padrão: ${t.slug}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.contentRevised)) p.push(`contentRevised inválido: ${t.contentRevised}`);
  if (!t.faq.length) p.push('FAQ vazio');
  if (!t.sections.length) p.push('sem seções');
  const ids = t.sections.map((s) => s.id);
  if (new Set(ids).size !== ids.length) p.push('ids de seção repetidos');
  for (const id of ids) if (!/^[a-z0-9-]+$/.test(id) || RESERVED_SECTION_IDS.includes(id)) p.push(`id de seção inválido ou reservado: ${id}`);
  if (t.status === 'pronto' && t.sections.some((s) => s.blocks.some((b) => b.type === 'todo'))) p.push('bloco TODO em ferramenta pronta');
  for (const b of t.sections.flatMap((s) => s.blocks)) if (b.type === 'ssr' && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(b.id)) p.push(`chave de seção SSR fora do padrão: ${b.id}`);
  const terms = t.definedTerms ?? [];
  if (new Set(terms.map((d) => termId(d.name))).size !== terms.length) p.push('termos definidos repetidos');
  for (const d of terms) {
    if (!d.name.trim() || d.description.trim().length < 40) p.push(`termo definido vazio ou curto demais: ${d.name}`);
    if (/\*\*|\]\(/.test(d.name + d.description)) p.push(`termo definido com marcação (precisa ser texto puro): ${d.name}`);
  }
  // Regra do CNPI: sem dado real do build, o widget é ilustração e leva o selo; com dado real, não.
  const real = t.dataSource !== 'evergreen';
  if (real === t.widget.illustrative) p.push(real ? 'widget com dado real marcado como ilustrativo' : 'widget sem dado real precisa do selo (illustrative: true)');
  return p;
}
