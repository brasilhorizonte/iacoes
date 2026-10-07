/**
 * Dados reais das páginas /ferramentas/ (SPEC §3 e §7): ranking de ações e fatos relevantes.
 *
 * Leitura SOMENTE com a anon key (a mesma do CI): brapi_quotes e cvm_documents têm SELECT
 * liberado a anon. Nada aqui escreve no banco.
 *
 * Funções puras para tudo o que decide número (filtro, ordem, data, resumo): os testes rodam
 * sem rede. As buscas ficam isoladas em fetchQuotes/fetchCvmRows.
 *
 * Dividend yield do ranking: proventos de 12 meses COMO O GERADOR CALCULA (o mesmo `divTTM`
 * do valuations.json, já ajustado por desdobramento/grupamento) ÷ cotação. Nada de usar o
 * `dividend_yield` do banco, que soma proventos sem ajuste (SBSP3 saía com ~10,9%).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { isoToBR, truncate } from '../ticker/lib/format';
import type {
  CvmRow, DividendsByTicker, FatoItem, FatoType, FatosData, QuoteRow, RankingData, RankingKey, RankingRow,
} from './types';

// ─── Datas (fuso de São Paulo) ────────────────────────────────────────────

const TZ = 'America/Sao_Paulo';
const DAY_FMT = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const TIME_FMT = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

const parts = (f: Intl.DateTimeFormat, ms: number): Record<string, string> => {
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(new Date(ms))) p[x.type] = x.value;
  return p;
};

/** Data civil (AAAA-MM-DD) de um instante em BRT. */
export const brtDate = (ms: number): string => {
  const p = parts(DAY_FMT, ms);
  return `${p.year}-${p.month}-${p.day}`;
};

