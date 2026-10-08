/**
 * Deep links do site para o app (SPEC §2), num lugar só.
 *
 * O app só obedece `next`; `ticker`/`intent` soltos são ignorados. O Auth.tsx cola o resto da
 * query no fim do `next` com outro `?`, então todo `next` termina com o descartável `&_=`: quem
 * é engolido é o `_`, e `s`/`t`/`tab` chegam intactos (os utm_* do _iaClick chegam corretos).
 *
 *   /authnew?ref=iacoes&utm_medium=ferramentas&next=<encodeURIComponent('/?s=<s>&t=<t>[&ticker=T]&_=')>
 *   /authnew?ref=iacoes&utm_medium=ferramentas&next=<encodeURIComponent('/ativo/T?tab=<aba>&_=')>
 *
 * `utm_medium=ferramentas` vai no href (como o `utm_medium=macro` do Buffett): sem ele o
 * _iaClick usaria o padrão 'ticker' e o clique seria atribuído às páginas de ticker.
 * Na landing o `ref` é `iacoes-lp`.
 */
import { APP } from '../ticker/model';

/** Abas que o app aceita em cada seção (src/lib/sectionTools.ts do app, lido em 06/10/2026). */
export const SECTION_TABS = {
  ialocador: ['dashboard', 'rankings', 'radar', 'portfolio', 'optimization', 'macro', 'dividendos', 'cape'],
  ianalista: ['valuai', 'score', 'qualitativo', 'validador', 'teses'],
  workspace: ['chat'],
  home: ['notificacoes'],
} as const;

/** Abas da página do ativo (src/lib/assetRoute.ts do app). */
export const ASSET_TABS = ['valuation', 'raiox', 'dividendos', 'risco', 'governanca', 'tese', 'docs', 'noticias'] as const;

export type AppSection = keyof typeof SECTION_TABS;
export type AssetTab = (typeof ASSET_TABS)[number];

export type AppTarget =
  | { kind: 'tool'; s: AppSection; t?: string; ticker?: string; autorun?: boolean }
  | { kind: 'asset'; ticker: string; tab: AssetTab };

/** Telas do app usadas pelas ferramentas (mapa do SPEC §2). */
export const SCREENS = {
  otimizador: { kind: 'tool', s: 'ialocador', t: 'optimization' },
  carteira: { kind: 'tool', s: 'ialocador', t: 'portfolio' },
  radar: { kind: 'tool', s: 'ialocador', t: 'radar' },
  rankings: { kind: 'tool', s: 'ialocador', t: 'rankings' },
  macro: { kind: 'tool', s: 'ialocador', t: 'macro' },
  score: { kind: 'tool', s: 'ianalista', t: 'score' },
  validador: { kind: 'tool', s: 'ianalista', t: 'validador' },
  teses: { kind: 'tool', s: 'ianalista', t: 'teses' },
  valuation: { kind: 'tool', s: 'ianalista', t: 'valuai' },
  airton: { kind: 'tool', s: 'workspace' },
  notificacoes: { kind: 'tool', s: 'home', t: 'notificacoes' },
} as const satisfies Record<string, AppTarget>;

const TICKER_RE = /^[A-Z0-9]{4}\d{1,2}$/;

/** Caminho do `next` (antes de codificar), sempre terminando em `&_=`. */
export function nextPath(target: AppTarget): string {
  if (target.kind === 'asset') return `/ativo/${target.ticker}?tab=${target.tab}&_=`;
  let q = `/?s=${target.s}`;
  if (target.t) q += `&t=${target.t}`;
  if (target.ticker) q += `&ticker=${target.ticker}`;
  if (target.autorun) q += '&autorun=1';
  return `${q}&_=`;
}

export interface HrefOptions {
  /** `iacoes` nas páginas do site; `iacoes-lp` na landing. */
  ref?: string;
  /** utm_medium fixado no href (vazio = deixa o _iaClick decidir). */
  medium?: string;
}

export function appHref(target: AppTarget, opts: HrefOptions = {}): string {
  const ref = opts.ref ?? 'iacoes';
  const medium = opts.medium ?? 'ferramentas';
  return `${APP}?ref=${ref}${medium ? `&utm_medium=${medium}` : ''}&next=${encodeURIComponent(nextPath(target))}`;
}

export type ParsedHref = { ok: true; next: string; target: AppTarget } | { ok: false; reason: string };

/**
 * Confere se um href de CTA está no formato do SPEC §2 e devolve o destino. Usado pelos testes
 * em TODO link para o app de TODA página gerada.
 */
export function parseAppHref(href: string): ParsedHref {
  const m = /^https:\/\/app\.brasilhorizonte\.com\.br\/authnew\?ref=(iacoes|iacoes-lp)(&utm_medium=[a-z-]+)?&next=([^&#]+)$/.exec(href);
  if (!m) return { ok: false, reason: `fora do formato /authnew?ref=…&next=…: ${href}` };
  let next: string;
  try { next = decodeURIComponent(m[3]); } catch { return { ok: false, reason: `next mal codificado: ${m[3]}` }; }
  if (encodeURIComponent(next) !== m[3]) return { ok: false, reason: `next não está codificado com encodeURIComponent: ${m[3]}` };

  const asset = /^\/ativo\/([A-Z0-9]+)\?tab=([a-z]+)&_=$/.exec(next);
  if (asset) {
    if (!TICKER_RE.test(asset[1])) return { ok: false, reason: `ticker inválido no next: ${asset[1]}` };
    if (!(ASSET_TABS as readonly string[]).includes(asset[2])) return { ok: false, reason: `aba do ativo desconhecida: ${asset[2]}` };
    return { ok: true, next, target: { kind: 'asset', ticker: asset[1], tab: asset[2] as AssetTab } };
  }

  const tool = /^\/\?s=([a-z]+)((?:&[a-z]+=[A-Za-z0-9]+)*)&_=$/.exec(next);
  if (!tool) return { ok: false, reason: `next fora do formato /?s=…&_= ou /ativo/T?tab=…&_=: ${next}` };
  const s = tool[1];
  if (!(s in SECTION_TABS)) return { ok: false, reason: `seção desconhecida: ${s}` };
  const params: Record<string, string> = {};
  for (const kv of tool[2].split('&').filter(Boolean)) {
    const [k, v] = kv.split('=');
    if (k in params) return { ok: false, reason: `parâmetro repetido no next: ${k}` };
    params[k] = v;
  }
  for (const k of Object.keys(params)) {
    if (!['t', 'ticker', 'autorun'].includes(k)) return { ok: false, reason: `parâmetro que o app não lê no next: ${k}` };
  }
  const tabs = SECTION_TABS[s as AppSection] as readonly string[];
  if (params.t && !tabs.includes(params.t)) return { ok: false, reason: `aba ${params.t} não existe na seção ${s}` };
  if (params.ticker && !TICKER_RE.test(params.ticker)) return { ok: false, reason: `ticker inválido: ${params.ticker}` };
  if (params.autorun && params.autorun !== '1') return { ok: false, reason: `autorun só aceita 1` };
  return {
    ok: true,
    next,
    target: { kind: 'tool', s: s as AppSection, t: params.t, ticker: params.ticker, autorun: params.autorun === '1' || undefined },
  };
}

/** Todos os hrefs para o app num HTML (para os testes e o validador). */
export function appHrefsIn(html: string): string[] {
  const out: string[] = [];
  const re = /href="(https?:\/\/app\.brasilhorizonte\.com\.br[^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(m[1].replace(/&amp;/g, '&'));
  return out;
}
