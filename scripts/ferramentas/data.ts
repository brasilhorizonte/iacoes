/**
 * Dados reais das páginas /ferramentas/ (SPEC §3 e §7; SPEC-v2 §B8 e §C): ranking de ações,
 * fatos relevantes e os benchmarks do backtest (Ibovespa × CDI).
 *
 * Leitura SOMENTE com a anon key (a mesma do CI): brapi_quotes, brapi_income_statements,
 * cvm_documents, brapi_daily_prices e sgs_series_data têm SELECT liberado a anon. Nada aqui
 * escreve no banco.
 *
 * Funções puras para tudo o que decide número (filtro, ordem, data, resumo, série): os testes
 * rodam sem rede. As buscas ficam isoladas nas funções fetch*.
 *
 * Dividend yield do ranking: proventos de 12 meses COMO O GERADOR CALCULA (o mesmo `divTTM`
 * do valuations.json, sem as duplicatas da fonte e ajustado por desdobramento/grupamento) ÷
 * cotação, ao lado do DY médio de 5 anos (`avgDiv['5']` ÷ cotação). Nada de usar o
 * `dividend_yield` do banco, que soma proventos sem ajuste nem deduplicação (SBSP3 saía com
 * ~10,9%; GRND3 com a mesma distribuição gravada por dois lotes).
 *
 * O formato de cada dados.json está nos tipos abaixo (RankingDataX, FatosDataX, BacktestData).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { isoToBR, truncate } from '../ticker/lib/format';
import { isoMinusYears } from '../lib/dates';
import { cleanCompanyName, companyName } from '../lib/company-name';
import type {
  CvmRow, DividendsByTicker, FatoItem, FatoType, FatosData, QuoteRow, RankingData, RankingKey, RankingRow,
} from './types';

const warn = (msg: string) => console.warn(`::warning title=Ferramentas::${msg}`);
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

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

/** Mês anterior/seguinte (AAAA-MM). */
export const addMonths = (month: string, n: number): string => {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + n;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, '0')}`;
};

// ─── Helpers ──────────────────────────────────────────────────────────────

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const round = (n: number, dec: number): number => Math.round(n * 10 ** dec) / 10 ** dec;

/**
 * Mesmo critério do site (scripts/supabase.ts): short_name igual ao ticker perde para o long_name.
 * ⚠️ Nome CRU da brapi (em inglês, com o sufixo da classe: "Itausa SA Non-Cum Perp Pfd Registered
 * Shs"). Para exibir, use `companyName` de scripts/lib/company-name.ts, como o ranking e os fatos.
 */
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

function writeJson(outRoot: string, path: string, data: unknown): void {
  const file = join(outRoot, path);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, JSON.stringify(data), 'utf-8');
}

// ─── Busca (anon, somente leitura) ────────────────────────────────────────

export function anonClient(url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY): SupabaseClient {
  if (!url || !key) throw new Error('SUPABASE_URL/SUPABASE_ANON_KEY ausentes');
  return createClient(url, key);
}

/** Linha de brapi_quotes com o que o ranking confere a mais (LPA, VPA, data do último balanço). */
export interface RankingQuote extends QuoteRow {
  /** LPA e VPA do banco (R$/ação): conferem o P/L e o P/VP do próprio banco. */
  lpa?: number | null;
  vpa?: number | null;
  /**
   * Fim do período do demonstrativo mais recente (brapi_income_statements, AAAA-MM-DD).
   * null = nenhum nos últimos 2 anos; ausente = não conferido (busca falhou ou dado de teste).
   */
  statementDate?: string | null;
}

/**
 * Demonstrativo mais recente de cada papel (fim do período), dos últimos 2 anos. É o que diz se
 * P/L, P/VP e ROE do banco são de agora: BSLI4 (BRB) parou no balanço de 30/06/2025.
 */
export async function fetchStatementDates(sb: SupabaseClient = anonClient(), now = new Date()): Promise<Map<string, string>> {
  const from = isoMinusYears(brtDate(now.getTime()), 2);
  const out = new Map<string, string>();
  for (let off = 0; ; off += 1000) {
    const { data, error } = await sb
      .from('brapi_income_statements')
      .select('symbol,end_date,type,period')
      .gte('end_date', from)
      .order('symbol', { ascending: true })
      .order('end_date', { ascending: true })
      .order('type', { ascending: true })
      .order('period', { ascending: true })
      .range(off, off + 999);
    if (error) throw new Error(`brapi_income_statements: ${error.message}`);
    for (const r of data ?? []) {
      const s = String(r.symbol || '').trim().toUpperCase().replace(/\.SA$/, '');
      const d = String(r.end_date || '').slice(0, 10);
      if (!s || !isISODate(d)) continue;
      if (!out.has(s) || d > (out.get(s) as string)) out.set(s, d);
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

/**
 * brapi_quotes inteira (paginada: o anon corta em 1.000 linhas), com LPA/VPA e a data do último
 * demonstrativo. Se a busca dos demonstrativos falhar, o ranking sai sem essa conferência
 * (aviso no log), não sem ranking.
 */
export async function fetchQuotes(sb: SupabaseClient = anonClient(), now = new Date()): Promise<RankingQuote[]> {
  const out: RankingQuote[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('brapi_quotes')
      .select('symbol,price,regular_market_price,market_cap,pl,pvp,lpa,vpa,roe,sector,regular_market_time,regular_market_volume,adtv,short_name,long_name,is_archived')
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
        lpa: num(r.lpa),
        vpa: num(r.vpa),
      });
    }
    if (!data || data.length < 1000) break;
  }
  try {
    const dates = await fetchStatementDates(sb, now);
    for (const q of out) q.statementDate = dates.get(q.symbol) ?? null;
  } catch (e) {
    warn(`ranking sem a conferência de balanço defasado (P/L, P/VP e ROE entram sem ela): ${errMsg(e)}`);
  }
  return out;
}

/** Fato Relevante e Comunicado ao Mercado: os únicos com resumo por IA (PR não tem; ITR/DFP não têm). */
export const FATO_TYPES: FatoType[] = ['FR', 'CM'];
const FATOS_FETCH_ROWS = 120;

/** Últimos FR/CM com resumo por IA (cvm_documents, mais recentes primeiro). */
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

// ─── Proventos do gerador (valuations.json) ───────────────────────────────

/** Proventos por ação como o gerador calcula: 12 meses e média anual de 5 anos (R$/ação). */
export interface DividendInfo {
  divTTM: number;
  /** `avgDiv['5']` do valuations.json; ausente/null = não informado (sem a régua de 2×). */
  avg5?: number | null;
}
export type DividendsInfo = Record<string, DividendInfo>;

/** divTTM e média de 5 anos do valuations.json no disco (último build), para prévia e execuções parciais. */
export function readDividendsFile(siteRoot: string): DividendsInfo {
  const file = join(siteRoot, 'valuations.json');
  if (!existsSync(file)) return {};
  try {
    const raw = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown>;
    const out: DividendsInfo = {};
    for (const [t, v] of Object.entries(raw)) {
      if (t.startsWith('_') || !v || typeof v !== 'object') continue;
      const d = num((v as Record<string, unknown>).divTTM);
      if (d === null || d < 0) continue;
      const avg = (v as { avgDiv?: Record<string, unknown> }).avgDiv;
      const a5 = avg && typeof avg === 'object' ? num(avg['5']) : null;
      out[t] = { divTTM: d, avg5: a5 !== null && a5 >= 0 ? a5 : null };
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Junta as três fontes de proventos do ranking, da mais velha para a mais nova: valuations.json
 * do disco, dados passados à mão (testes/prévia) e o widgetValuations desta execução (com
 * `avgDiv`). Entrada da execução sem `avgDiv` mantém a média de 5 anos que já havia para o papel.
 */
export function mergeDividendInputs(
  file: DividendsInfo,
  data?: DividendsByTicker | DividendsInfo,
  build?: Record<string, { divTTM?: number; avgDiv?: Record<string, number> } | undefined>,
): DividendsInfo {
  const out: DividendsInfo = { ...file };
  for (const [t, v] of Object.entries(data ?? {})) {
    if (v && Number.isFinite(v.divTTM) && v.divTTM >= 0) out[t] = { avg5: out[t]?.avg5 ?? null, ...v };
  }
  for (const [t, v] of Object.entries(build ?? {})) {
    if (!v || typeof v.divTTM !== 'number' || !Number.isFinite(v.divTTM) || v.divTTM < 0) continue;
    const a5 = num(v.avgDiv?.['5']);
    out[t] = { divTTM: v.divTTM, avg5: a5 !== null && a5 >= 0 ? a5 : out[t]?.avg5 ?? null };
  }
  return out;
}

// ─── Ranking (puro) ───────────────────────────────────────────────────────

/**
 * Cortes de sanidade (SPEC-v2 §C Ranking). Fora do corte = fora daquela aba (aviso no log se
 * estaria no topo). Os valores continuam na linha, exceto os absurdos (acima dos tetos de
 * publicação), que nem são publicados.
 */
export const RANKING_DEFAULTS = {
  /** Tira micro caps: R$ 1 bilhão de valor de mercado. */
  minMarketCap: 1e9,
  /** Cotação mais de N dias mais velha que a mais recente fica de fora (papel parado/suspenso). */
  staleDays: 7,
  /** Tamanho de cada aba. */
  topN: 20,
  /** Aba DY: DY de 12 meses acima disto é provento atípico (fora da aba). */
  dyMax: 0.25,
  /** Aba DY: DY de 12 meses acima de N× o DY médio de 5 anos é provento atípico (fora da aba). */
  dyVs5yMax: 2,
  /** Aba P/L: P/L a partir de 0,1 (mesmo piso do Top Value do Radar) e abaixo de 100. */
  plMin: 0.1,
  plMax: 100,
  /** Aba P/VP: de 0,2 a 20. */
  pvpMin: 0.2,
  pvpMax: 20,
  /** ROE de −50% a 100% (a aba "Maior ROE" usa só os positivos). */
  roeMin: -0.5,
  roeMax: 1,
  /** P/L, P/VP e ROE do banco ficam fora das abas quando o último demonstrativo tem mais de N dias. */
  statementMaxAgeDays: 200,
  /** P/L (P/VP) do banco mais de 5% longe de cotação ÷ LPA (VPA): número inconsistente, fora da aba. */
  ratioTolerance: 0.05,
  /** Tetos de publicação: acima disto o número nem vai para o JSON (evento não ajustado ou erro). */
  dyPublishMax: 0.5,
  roePublishMax: 1.5,
} as const;

export interface RankingOptions {
  hasPage: (ticker: string) => boolean;
  minMarketCap?: number;
  topN?: number;
}

/** Linha do ranking com o DY médio de 5 anos e a marca de provento atípico (só campos novos). */
export interface RankingRowX extends RankingRow {
  /** DY médio de 5 anos em fração: média anual de proventos dos últimos 5 anos ÷ cotação de hoje. */
  dy5y: number | null;
  /** DY de 12 meses acima de 25% ou de 2× o DY médio de 5 anos: fora da aba DY. */
  dyAtypical: boolean;
}

/** Mediana do setor por indicador (régua da página), só com valores dentro dos cortes. */
export interface SectorMedian {
  dy: number | null;
  pl: number | null;
  pvp: number | null;
  roe: number | null;
  /** Empresas do setor no ranking. */
  count: number;
}

export interface RankingLimits {
  dyMax: number;
  roeMax: number;
  plMin: number;
  topN: number;
  dyVs5yMax: number;
  plMax: number;
  pvpMin: number;
  pvpMax: number;
  roeMin: number;
  statementMaxAgeDays: number;
}

/**
 * Aviso que acompanha o dado do ranking (SPEC-v2 §B3): quem lê o JSON solto (landing, widget,
 * terceiros) recebe junto que a ordem é por indicador, não recomendação.
 */
export const RANKING_AVISO = 'Ordenação por indicador objetivo, não é recomendação de investimento.' as const;

/** O dados.json do ranking: o formato da fundação com campos a mais (nada removido). */
export interface RankingDataX extends RankingData {
  rows: RankingRowX[];
  /** Mediana por setor (chave = `sector` das linhas); null com menos de 3 valores. */
  sectorMedian: Record<string, SectorMedian>;
  limits: RankingLimits;
  /** Sempre `RANKING_AVISO` (campo novo, no fim do arquivo). */
  aviso: typeof RANKING_AVISO;
}

export interface RankingResult {
  data: RankingDataX;
  /** Fora da ordenação ou da aba por sanidade (vira ::warning:: no log, não vai para o JSON). */
  excluded: { t: string; reason: string }[];
}

const SKIP_SECTORS = new Set(['', 'Fundos Imobiliários', 'Fundos', 'ETF']);

const median = (xs: number[]): number | null => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (s.length < 3) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export function buildRanking(quotes: readonly RankingQuote[], dividends: DividendsInfo, opts: RankingOptions): RankingResult {
  const min = opts.minMarketCap ?? RANKING_DEFAULTS.minMarketCap;
  const topN = opts.topN ?? RANKING_DEFAULTS.topN;
  const L = RANKING_DEFAULTS;

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
    return ms !== null && date !== '' && daysBetween(brtDate(ms), date) <= L.staleDays;
  });

  // Uma linha por empresa: a classe mais negociada em R$ (quantidade × preço).
  const byRoot = new Map<string, RankingQuote>();
  const liq = (q: QuoteRow) => (q.volume ?? 0) * (q.price ?? 0);
  for (const q of fresh) {
    const r = tickerRoot(q.symbol);
    const cur = byRoot.get(r);
    if (!cur || liq(q) > liq(cur) || (liq(q) === liq(cur) && (capOf(q) > capOf(cur) || (capOf(q) === capOf(cur) && q.symbol < cur.symbol)))) {
      byRoot.set(r, q);
    }
  }

  // A régua de 2× precisa da média de 5 anos do gerador. Se NENHUM papel a trouxe (execução que
  // ainda não passa `avgDiv`), a aba DY fica só com o teto de 25% e o log avisa; se alguns a
  // trazem, quem não tem fica fora da aba DY (não dá para conferir).
  const has5y = [...byRoot.values()].some((q) => num(dividends[q.symbol]?.avg5) !== null);

  const excluded: { t: string; reason: string }[] = [];
  const pctTxt = (x: number) => `${(x * 100).toFixed(1).replace('.', ',')}%`;
  const numTxt = (x: number) => x.toFixed(2).replace('.', ',');

  interface Work { row: RankingRowX; stale: string | null; plBad: string | null; pvpBad: string | null; rawDy: number | null }
  const work: Work[] = [...byRoot.values()].map((q) => {
    const price = q.price as number;
    const div = dividends[q.symbol];
    const ttm = div && Number.isFinite(div.divTTM) && div.divTTM >= 0 ? div.divTTM : null;
    const a5 = num(div?.avg5);
    const rawDy = ttm !== null ? round(ttm / price, 4) : null;
    let dy5y = a5 !== null && a5 >= 0 ? round(a5 / price, 4) : null;
    // Média de 5 anos absurda = provento de outra empresa ou evento mal gravado na fonte (HAPV3,
    // out/2026: R$ 1,61 de 10/02/2022 × 15 do grupamento de 2025 dá 56% ao ano): não publica e,
    // sem ela, o papel não entra na aba DY (não dá para conferir a régua de 2×).
    if (dy5y !== null && dy5y > L.dyPublishMax) {
      excluded.push({ t: q.symbol, reason: `DY médio de 5 anos de ${pctTxt(dy5y)} acima de ${pctTxt(L.dyPublishMax)} (provento mal gravado na fonte?) — média não publicada` });
      dy5y = null;
    }
    const dyAtypical = rawDy !== null && rawDy > 0 && (rawDy > L.dyMax || (dy5y !== null && rawDy > L.dyVs5yMax * dy5y));
    let dy = rawDy;
    let roe = q.roePct !== null ? round(q.roePct / 100, 4) : null;
    if (dy !== null && dy > L.dyPublishMax) {
      excluded.push({ t: q.symbol, reason: `DY de ${pctTxt(dy)} acima de ${pctTxt(L.dyPublishMax)} (provento extraordinário ou evento não ajustado?) — DY não publicado` });
      dy = null;
    }
    if (roe !== null && roe > L.roePublishMax) {
      excluded.push({ t: q.symbol, reason: `ROE de ${pctTxt(roe)} acima de ${pctTxt(L.roePublishMax)} — ROE não publicado` });
      roe = null;
    }
    // Balanço defasado: P/L, P/VP e ROE do banco são de outro tempo (BSLI4: DRE parada em 30/06/2025).
    let stale: string | null = null;
    if (q.statementDate !== undefined && date) {
      if (q.statementDate === null) stale = 'sem demonstrativo nos últimos 2 anos';
      else if (daysBetween(q.statementDate, date) > L.statementMaxAgeDays) {
        stale = `último demonstrativo de ${isoToBR(q.statementDate)} (${daysBetween(q.statementDate, date)} dias): P/L, P/VP e ROE defasados`;
      }
    }
    // Conferência interna do banco: P/L = cotação ÷ LPA e P/VP = cotação ÷ VPA (BSLI4: P/L feito com a cotação da BSLI3).
    const off = (ratio: number | null, per: number | null | undefined): number | null =>
      ratio !== null && ratio > 0 && per != null && per > 0 ? Math.abs(ratio / (price / per) - 1) : null;
    const plOff = off(q.pl, q.lpa);
    const pvpOff = off(q.pvp, q.vpa);
    const plBad = plOff !== null && plOff > L.ratioTolerance
      ? `P/L do banco (${numTxt(q.pl as number)}) diferente de cotação ÷ LPA (${numTxt(price / (q.lpa as number))})` : null;
    const pvpBad = pvpOff !== null && pvpOff > L.ratioTolerance
      ? `P/VP do banco (${numTxt(q.pvp as number)}) diferente de cotação ÷ VPA (${numTxt(price / (q.vpa as number))})` : null;
    const row: RankingRowX = {
      t: q.symbol,
      // Nome limpo ("Itausa", não "Itausa SA Non-Cum Perp Pfd Registered Shs"): scripts/lib/company-name.ts.
      name: companyName(q.shortName, q.longName, q.symbol),
      sector: q.sector,
      price: round(price, 2),
      dy,
      pl: q.pl !== null ? round(q.pl, 2) : null,
      pvp: q.pvp !== null ? round(q.pvp, 2) : null,
      roe,
      mcap: Math.round(capOf(q)),
      dy5y,
      dyAtypical,
    };
    return { row, stale, plBad, pvpBad, rawDy };
  }).sort((a, b) => b.row.mcap - a.row.mcap || (a.row.t < b.row.t ? -1 : 1));

  // Quem entra em cada aba e, para o log, por que ficou fora.
  const why: Record<RankingKey, (w: Work) => string | null> = {
    dy: (w) => {
      const r = w.row;
      if (r.dy === null || r.dy <= 0) return 'sem DY';
      if (r.dyAtypical) {
        return r.dy > L.dyMax
          ? `DY de 12 meses de ${pctTxt(r.dy)} acima de ${pctTxt(L.dyMax)} (provento atípico)`
          : `DY de 12 meses de ${pctTxt(r.dy)} acima de ${L.dyVs5yMax}× o DY médio de 5 anos (${pctTxt(r.dy5y as number)}) (provento atípico)`;
      }
      if (has5y && r.dy5y === null) return 'sem a média de 5 anos para conferir o DY';
      return null;
    },
    pl: (w) => {
      const r = w.row;
      if (r.pl === null || r.pl <= 0) return 'P/L negativo ou ausente';
      if (r.pl < L.plMin || r.pl >= L.plMax) return `P/L de ${numTxt(r.pl)} fora da faixa (${numTxt(L.plMin)} a ${L.plMax})`;
      return w.stale ?? w.plBad;
    },
    pvp: (w) => {
      const r = w.row;
      if (r.pvp === null || r.pvp <= 0) return 'P/VP negativo ou ausente';
      if (r.pvp < L.pvpMin || r.pvp > L.pvpMax) return `P/VP de ${numTxt(r.pvp)} fora da faixa (${numTxt(L.pvpMin)} a ${L.pvpMax})`;
      return w.stale ?? w.pvpBad;
    },
    roe: (w) => {
      const r = w.row;
      if (r.roe === null || r.roe <= 0) return 'ROE negativo ou ausente';
      if (r.roe > L.roeMax) return `ROE de ${pctTxt(r.roe)} acima de ${pctTxt(L.roeMax)}`;
      return w.stale;
    },
  };
  // O DY da ordem é o calculado (antes do teto de publicação): na aba, os dois são o mesmo.
  const metric = (w: Work, k: RankingKey): number | null => (k === 'dy' ? w.rawDy : k === 'pl' ? w.row.pl : k === 'pvp' ? w.row.pvp : w.row.roe);
  const dir: Record<RankingKey, 1 | -1> = { dy: -1, pl: 1, pvp: 1, roe: -1 };
  const order = (list: Work[], k: RankingKey) =>
    list.slice().sort((a, b) => dir[k] * ((metric(a, k) as number) - (metric(b, k) as number)) || b.row.mcap - a.row.mcap);

  const top = {} as Record<RankingKey, string[]>;
  for (const k of ['dy', 'pl', 'pvp', 'roe'] as RankingKey[]) {
    top[k] = order(work.filter((w) => why[k](w) === null), k).slice(0, topN).map((w) => w.row.t);
    // Aviso só para quem estaria no topo sem o corte (o resto da cauda não interessa ao log).
    const naive = order(work.filter((w) => { const v = metric(w, k); return v !== null && v > 0; }), k).slice(0, topN);
    for (const w of naive) {
      const r = why[k](w);
      // DY acima do teto de publicação já foi avisado acima.
      if (r && !(k === 'dy' && w.row.dy === null)) excluded.push({ t: w.row.t, reason: `fora da aba ${k}: ${r}` });
    }
  }

  // Mediana do setor por indicador, só com valores dentro dos cortes (régua, não ordem).
  const sectorMedian: Record<string, SectorMedian> = {};
  const bySector = new Map<string, Work[]>();
  for (const w of work) {
    if (!w.row.sector) continue;
    const g = bySector.get(w.row.sector);
    if (g) g.push(w); else bySector.set(w.row.sector, [w]);
  }
  for (const [sector, ws] of [...bySector.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const dyV = ws.filter((w) => w.row.dy !== null && !w.row.dyAtypical).map((w) => w.row.dy as number);
    const plV = ws.filter((w) => w.row.pl !== null && w.row.pl >= L.plMin && w.row.pl < L.plMax && !w.stale && !w.plBad).map((w) => w.row.pl as number);
    const pvpV = ws.filter((w) => w.row.pvp !== null && w.row.pvp >= L.pvpMin && w.row.pvp <= L.pvpMax && !w.stale && !w.pvpBad).map((w) => w.row.pvp as number);
    const roeV = ws.filter((w) => w.row.roe !== null && w.row.roe >= L.roeMin && w.row.roe <= L.roeMax && !w.stale).map((w) => w.row.roe as number);
    const md = (xs: number[], dec: number) => { const m = median(xs); return m === null ? null : round(m, dec); };
    sectorMedian[sector] = { dy: md(dyV, 4), pl: md(plV, 2), pvp: md(pvpV, 2), roe: md(roeV, 4), count: ws.length };
  }

  return {
    data: {
      date,
      dateBR: date ? isoToBR(date) : '',
      minMarketCap: min,
      count: work.length,
      rows: work.map((w) => w.row),
      top,
      limits: {
        dyMax: L.dyMax,
        roeMax: L.roeMax,
        plMin: L.plMin,
        topN,
        dyVs5yMax: L.dyVs5yMax,
        plMax: L.plMax,
        pvpMin: L.pvpMin,
        pvpMax: L.pvpMax,
        roeMin: L.roeMin,
        statementMaxAgeDays: L.statementMaxAgeDays,
      },
      sectorMedian,
      aviso: RANKING_AVISO,
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
  const rows = d.rows as Partial<RankingRowX>[];
  if (withDy > 0 && !rows.some((r) => r.dy5y !== null && r.dy5y !== undefined)) {
    warnings.push("DY médio de 5 anos ausente em todas as ações: a aba DY saiu só com o teto de 25%, sem a régua de 2× (passe o avgDiv['5'] do gerador ao ranking: mergeDividendInputs)");
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

/** Item do feed com as datas separadas: publicação na CVM × entrada no feed (só campos novos). */
export interface FatoItemX extends FatoItem {
  /** Data de publicação na CVM (cvm_documents.published_date; sem ela, `date`). Igual a `date`. */
  publishedDate: string;
  /** Dia (BRT) em que o documento entrou no feed (source_created_at); null sem esse horário. */
  feedDate: string | null;
  /** Hora (HH:MM, BRT) em que o documento entrou no feed — NÃO é a hora da publicação. Igual a `time`. */
  feedTime: string | null;
  /** Rótulo pronto: "entrou no feed às 12:25" ou "entrou no feed em 06/10 às 00:17"; null sem horário. */
  feedLabel: string | null;
}

export interface FatosDataX extends FatosData {
  items: FatoItemX[];
}

export function buildFatos(rows: CvmRow[], opts: FatosOptions): FatosDataX {
  const today = brtDate((opts.now ?? new Date()).getTime());
  const limit = opts.limit ?? 24;
  const max = opts.summaryMax ?? 240;
  const seen = new Set<string>();
  const items: (FatoItemX & { _ms: number })[] = [];
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
    const feedDate = ms !== null ? brtDate(ms) : null;
    const feedTime = ms !== null ? brtTime(ms) : null;
    const feedLabel = feedTime === null ? null
      : feedDate === date ? `entrou no feed às ${feedTime}`
        : `entrou no feed em ${(feedDate as string).slice(8, 10)}/${(feedDate as string).slice(5, 7)} às ${feedTime}`;
    items.push({
      t: page.t,
      // Nome limpo (scripts/lib/company-name.ts); o da CVM ("CIA BRASILEIRA DE DISTRIBUICAO") só sem o da brapi.
      name: cleanCompanyName(opts.names.get(page.t) || opts.names.get(ticker) || r.company_name) || page.t,
      type,
      typeLabel: FATO_LABELS[type],
      title: cvmTitle(String(r.summary || ''), type) || FATO_LABELS[type],
      date,
      time: feedTime,
      summary: truncate(summary, max),
      url: page.url,
      publishedDate: date,
      feedDate,
      feedTime,
      feedLabel,
      _ms: ms ?? Date.parse(`${date}T15:00:00Z`),
    });
  }
  items.sort((a, b) => (a.date === b.date ? b._ms - a._ms : a.date < b.date ? 1 : -1));
  const out: FatoItemX[] = items.slice(0, limit).map(({ _ms, ...it }) => it);
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

// ─── Backtest: Ibovespa × CDI (SPEC-v2 §B8) ───────────────────────────────

/** Onde o produtor escreve (mesmo slug da página /ferramentas/backtest-de-carteira/). */
export const BACKTEST_JSON = 'ferramentas/backtest-de-carteira/dados.json';
export const BACKTEST_HORIZONS = [1, 5, 10, 15] as const;
export type BacktestHorizon = (typeof BACKTEST_HORIZONS)[number];
/**
 * Ibovespa em brapi_daily_prices: os pontos do índice como a B3 publica. O Ibovespa é índice de
 * RETORNO TOTAL (metodologia da B3: "O Ibovespa é um índice de retorno total"; página do índice:
 * "Tipo de retorno: Total") — a carteira teórica reinveste os proventos. Não dizer "sem dividendos".
 */
export const IBOV_TICKER = '^BVSP';
/** Rótulo do Ibovespa no dados.json (a página e o widget mostram perto do número). */
export const IBOV_NOTE = 'índice de retorno total, com proventos reinvestidos' as const;
/** CDI no SGS do Banco Central: taxa do mês em % a.m. (o mês corrente é parcial na base). */
export const CDI_SERIES_ID = 4390;
/** Base 100 das séries: jan/2000 (ou o primeiro mês comum às duas, se for depois). */
export const BACKTEST_BASE_MONTH = '2000-01';

export interface DailyClose { date: string; close: number }
export interface MonthlyRate {
  /** AAAA-MM. */
  month: string;
  /** % ao mês (0,87 = 0,87%). */
  rate: number;
}

/** O dados.json do backtest — formato exato combinado (DADOS-API.md). */
export interface BacktestData {
  /** Último pregão do último mês completo (AAAA-MM-DD): a data do último ponto das séries. */
  updated: string;
  ibov: { name: 'Ibovespa'; note: typeof IBOV_NOTE; series: [string, number][] };
  cdi: { name: 'CDI'; series: [string, number][] };
  /** Retorno acumulado (fração: 0,1234 = 12,34%) até `updated`, para 1, 5, 10 e 15 anos. */
  table: { years: BacktestHorizon; ibov: number; cdi: number }[];
}

export interface BacktestResult {
  data: BacktestData;
  /** Meses sem fechamento do Ibovespa ou sem taxa do CDI entre a base e o último mês. */
  gaps: string[];
}

/** Fechamentos diários do Ibovespa (paginado; o anon corta em 1.000 linhas). */
export async function fetchIbovDaily(sb: SupabaseClient = anonClient(), from = '1999-12-01'): Promise<DailyClose[]> {
  const out: DailyClose[] = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await sb
      .from('brapi_daily_prices')
      .select('trade_date,close')
      .eq('ticker', IBOV_TICKER)
      .gte('trade_date', from)
      .order('trade_date', { ascending: true })
      .range(off, off + 999);
    if (error) throw new Error(`brapi_daily_prices: ${error.message}`);
    for (const r of data ?? []) {
      const date = String(r.trade_date || '').slice(0, 10);
      const close = num(r.close);
      if (isISODate(date) && close !== null && close > 0) out.push({ date, close });
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Taxa mensal do CDI (SGS 4390, % a.m.). */
export async function fetchCdiMonthly(sb: SupabaseClient = anonClient(), from = '2000-01-01'): Promise<MonthlyRate[]> {
  const out: MonthlyRate[] = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await sb
      .from('sgs_series_data')
      .select('reference_date,value')
      .eq('series_id', CDI_SERIES_ID)
      .gte('reference_date', from)
      .order('reference_date', { ascending: true })
      .range(off, off + 999);
    if (error) throw new Error(`sgs_series_data (${CDI_SERIES_ID}): ${error.message}`);
    for (const r of data ?? []) {
      const month = String(r.reference_date || '').slice(0, 7);
      const rate = num(r.value);
      if (/^\d{4}-\d{2}$/.test(month) && rate !== null) out.push({ month, rate });
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

/**
 * Séries mensais base 100 e a tabela de retornos. Só meses COMPLETOS (antes do mês corrente em
 * BRT): o CDI do mês corrente é parcial na base e o fechamento do mês ainda não existe.
 *
 * - Ibovespa: fechamento do último pregão de cada mês ÷ o do mês-base × 100 (os pontos do índice,
 *   que já é de retorno total: os proventos estão reinvestidos na carteira teórica da B3).
 * - CDI: 100 no fim do mês-base, composto mês a mês pela taxa de cada mês seguinte.
 * - Os dois pontos de um mês valem para o FIM daquele mês; o retorno de um horizonte de N anos é
 *   série[último] ÷ série[último − 12N] − 1 — a tabela usa a mesma conta sobre a série publicada
 *   (já arredondada), então o widget que refizer a conta chega ao mesmo número.
 */
export function buildBacktest(ibov: readonly DailyClose[], cdi: readonly MonthlyRate[], opts: { now?: Date; baseMonth?: string } = {}): BacktestResult {
  const curMonth = brtDate((opts.now ?? new Date()).getTime()).slice(0, 7);
  const monthEnd = new Map<string, DailyClose>();
  for (const d of [...ibov].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!isISODate(d.date) || !(d.close > 0) || d.date.slice(0, 7) >= curMonth) continue;
    monthEnd.set(d.date.slice(0, 7), d);   // o último pregão do mês fica
  }
  const rate = new Map<string, number>();
  for (const r of cdi) if (r.month < curMonth && Number.isFinite(r.rate)) rate.set(r.month, r.rate);

  const ibovMonths = [...monthEnd.keys()].sort();
  const cdiMonths = [...rate.keys()].sort();
  const empty: BacktestResult = {
    data: { updated: '', ibov: { name: 'Ibovespa', note: IBOV_NOTE, series: [] }, cdi: { name: 'CDI', series: [] }, table: [] },
    gaps: [],
  };
  if (!ibovMonths.length || !cdiMonths.length) return empty;
  const base = [opts.baseMonth ?? BACKTEST_BASE_MONTH, ibovMonths[0], cdiMonths[0]].sort().pop() as string;
  const last = [ibovMonths[ibovMonths.length - 1], cdiMonths[cdiMonths.length - 1]].sort()[0];
  if (last <= base || !monthEnd.has(base)) return empty;

  const gaps: string[] = [];
  const ibovS: [string, number][] = [];
  const cdiS: [string, number][] = [];
  const b0 = (monthEnd.get(base) as DailyClose).close;
  let lastClose = b0;
  let acc = 100;
  for (let m = base; m <= last; m = addMonths(m, 1)) {
    const c = monthEnd.get(m);
    if (c) lastClose = c.close; else gaps.push(`${m} (Ibovespa)`);
    if (m > base) {
      const r = rate.get(m);
      if (r === undefined) gaps.push(`${m} (CDI)`); else acc *= 1 + r / 100;
    }
    ibovS.push([m, round((lastClose / b0) * 100, 2)]);
    cdiS.push([m, round(acc, 2)]);
  }

  const n = ibovS.length - 1;
  const table: BacktestData['table'] = [];
  for (const years of BACKTEST_HORIZONS) {
    const i = n - 12 * years;
    if (i < 0) continue;
    table.push({
      years,
      ibov: round(ibovS[n][1] / ibovS[i][1] - 1, 4),
      cdi: round(cdiS[n][1] / cdiS[i][1] - 1, 4),
    });
  }
  return {
    data: {
      updated: monthEnd.get(last)?.date ?? '',
      ibov: { name: 'Ibovespa', note: IBOV_NOTE, series: ibovS },
      cdi: { name: 'CDI', series: cdiS },
      table,
    },
    gaps,
  };
}

/** Problema = não publica (o dados.json anterior continua). Aviso = publica e avisa no log. */
export function validateBacktest(d: BacktestData, now = new Date(), gaps: string[] = []): Check {
  const problems: string[] = [];
  const warnings: string[] = [];
  const minPoints = 12 * Math.max(...BACKTEST_HORIZONS) + 1;
  const ib = d.ibov.series;
  const cd = d.cdi.series;
  if (ib.length < minPoints || cd.length < minPoints) problems.push(`série com ${Math.min(ib.length, cd.length)} meses (mínimo ${minPoints}, para 15 anos)`);
  if (ib.length !== cd.length || ib.some((p, i) => cd[i]?.[0] !== p[0])) problems.push('meses do Ibovespa e do CDI não batem');
  if ([...ib, ...cd].some((p) => !(Number.isFinite(p[1]) && p[1] > 0))) problems.push('valor inválido na série');
  if (gaps.length) problems.push(`meses sem dado: ${gaps.slice(0, 6).join(', ')}${gaps.length > 6 ? '…' : ''}`);
  for (let i = 1; i < ib.length; i++) {
    const ch = ib[i][1] / ib[i - 1][1] - 1;
    if (Math.abs(ch) > 0.5) { problems.push(`Ibovespa variou ${(ch * 100).toFixed(0)}% em ${ib[i][0]}: dado quebrado?`); break; }
  }
  for (let i = 1; i < cd.length; i++) {
    const r = cd[i][1] / cd[i - 1][1] - 1;
    if (r < 0 || r > 0.05) { problems.push(`CDI de ${(r * 100).toFixed(2)}% em ${cd[i][0]}: fora de 0% a 5% ao mês`); break; }
  }
  if (d.table.length !== BACKTEST_HORIZONS.length || d.table.some((t) => !Number.isFinite(t.ibov) || !Number.isFinite(t.cdi))) {
    problems.push('tabela de retornos incompleta');
  }
  if (!isISODate(d.updated)) problems.push('sem data');
  else {
    const lag = (Number(brtDate(now.getTime()).slice(0, 4)) * 12 + Number(brtDate(now.getTime()).slice(5, 7))) -
      (Number(d.updated.slice(0, 4)) * 12 + Number(d.updated.slice(5, 7)));
    if (lag > 2) problems.push(`último mês completo é ${d.updated.slice(0, 7)} (${lag} meses): Ibovespa ou CDI parado?`);
    else if (lag > 1) warnings.push(`último mês completo é ${d.updated.slice(0, 7)}: falta o mês passado no Ibovespa ou no CDI`);
  }
  return { problems, warnings };
}

/** dados.json do backtest no disco (o último bom), ou null. */
export function readBacktestFile(root: string): BacktestData | null {
  const file = join(root, BACKTEST_JSON);
  if (!existsSync(file)) return null;
  try {
    const d = JSON.parse(readFileSync(file, 'utf-8')) as BacktestData;
    return isISODate(d?.updated) && Array.isArray(d.ibov?.series) && Array.isArray(d.cdi?.series) && Array.isArray(d.table) ? d : null;
  } catch {
    return null;
  }
}

export interface ProduceBacktestOptions {
  /** Onde escrever (raiz do site no build; preview/... na prévia). */
  outRoot: string;
  now?: Date;
  /** Dados prontos (testes): null = a busca falhou; ausente = buscar no Supabase. */
  data?: { ibov?: DailyClose[] | null; cdi?: MonthlyRate[] | null };
  /** false = não busca nada (testes). */
  fetch?: boolean;
  sb?: SupabaseClient;
  /**
   * false = valida e devolve o dado sem gravar o dados.json (ferramenta do backtest em rascunho: o
   * JSON só vai para a raiz com a página `pronto`; ver dataJsonPublishable em index.ts). Padrão: true.
   */
  write?: boolean;
}

/**
 * Produtor do /ferramentas/backtest-de-carteira/dados.json. Nunca derruba o build: busca vazia,
 * série incompleta ou velha vira ::warning:: e o arquivo anterior NÃO é sobrescrito. Devolve o
 * dado publicado (o mesmo do arquivo) ou null quando não publicou — nesse caso, a página usa o
 * arquivo anterior (`readBacktestFile`).
 */
export async function produceBacktest(opts: ProduceBacktestOptions): Promise<BacktestData | null> {
  const now = opts.now ?? new Date();
  try {
    let ibov = opts.data?.ibov;
    let cdi = opts.data?.cdi;
    if ((ibov === undefined || cdi === undefined) && opts.fetch !== false) {
      const sb = opts.sb ?? anonClient();
      if (ibov === undefined) ibov = await fetchIbovDaily(sb).catch((e) => { warn(`backtest: ${errMsg(e)}`); return null; });
      if (cdi === undefined) cdi = await fetchCdiMonthly(sb).catch((e) => { warn(`backtest: ${errMsg(e)}`); return null; });
    }
    if (!ibov?.length || !cdi?.length) {
      warn(`backtest não atualizado (o dados.json anterior continua): ${!ibov?.length ? 'Ibovespa' : 'CDI'} vazio`);
      return null;
    }
    const { data, gaps } = buildBacktest(ibov, cdi, { now });
    const { problems, warnings } = validateBacktest(data, now, gaps);
    for (const w of warnings) warn(`backtest: ${w}`);
    if (problems.length) {
      warn(`backtest não atualizado (o dados.json anterior continua): ${problems.join('; ')}`);
      return null;
    }
    if (opts.write !== false) writeJson(opts.outRoot, BACKTEST_JSON, data);
    return data;
  } catch (e) {
    warn(`backtest não atualizado (o dados.json anterior continua): ${errMsg(e)}`);
    return null;
  }
}
