/**
 * Modelo das páginas /ferramentas/: tudo já resolvido para o template (textos com os tokens de
 * dado expandidos, deep link, links internos só para páginas que existem, ItemList, datas) e as
 * regras que os testes e o gerador conferem (limites de SEO, termos proibidos, conteúdo pronto).
 * Funções puras: nada de I/O aqui.
 */
import { SITE } from '../ticker/model';
import { appHref } from './links';
import { DATA_JSON, HUB, HUB_PATH, HUB_URL, SITE_CARDS, TOOLS, toolByPath, toolPath, toolUrl } from './registry';
import type { Block, FatosData, RankingData, RankingKey, RankingRow, ToolContent, ToolId } from './types';

export interface RenderEnv {
  /** Ferramentas com página no ar depois desta execução (links internos só para estas). */
  published: ReadonlySet<ToolId>;
  /** /macro/indicador-de-buffett/ existe (trava do macro ligada e página no disco). */
  macroPage: boolean;
  /** '' em produção; '/preview' na prévia local (links de /ferramentas/, assets e JSONs). */
  basePath: string;
  /** URLs do bundle de widgets com ?v=hash (null = bundle ausente: só o conteúdo do servidor). */
  assets: { js: string | null; css: string | null };
  ranking: RankingData | null;
  fatos: FatosData | null;
}

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

export function dataInfo(tool: ToolContent, env: Pick<RenderEnv, 'ranking' | 'fatos'>): DataInfo | null {
  if (tool.dataSource === 'ranking') return env.ranking ? { date: env.ranking.date, dateBR: env.ranking.dateBR, n: env.ranking.count } : null;
  if (tool.dataSource === 'fatos') return env.fatos ? { date: env.fatos.updated, dateBR: env.fatos.updatedBR, n: env.fatos.count } : null;
  return null;
}

const TOKEN_RE = /\{(data|n)\}/g;
export const hasTokens = (s: string): boolean => /\{(data|n)\}/.test(s);
export const expand = (s: string, info: DataInfo | null): string =>
  info ? s.replace(TOKEN_RE, (_, k: string) => (k === 'data' ? info.dateBR : String(info.n))) : s;

/** Ferramenta com dado real só tem página quando o dado existe (senão a anterior continua). */
export const needsData = (tool: ToolContent): boolean => tool.dataSource === 'ranking' || tool.dataSource === 'fatos';

// ─── Links internos ───────────────────────────────────────────────────────

/**
 * Href interno resolvido para esta execução, ou null quando a página não existe (o texto fica
 * sem link). Páginas de ferramenta em rascunho não existem em produção.
 */
export function resolveHref(href: string, env: Pick<RenderEnv, 'published' | 'macroPage' | 'basePath'>): string | null {
  if (href.startsWith('#') || href.startsWith('/#')) return href;
  if (!href.startsWith('/')) return null;   // só link interno no conteúdo
  if (href === HUB_PATH) return `${env.basePath}${href}`;
  if (href.startsWith(HUB_PATH)) {
    const t = toolByPath(href);
    return t && env.published.has(t.id) ? `${env.basePath}${href}` : null;
  }
  if (href.startsWith('/macro/')) return env.macroPage ? href : null;
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
    if (b.type === 'ranking-table' && env.ranking) for (const r of rankingRows(env.ranking, b.indicator, b.limit ?? 10)) push(`${r.t} — ${r.name}`, `/${r.t}/`);
    if (b.type === 'fatos-list' && env.fatos) for (const it of env.fatos.items.slice(0, b.limit ?? 12)) push(`${it.t}: ${it.typeLabel} — ${it.title}`, it.url);
  };
  for (const s of tool.sections) s.blocks.forEach(walk);
  return out;
}

// ─── Modelos ──────────────────────────────────────────────────────────────

export function buildToolModel(tool: ToolContent, env: RenderEnv): ToolPageModel {
  const info = dataInfo(tool, env);
  if (needsData(tool) && !info) throw new Error(`${tool.id}: página com dado real sem dado nesta execução`);
  const dataSrc = tool.dataSource === 'ranking' ? `${env.basePath}${DATA_JSON.ranking}` : tool.dataSource === 'fatos' ? `${env.basePath}${DATA_JSON.fatos}` : null;
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
    refDate: info?.date ?? null,
    dateModified: info?.date ?? tool.contentRevised,
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
  ].join('\n');
}