/** Hora (HH:MM) de um instante em BRT. */
export const brtTime = (ms: number): string => {
  const p = parts(TIME_FMT, ms);
  return `${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
};

/**
 * Instante (ms) de um timestamptz em texto. Sem fuso = UTC (não o fuso da máquina do build);
 * data pura = meio-dia em BRT, para não trocar de dia.
 */
export function parseTime(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  let iso = s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) iso = `${s}T15:00:00Z`;
  else if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) iso = `${s.replace(' ', 'T')}Z`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/** Dias corridos de `a` até `b` (AAAA-MM-DD). */
export const daysBetween = (a: string, b: string): number =>
  Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);

const isISODate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

// ─── Helpers ──────────────────────────────────────────────────────────────

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const round = (n: number, dec: number): number => Math.round(n * 10 ** dec) / 10 ** dec;

/** Mesmo critério do site (scripts/supabase.ts): short_name igual ao ticker perde para o long_name. */
export const bestName = (short: unknown, long: unknown): string => {
  const s = String(short || '').trim();
  const l = String(long || '').trim();
  return s && !/^[A-Z0-9]{4}\d{1,2}$/i.test(s.replace(/\s/g, '')) ? s : (l || s);
};

export const TICKER_RE = /^[A-Z0-9]{4}\d{1,2}$/;
/** Raiz do emissor no código B3 (PETR4 → PETR; B3SA3 → B3SA). */
export const tickerRoot = (t: string): string => t.slice(0, 4);
/** BDRs usam os finais 31 a 39 (34/35 não patrocinados, 39 de ETF). */
export const isBdr = (t: string): boolean => {
  const n = Number(/(\d{2})$/.exec(t)?.[1]);
  return n >= 31 && n <= 39;
};

// ─── Busca (anon, somente leitura) ────────────────────────────────────────

export function anonClient(url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY): SupabaseClient {
  if (!url || !key) throw new Error('SUPABASE_URL/SUPABASE_ANON_KEY ausentes');
  return createClient(url, key);
}

/** brapi_quotes inteira (paginada: o anon corta em 1.000 linhas). */
export async function fetchQuotes(sb: SupabaseClient = anonClient()): Promise<QuoteRow[]> {
  const out: QuoteRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('brapi_quotes')
      .select('symbol,price,regular_market_price,market_cap,pl,pvp,roe,sector,regular_market_time,regular_market_volume,adtv,short_name,long_name,is_archived')
      .order('symbol', { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`brapi_quotes: ${error.message}`);
    for (const r of data ?? []) {
      out.push({
        symbol: String(r.symbol || '').trim().toUpperCase(),
        price: num(r.price) ?? num(r.regular_market_price),
        marketCap: num(r.market_cap),
        pl: num(r.pl),
        pvp: num(r.pvp),
        roePct: num(r.roe),
        sector: String(r.sector || '').trim(),
        time: r.regular_market_time ? String(r.regular_market_time) : null,
        volume: num(r.regular_market_volume) ?? num(r.adtv),
        shortName: String(r.short_name || ''),
        longName: String(r.long_name || ''),
        archived: r.is_archived === true,
      });
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

export const FATO_TYPES: FatoType[] = ['FR', 'CM', 'PR'];
const FATOS_FETCH_ROWS = 120;

/** Últimos FR/CM/PR com resumo por IA (cvm_documents, mais recentes primeiro). */
export async function fetchCvmRows(sb: SupabaseClient = anonClient(), now = new Date()): Promise<CvmRow[]> {
  const { data, error } = await sb
    .from('cvm_documents')
    .select('ticker,doc_type,date,published_date,summary,ai_summary,link,source_created_at,company_name')
    .in('doc_type', FATO_TYPES)
    .not('ai_summary', 'is', null)
    .lte('date', brtDate(now.getTime()))   // o feed tem linhas com data no futuro
    .order('date', { ascending: false })
    .order('source_created_at', { ascending: false })
    .limit(FATOS_FETCH_ROWS);
  if (error) throw new Error(`cvm_documents: ${error.message}`);
  return (data ?? []) as CvmRow[];
}

/** divTTM do valuations.json no disco (último build completo), para prévia e execuções parciais. */
export function readDividendsFile(siteRoot: string): DividendsByTicker {
  const file = join(siteRoot, 'valuations.json');
  if (!existsSync(file)) return {};
  try {
    const raw = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown>;
    const out: DividendsByTicker = {};
    for (const [t, v] of Object.entries(raw)) {
      if (t.startsWith('_') || !v || typeof v !== 'object') continue;
      const d = num((v as Record<string, unknown>).divTTM);
      if (d !== null && d >= 0) out[t] = { divTTM: d };
    }
    return out;
  } catch {
    return {};
  }
}

// ─── Ranking (puro) ───────────────────────────────────────────────────────

export const RANKING_DEFAULTS = {
  /** Tira micro caps: R$ 1 bilhão de valor de mercado. */
  minMarketCap: 1e9,
  /** Cotação mais de N dias mais velha que a mais recente fica de fora (papel parado/suspenso). */
  staleDays: 7,
  /** Tamanho de cada aba. */
  topN: 20,
  /** DY acima disto quase sempre é provento extraordinário ou evento não ajustado: fora da ordem. */
  dyMax: 0.5,
  /** ROE acima de 150% vem de patrimônio minúsculo ou dado quebrado: fora da ordem. */
  roeMax: 1.5,
  /** Mesmo piso do Top Value do Radar (P/L ≥ 0,1). */
  plMin: 0.1,
} as const;

export interface RankingOptions {
  hasPage: (ticker: string) => boolean;
  minMarketCap?: number;
  topN?: number;
}

export interface RankingResult {
  data: RankingData;
  /** Fora da ordenação por sanidade (vira ::warning:: no log, não vai para o JSON). */
  excluded: { t: string; reason: string }[];
}

const SKIP_SECTORS = new Set(['', 'Fundos Imobiliários', 'Fundos', 'ETF']);

export function buildRanking(quotes: QuoteRow[], dividends: DividendsByTicker, opts: RankingOptions): RankingResult {
  const min = opts.minMarketCap ?? RANKING_DEFAULTS.minMarketCap;
  const topN = opts.topN ?? RANKING_DEFAULTS.topN;
  const { dyMax, roeMax, plMin, staleDays } = RANKING_DEFAULTS;

  const base = quotes.filter((q) =>
    !q.archived && TICKER_RE.test(q.symbol) && !isBdr(q.symbol) &&
    (q.price ?? 0) > 0 && !SKIP_SECTORS.has(q.sector) && opts.hasPage(q.symbol));

  // Valor de mercado é da companhia: as units (TAEE11, BPAC11, KLBN11, SANB11...) vêm de
  // brapi_quotes com market_cap nulo e herdam o das outras classes da mesma raiz. Sem isso o
  // corte tirava a unit antes da escolha da classe mais negociada (saía BPAC3 no lugar de BPAC11).
  const rootCap = new Map<string, number>();
  for (const q of base) {
    const r = tickerRoot(q.symbol);
    if ((q.marketCap ?? 0) > (rootCap.get(r) ?? 0)) rootCap.set(r, q.marketCap as number);
  }
  const capOf = (q: QuoteRow): number => ((q.marketCap ?? 0) > 0 ? (q.marketCap as number) : rootCap.get(tickerRoot(q.symbol)) ?? 0);

  const eligible = base.filter((q) => capOf(q) >= min);

  const times = eligible.map((q) => parseTime(q.time)).filter((x): x is number => x !== null);
  const date = times.length ? brtDate(Math.max(...times)) : '';

  // Sem cotação recente = papel parado ou suspenso: o P/L e o DY dele são de outro dia.
  const fresh = eligible.filter((q) => {
    const ms = parseTime(q.time);
    return ms !== null && date !== '' && daysBetween(brtDate(ms), date) <= staleDays;
  });

  // Uma linha por empresa: a classe mais negociada em R$ (quantidade × preço).
  const byRoot = new Map<string, QuoteRow>();
  const liq = (q: QuoteRow) => (q.volume ?? 0) * (q.price ?? 0);
  for (const q of fresh) {
    const r = tickerRoot(q.symbol);
    const cur = byRoot.get(r);
    if (!cur || liq(q) > liq(cur) || (liq(q) === liq(cur) && (capOf(q) > capOf(cur) || (capOf(q) === capOf(cur) && q.symbol < cur.symbol)))) {
      byRoot.set(r, q);
    }
  }

  // Valor fora da faixa de sanidade não é publicado (nem na tabela): vira null e aviso no log.
  const excluded: { t: string; reason: string }[] = [];
  const pctTxt = (x: number) => `${(x * 100).toFixed(1).replace('.', ',')}%`;
  const rows: RankingRow[] = [...byRoot.values()].map((q) => {
    const price = q.price as number;
    const div = dividends[q.symbol];
    let dy = div && Number.isFinite(div.divTTM) && div.divTTM >= 0 ? round(div.divTTM / price, 4) : null;
    let roe = q.roePct !== null ? round(q.roePct / 100, 4) : null;
    if (dy !== null && dy > dyMax) {
      excluded.push({ t: q.symbol, reason: `DY de ${pctTxt(dy)} acima de ${pctTxt(dyMax)} (provento extraordinário ou evento não ajustado?) — DY não publicado` });
      dy = null;
    }
    if (roe !== null && roe > roeMax) {
      excluded.push({ t: q.symbol, reason: `ROE de ${pctTxt(roe)} acima de ${pctTxt(roeMax)} — ROE não publicado` });
      roe = null;
    }
    return {
      t: q.symbol,
      name: bestName(q.shortName, q.longName) || q.symbol,
      sector: q.sector,
      price: round(price, 2),
      dy,
      pl: q.pl !== null ? round(q.pl, 2) : null,
      pvp: q.pvp !== null ? round(q.pvp, 2) : null,
      roe,
      mcap: Math.round(capOf(q)),
    };
  }).sort((a, b) => b.mcap - a.mcap || (a.t < b.t ? -1 : 1));

  const pick = (filter: (r: RankingRow) => boolean, value: (r: RankingRow) => number, dir: 1 | -1): string[] =>
    rows.filter(filter).sort((a, b) => dir * (value(a) - value(b)) || b.mcap - a.mcap).slice(0, topN).map((r) => r.t);

  const top: Record<RankingKey, string[]> = {
    dy: pick((r) => r.dy !== null && r.dy > 0, (r) => r.dy as number, -1),
    pl: pick((r) => r.pl !== null && r.pl >= plMin, (r) => r.pl as number, 1),
    pvp: pick((r) => r.pvp !== null && r.pvp > 0, (r) => r.pvp as number, 1),
    roe: pick((r) => r.roe !== null && r.roe > 0, (r) => r.roe as number, -1),
  };

  return {
    data: {
      date,
      dateBR: date ? isoToBR(date) : '',
      minMarketCap: min,
      count: rows.length,
      rows,
      top,
      limits: { dyMax, roeMax, plMin, topN },
    },
    excluded,
  };
}

export interface Check {
  problems: string[];
  warnings: string[];
}

/** Problema = não publica (a versão anterior continua). Aviso = publica e avisa no log. */
export function validateRanking(d: RankingData, now = new Date()): Check {
  const problems: string[] = [];
  const warnings: string[] = [];
  if (!d.date) problems.push('sem data de cotação (regular_market_time vazio em todos os papéis)');
  if (d.count < 60) problems.push(`só ${d.count} ações no ranking (mínimo 60): dado incompleto`);
  const withDy = d.rows.filter((r) => r.dy !== null).length;
  if (d.count > 0 && withDy < d.count * 0.5) problems.push(`DY calculado para só ${withDy} de ${d.count} ações: faltam os proventos do build`);
  for (const k of Object.keys(d.top) as RankingKey[]) {
    if (d.top[k].length < 10) problems.push(`aba ${k} com só ${d.top[k].length} ações (mínimo 10)`);
  }
  if (d.date) {
    const age = daysBetween(d.date, brtDate(now.getTime()));
    if (age > 7) problems.push(`cotação de ${d.dateBR} (${age} dias): base de cotações parada?`);
    else if (age > 4) warnings.push(`cotação de ${d.dateBR} (${age} dias)`);
  }
  return { problems, warnings };
}

// ─── Fatos relevantes (puro) ──────────────────────────────────────────────

export const FATO_LABELS: Record<FatoType, string> = {
  FR: 'Fato Relevante',
  CM: 'Comunicado ao Mercado',
  PR: 'Press Release',
};

/** `ai_summary` vem com markdown leve; o preâmbulo de persona do modelo não é informação. */
export const cleanCvmText = (raw: string): string =>
  raw
    .replace(/\*\*/g, '')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/[`_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(como|na qualidade de|enquanto)\s+analista[^.:]*[.:]\s*/i, '');

const CVM_DATE_SUFFIX = /\s*-\s*Dat[ae]\s*\d{4}-\d{2}-\d{2}\s*$/i;

/** `summary` vem como "<Tipo> - <título> - Date AAAA-MM-DD" (título pode ser vazio). */
export function cvmTitle(summary: string, type: FatoType): string {
  let s = summary.replace(CVM_DATE_SUFFIX, '').trim();
  const sep = s.indexOf(' - ');
  if (sep >= 0) s = s.slice(sep + 3);
  s = cleanCvmText(s.replace(/^[\s-]+/, '').replace(/[\s,;-]+$/, ''));
  if (!s || s.toUpperCase() === type || s.toLowerCase() === FATO_LABELS[type].toLowerCase()) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface PageLookup {
  /** /{T}/ é página real (não redirect). */
  page: (t: string) => boolean;
  /** /airton/{T}/ existe. */
  airton: (t: string) => boolean;
  /** Tickers conhecidos, para achar a página pela raiz do emissor. */
  known: string[];
}

/** Link interno de um documento: /airton/{T}/ quando existe, senão /{T}/, também pela raiz. */
export function resolveDocPage(ticker: string, look: PageLookup): { t: string; url: string } | null {
  const first = (t: string) => (look.airton(t) ? { t, url: `/airton/${t}/` } : look.page(t) ? { t, url: `/${t}/` } : null);
  const direct = first(ticker);
  if (direct) return direct;
  // Documento da CVM é da companhia, não da classe: PETR3 cai na página de PETR4.
  const root = tickerRoot(ticker);
  const siblings = look.known.filter((k) => k !== ticker && tickerRoot(k) === root).sort();
  for (const s of siblings) if (look.airton(s)) return { t: s, url: `/airton/${s}/` };
  for (const s of siblings) if (look.page(s)) return { t: s, url: `/${s}/` };
  return null;
}

export interface FatosOptions extends PageLookup {
  names: Map<string, string>;
  now?: Date;
  limit?: number;
  summaryMax?: number;
}

export function buildFatos(rows: CvmRow[], opts: FatosOptions): FatosData {
  const today = brtDate((opts.now ?? new Date()).getTime());
  const limit = opts.limit ?? 24;
  const max = opts.summaryMax ?? 240;
  const seen = new Set<string>();
  const items: (FatoItem & { _ms: number })[] = [];
  for (const r of rows) {
    const type = String(r.doc_type || '').trim().toUpperCase() as FatoType;
    if (!FATO_TYPES.includes(type)) continue;
    const link = String(r.link || '').trim();
    if (!/^https?:\/\//i.test(link) || seen.has(link)) continue;
    const date = isISODate(r.published_date) ? r.published_date : isISODate(String(r.date || '').slice(0, 10)) ? String(r.date).slice(0, 10) : '';
    if (!date || date > today) continue;
    const ticker = String(r.ticker || '').trim().toUpperCase();
    if (!TICKER_RE.test(ticker)) continue;
    const summary = cleanCvmText(String(r.ai_summary || ''));
    if (summary.length < 40) continue;   // resumo vazio ou truncado não informa nada
    const page = resolveDocPage(ticker, opts);
    if (!page) continue;
    seen.add(link);
    const ms = parseTime(r.source_created_at);
    items.push({
      t: page.t,
      name: opts.names.get(page.t) || opts.names.get(ticker) || String(r.company_name || '').trim() || page.t,
      type,
      typeLabel: FATO_LABELS[type],
      title: cvmTitle(String(r.summary || ''), type) || FATO_LABELS[type],
      date,
      time: ms !== null ? brtTime(ms) : null,
      summary: truncate(summary, max),
      url: page.url,
      _ms: ms ?? Date.parse(`${date}T15:00:00Z`),
    });
  }
  items.sort((a, b) => (a.date === b.date ? b._ms - a._ms : a.date < b.date ? 1 : -1));
  const out: FatoItem[] = items.slice(0, limit).map(({ _ms, ...it }) => it);
  const updated = out[0]?.date ?? '';
  return { updated, updatedBR: updated ? isoToBR(updated) : '', count: out.length, items: out };
}

export function validateFatos(d: FatosData, now = new Date()): Check {
  const problems: string[] = [];
  const warnings: string[] = [];
  if (d.count < 5) problems.push(`só ${d.count} documentos com resumo (mínimo 5)`);
  if (d.updated) {
    const age = daysBetween(d.updated, brtDate(now.getTime()));
    if (age > 7) problems.push(`documento mais recente de ${d.updatedBR} (${age} dias): feed da CVM parado?`);
    else if (age > 4) warnings.push(`documento mais recente de ${d.updatedBR} (${age} dias)`);
  } else problems.push('nenhum documento');
  return { problems, warnings };
}