/**
 * Termos proibidos (SPEC §1 e honestidade-rotas.md). Vale para o HTML inteiro de toda página
 * (texto e JSON-LD); `only` restringe ao texto autoral daquela ferramenta.
 * A marca aposentada é montada em pedaços: o literal seria acusado pelo gate do validate-html.
 */
export const FORBIDDEN: { re: RegExp; why: string; only?: ToolId[] }[] = [
  { re: /\bcompr(e|em)\b/i, why: 'verbo de compra no imperativo (recomendação)' },
  { re: /\bvend(a|am) (já|agora|suas?|seus?)\b/i, why: 'verbo de venda no imperativo (recomendação)' },
  { re: /carteira ideal/i, why: '"carteira ideal" é recomendação' },
  { re: /melhores ações/i, why: '"melhores ações" é recomendação' },
  { re: /descobrir o que comprar/i, why: 'compliance: não repetir "descobrir o que comprar"' },
  { re: /\bpotencial\b/i, why: '"potencial" sugere promessa de ganho' },
  { re: /anomalias? estat[ií]sticas?/i, why: 'o Radar não é estatística (6 regras fixas)' },
  { re: /todas as a[çc][õo]es da B3/i, why: 'nenhuma ferramenta cobre todas as ações da B3' },
  { re: /\ba IA otimiza\b/i, why: 'a conta de Markowitz é exata; a IA só comenta' },
  { re: /testamos 1(\.000\.000| milh[ãa]o)/i, why: 'o sorteio só desenha a nuvem; o ótimo é exato' },
  { re: /alertas? (grát(is|uitos?)|gratuitos?) no WhatsApp/i, why: 'alerta em tempo real no WhatsApp é dos planos pagos' },
  { re: /sem cadastro/i, why: 'proibido prometer "sem cadastro" (CLAUDE.md)' },
  { re: /auditad[ao] por (um )?analista/i, why: 'a nota é gerada por IA, sem revisão humana no código' },
  { re: /pre[çc]o justo por IA/i, why: 'as calculadoras não usam IA' },
  { re: /em segundos/i, why: 'não prometer velocidade ("em segundos")' },
  { re: /recomendamos/i, why: 'recomendação' },
  { re: /ValuAI/, why: 'chamar a ferramenta pelo nome da tela (Valuation)' },
  { re: new RegExp(['IAn' + 'alista', 'IAl' + 'ocador', '14 ' + 'dias'].join('|')), why: 'marca aposentada / duração do teste (gate marca-aposentada)' },
  { re: /\bbaratas?\b/i, why: 'o ranking nunca rotula ações como "baratas"', only: ['ranking'] },
  { re: /oportunidades?/i, why: 'o ranking nunca rotula ações como "oportunidades"', only: ['ranking'] },
];

export function forbiddenHits(text: string, scope: ToolId | 'page'): string[] {
  const hits: string[] = [];
  for (const f of FORBIDDEN) {
    if (f.only && (scope === 'page' || !f.only.includes(scope))) continue;
    const m = f.re.exec(text);
    if (m) hits.push(`"${m[0]}" — ${f.why}`);
  }
  return hits;
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
  return p;
}

/** Problemas estruturais que valem para toda ferramenta, pronta ou rascunho. */
export function structureProblems(t: ToolContent): string[] {
  const p: string[] = [];
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.slug)) p.push(`slug fora do padrão: ${t.slug}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.contentRevised)) p.push(`contentRevised inválido: ${t.contentRevised}`);
  if (!t.faq.length) p.push('FAQ vazio');
  if (!t.sections.length) p.push('sem seções');
  const ids = t.sections.map((s) => s.id);
  if (new Set(ids).size !== ids.length) p.push('ids de seção repetidos');
  for (const id of ids) if (!/^[a-z0-9-]+$/.test(id) || ['faq', 'inicio', 'outras-ferramentas', 'autoria'].includes(id)) p.push(`id de seção inválido ou reservado: ${id}`);
  if (t.status === 'pronto' && t.sections.some((s) => s.blocks.some((b) => b.type === 'todo'))) p.push('bloco TODO em ferramenta pronta');
  // Regra do CNPI: sem dado real do build, o widget é ilustração e leva o selo; com dado real, não.
  const real = t.dataSource !== 'evergreen';
  if (real === t.widget.illustrative) p.push(real ? 'widget com dado real marcado como ilustrativo' : 'widget sem dado real precisa do selo (illustrative: true)');
  return p;
}
