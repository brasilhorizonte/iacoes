import { createClient } from '@supabase/supabase-js';
import type {
  RawIncomeStatement, RawBalanceSheet, RawCashFlow,
  RawBrapiQuote, RawDividend, SupabaseFinancials,
  PeerTicker, TickerIndexEntry, CvmDocument
} from './types';
import { SHARE_BASE_SPLIT_LABELS, adjustDividendsByTicker, baseTicker, type StockSplitRow } from './lib/splits';
import { dividendYieldTTM } from './lib/dividends';
import { brtDateISO, isoMinusYears } from './lib/dates';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Service role client para tabelas com RLS restrito (ex: Qualitativo)
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null;

// --- Sector normalization (dedup English/Portuguese variants) ---
const SECTOR_NORMALIZE: Record<string, string> = {
  'Consumer Cyclical': 'Consumo Cíclico',
  'Industrials': 'Bens Industriais',
  'Real Estate': 'Construção e Imobiliário',
  'Utilities': 'Energia',
  'Materiais': 'Materiais Básicos',
  'Fundos Imobiliários': '',  // não é setor de ações
};

const normalizeSector = (s: string): string => {
  const trimmed = s.trim();
  return SECTOR_NORMALIZE[trimmed] ?? trimmed;
};

// --- Helpers ---

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const toStr = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value);
};

const norm = (row: Record<string, any>): Record<string, any> => {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v;
    out[k.toLowerCase()] = v;
  }
  return out;
};

const pick = (row: Record<string, any>, keys: string[]): unknown => {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null) return row[k];
  }
  return undefined;
};

// O short_name da brapi às vezes vem igual ao ticker ("IGTI11"): aí o long_name serve melhor.
const bestName = (short: unknown, long: unknown): string => {
  const s = String(short || '').trim();
  const l = String(long || '').trim();
  return s && !/^[A-Z0-9]{4}\d{1,2}$/i.test(s.replace(/\s/g, '')) ? s : (l || s);
};

const normSym = (v: unknown): string => {
  if (v == null) return '';
  return String(v).trim().toUpperCase();
};

// --- Mappers ---

const mapIncome = (row: Record<string, any>): RawIncomeStatement => {
  const r = norm(row);
  return {
    symbol: normSym(pick(r, ['symbol', 'ticker'])),
    type: toStr(pick(r, ['type', 'statement_type', 'report_type'])),
    period: toStr(pick(r, ['period', 'fiscal_period', 'fiscal_year', 'year'])),
    end_date: toStr(pick(r, ['end_date', 'period_end_date', 'date', 'report_date'])),
    total_revenue: toNumber(pick(r, ['total_revenue', 'revenue', 'totalrevenue'])),
    ebit: toNumber(pick(r, ['ebit', 'operating_income', 'operatingincome'])),
    net_income: toNumber(pick(r, ['net_income', 'netincome'])),
    interest_expense: toNumber(pick(r, ['interest_expense', 'interestexpense'])),
    income_tax_expense: toNumber(pick(r, ['income_tax_expense', 'incometaxexpense'])),
    income_before_tax: toNumber(pick(r, ['income_before_tax', 'incomebeforetax'])),
    gross_profit: toNumber(pick(r, ['gross_profit', 'grossprofit']))
  };
};

const mapBalance = (row: Record<string, any>): RawBalanceSheet => {
  const r = norm(row);
  return {
    symbol: normSym(pick(r, ['symbol', 'ticker'])),
    type: toStr(pick(r, ['type', 'statement_type'])),
    period: toStr(pick(r, ['period', 'fiscal_period', 'fiscal_year'])),
    end_date: toStr(pick(r, ['end_date', 'period_end_date', 'date'])),
    total_assets: toNumber(pick(r, ['total_assets', 'totalassets'])),
    total_liab: toNumber(pick(r, ['total_liab', 'totalliab', 'total_liabilities'])),
    cash: toNumber(pick(r, ['cash', 'cash_and_cash_equivalents'])),
    short_term_investments: toNumber(pick(r, ['short_term_investments'])),
    long_term_debt: toNumber(pick(r, ['long_term_debt', 'longtermdebt'])),
    short_long_term_debt: toNumber(pick(r, ['short_long_term_debt', 'shortterm_debt'])),
    total_current_assets: toNumber(pick(r, ['total_current_assets'])),
    total_current_liabilities: toNumber(pick(r, ['total_current_liabilities'])),
    total_stockholder_equity: toNumber(pick(r, ['total_stockholder_equity', 'total_stockholders_equity', 'total_equity']))
  };
};

const mapCashFlow = (row: Record<string, any>): RawCashFlow => {
  const r = norm(row);
  return {
    symbol: normSym(pick(r, ['symbol', 'ticker'])),
    type: toStr(pick(r, ['type', 'statement_type'])),
    period: toStr(pick(r, ['period', 'fiscal_period', 'fiscal_year'])),
    end_date: toStr(pick(r, ['end_date', 'period_end_date', 'date'])),
    total_cash_from_operating_activities: toNumber(pick(r, ['total_cash_from_operating_activities'])),
    total_cashflows_from_investing_activities: toNumber(pick(r, ['total_cashflows_from_investing_activities'])),
    total_cash_from_financing_activities: toNumber(pick(r, ['total_cash_from_financing_activities'])),
    capital_expenditures: toNumber(pick(r, ['capital_expenditures', 'capex'])),
    depreciation: toNumber(pick(r, ['depreciation', 'depreciation_amortization'])),
    dividends_paid: toNumber(pick(r, ['dividends_paid', 'dividends']))
  };
};

const mapBrapi = (row: Record<string, any>): RawBrapiQuote => {
  const r = norm(row);
  return {
    symbol: normSym(pick(r, ['symbol', 'ticker'])),
    shortName: toStr(pick(r, ['short_name', 'shortname', 'name'])),
    longName: toStr(pick(r, ['long_name', 'longname', 'name'])),
    regularMarketPrice: toNumber(pick(r, ['price', 'regular_market_price', 'regularmarketprice'])),
    marketCap: toNumber(pick(r, ['market_cap', 'marketcap'])),
    sharesOutstanding: toNumber(pick(r, ['shares_outstanding', 'sharesoutstanding'])),
    priceEarnings: toNumber(pick(r, ['price_earnings', 'pl', 'priceearnings'])),
    earningsPerShare: toNumber(pick(r, ['earnings_per_share', 'lpa', 'earningspershare'])),
    bookValue: toNumber(pick(r, ['book_value', 'vpa', 'bookvalue'])),
    dividendYield: toNumber(pick(r, ['dividend_yield', 'dividendyield'])),
    enterpriseToEbitda: toNumber(pick(r, ['enterprise_to_ebitda'])),
    regularMarketTime: toStr(pick(r, ['regular_market_time', 'updated_at'])),
    marketTime: toStr(pick(r, ['regular_market_time'])),
    fiftyTwoWeekLow: toNumber(pick(r, ['fifty_two_week_low'])),
    fiftyTwoWeekHigh: toNumber(pick(r, ['fifty_two_week_high'])),
    averageDailyVolume3Month: toNumber(pick(r, ['average_daily_volume_3_month', 'adtv', 'regular_market_volume'])),
    regularMarketChangePercent: toNumber(pick(r, ['regular_market_change_percent'])),
    fiftyTwoWeekChange: toNumber(pick(r, ['fifty_two_week_change'])),
    enterpriseValue: toNumber(pick(r, ['enterprise_value'])),
    priceToBook: toNumber(pick(r, ['price_to_book', 'pvp'])),
    priceToSalesTrailing12Months: toNumber(pick(r, ['price_to_sales_ttm'])),
    sector: normalizeSector(toStr(pick(r, ['sector']))),
    industry: toStr(pick(r, ['industry', 'sub_sector'])),
    longBusinessSummary: toStr(pick(r, ['long_business_summary_ptbr', 'long_business_summary'])),
    pl: toNumber(pick(r, ['pl'])),
    pvp: toNumber(pick(r, ['pvp'])),
    lpa: toNumber(pick(r, ['lpa'])),
    vpa: toNumber(pick(r, ['vpa'])),
    roe: toNumber(pick(r, ['roe'])),
    roic: toNumber(pick(r, ['roic'])),
    net_margin: toNumber(pick(r, ['net_margin'])),
    ebitda_margin: toNumber(pick(r, ['ebitda_margin'])),
    debt_ebitda: toNumber(pick(r, ['debt_ebitda'])),
    liquidity_ratio: toNumber(pick(r, ['liquidity_ratio'])),
    ev_ebit: toNumber(pick(r, ['ev_ebit'])),
    beta5y: toNumber(pick(r, ['beta_5y', 'beta5y'])),
    revenueGrowth: toNumber(pick(r, ['revenue_growth'])),
    logoUrl: toStr(pick(r, ['logo_url', 'logourl'])),
    website: toStr(pick(r, ['website'])),
    employees: toNumber(pick(r, ['full_time_employees'])),
    city: toStr(pick(r, ['city'])),
    state: toStr(pick(r, ['state'])),
    weekChange: toNumber(pick(r, ['week_change'])),
    monthChange: toNumber(pick(r, ['month_change'])),
    sixMonthChange: toNumber(pick(r, ['six_month_change'])),
    ytdReturn: toNumber(pick(r, ['ytd_return'])),
    dividendYield5y: toNumber(pick(r, ['dividend_yield_5y']))
  };
};

const mapDividend = (row: Record<string, any>): RawDividend => {
  const r = norm(row);
  return {
    symbol: normSym(pick(r, ['ticker', 'symbol'])),
    amount: toNumber(pick(r, ['amount', 'value', 'dividend'])),
    exDate: toStr(pick(r, ['ex_date', 'exdate'])),
    paymentDate: toStr(pick(r, ['payment_date', 'paymentdate'])),
    dividendType: toStr(pick(r, ['dividend_type', 'dividendtype', 'type'])),
    currency: toStr(pick(r, ['currency'])) || 'BRL'
  };
};

// --- Documentos da CVM (tabela public.cvm_documents) ---

// Siglas da CVM/RAD -> rótulo em português. Documento com sigla fora deste mapa é
// descartado: a regra é nunca exibir a sigla crua na página.
const CVM_DOC_LABELS: Record<string, string> = {
  FR: 'Fato Relevante',
  CM: 'Comunicado ao Mercado',
  ITR: 'Informações Trimestrais',
  DFP: 'Demonstrações Financeiras Padronizadas',
  FRE: 'Formulário de Referência',
  VLMO: 'Negociação de Valores Mobiliários',
  PR: 'Divulgação de Resultados',
};

// Quantos documentos entram no bloco da página de ticker.
export const CVM_DOC_LIMIT = 4;

// Linhas lidas por consulta antes de deduplicar (o feed repete o mesmo `link`
// com títulos diferentes; 40 dá folga para sobrar CVM_DOC_LIMIT depois).
const CVM_FETCH_ROWS = 150;
// Quantos documentos deduplicados ficam no cache por ticker: a página de ticker usa os 4
// primeiros; /airton/{TICKER}/ usa até 5 e conta os últimos 90 dias.
export const CVM_CACHE_LIMIT = 30;

// `summary` vem no formato "<Tipo> - <título> - Date YYYY-MM-DD"
// (algumas linhas usam "Data" em vez de "Date", e o título pode ser vazio: "- - -").
const CVM_DATE_SUFFIX = /\s*-\s*Dat[ae]\s*\d{4}-\d{2}-\d{2}\s*$/i;

// `ai_summary` é texto gerado com markdown leve (**negrito**, ##, quebras de linha).
const cleanCvmText = (raw: string): string =>
  raw
    .replace(/\*\*/g, '')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/[`_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    // preâmbulo de persona do LLM ("Como analista financeiro, apresento abaixo...") não é informação
    .replace(/^(como|na qualidade de|enquanto)\s+analista[^.:]*[.:]\s*/i, '');

const cvmTitleFromSummary = (summary: string): string => {
  let s = summary.replace(CVM_DATE_SUFFIX, '').trim();
  const sep = s.indexOf(' - ');
  if (sep >= 0) s = s.slice(sep + 3);
  s = s.replace(/^[\s-]+/, '').replace(/[\s-]+$/, '');
  return cleanCvmText(s);
};

const mapCvmDocument = (row: Record<string, any>): CvmDocument | null => {
  const r = norm(row);

  const docType = toStr(pick(r, ['doc_type', 'doctype'])).trim().toUpperCase();
  const docTypeLabel = CVM_DOC_LABELS[docType];
  if (!docTypeLabel) return null;

  const link = toStr(pick(r, ['link'])).trim();
  if (!/^https?:\/\//i.test(link)) return null;

  const date = toStr(pick(r, ['date'])).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  let title = cvmTitleFromSummary(toStr(pick(r, ['summary'])));
  // Algumas linhas trazem a própria sigla como título ("ITR - ITR - Date ..."):
  // não vale como informação e a sigla crua não pode aparecer na página.
  if (title.toUpperCase() === docType || title.toLowerCase() === docTypeLabel.toLowerCase()) title = '';

  const excerpt = cleanCvmText(toStr(pick(r, ['ai_summary'])));
  if (!title && !excerpt) return null;

  return { docType, docTypeLabel, title, date, excerpt, link };
};

/**
 * Últimos documentos que a companhia publicou na CVM, mais recentes primeiro.
 *
 * Tolerante a falha por contrato: qualquer erro (tabela ausente, RLS, rede) devolve
 * `[]` e a geração da página segue — o bloco simplesmente não é renderizado.
 *
 * Cobertura: `cvm_documents` guarda um ticker por emissor (ex.: PETR4, não PETR3).
 * Se o ticker exato não tiver linhas, cai para a raiz de 4 letras do código B3, que
 * identifica o mesmo emissor — documento da CVM é da companhia, não da classe de ação.
 */
export const fetchCvmDocuments = async (ticker: string, limit = CVM_DOC_LIMIT): Promise<CvmDocument[]> => {
  const t = normSym(ticker);
  if (!t) return [];
  const today = new Date().toISOString().slice(0, 10);

  const run = async (apply: (q: any) => any): Promise<Record<string, any>[]> => {
    try {
      const { data, error } = await apply(
        supabase
          .from('cvm_documents')
          .select('ticker,doc_type,date,summary,ai_summary,link')
          .lte('date', today)          // há linhas com data no futuro no feed
          .not('date', 'is', null)
          .order('date', { ascending: false })
          .limit(CVM_FETCH_ROWS)
      );
      if (error) { console.warn(`  ⚠ ${t}: cvm_documents — ${error.message}`); return []; }
      return data || [];
    } catch (e: any) {
      console.warn(`  ⚠ ${t}: cvm_documents — ${e?.message || e}`);
      return [];
    }
  };

  let rows = await run(q => q.eq('ticker', t));
  if (!rows.length) {
    const root = /^[A-Z]{4}/.exec(t)?.[0];
    if (root) rows = await run(q => q.like('ticker', `${root}%`));
  }

  const seen = new Set<string>();
  const docs: CvmDocument[] = [];
  for (const row of rows) {
    const doc = mapCvmDocument(row);
    if (!doc) continue;
    if (seen.has(doc.link)) continue;   // o feed repete o mesmo link com títulos diferentes
    seen.add(doc.link);
    docs.push(doc);
    if (docs.length >= limit) break;
  }
  return docs;
};

// Cache preenchido por `fetchFinancials` (uma chamada por ticker no pipeline) e lido
// de forma síncrona pelo template, que não pode fazer I/O.
const cvmDocsCache = new Map<string, CvmDocument[]>();

export const getCvmDocuments = (ticker: string, limit = CVM_DOC_LIMIT): CvmDocument[] =>
  (cvmDocsCache.get(normSym(ticker)) || []).slice(0, limit);

// --- Ticker candidates ---

const buildCandidates = (ticker: string): string[] => {
  const base = ticker.trim();
  const clean = base.toUpperCase().endsWith('.SA') ? base.slice(0, -3) : base;
  const set = new Set<string>();
  [base, clean].forEach(v => {
    set.add(v);
    set.add(v.toUpperCase());
    set.add(v.toLowerCase());
    if (!v.toUpperCase().endsWith('.SA')) {
      set.add(`${v}.SA`);
      set.add(`${v.toUpperCase()}.SA`);
    }
  });
  return Array.from(set);
};

// --- Query helpers ---

const queryByTicker = async (table: string, ticker: string): Promise<Record<string, any>[]> => {
  const candidates = buildCandidates(ticker);
  for (const col of ['symbol', 'ticker']) {
    for (const val of candidates) {
      const { data, error } = await supabase.from(table).select('*').eq(col, val);
      if (error) {
        if (error.code === '42703') break; // column doesn't exist
        continue;
      }
      if (data && data.length > 0) return data;
    }
  }
  return [];
};

// Segunda tentativa para erro de rede/PostgREST antes de desistir. Coluna inexistente
// (42703) é resposta, não falha: não repete.
const withRetry = async <R extends { error: { code?: string } | null }>(run: () => PromiseLike<R>): Promise<R> => {
  const first = await run();
  if (!first.error || first.error.code === '42703') return first;
  await new Promise(r => setTimeout(r, 500));
  return run();
};

// O PostgREST deste projeto devolve no máximo 1000 linhas por consulta, sem avisar.
const PAGE_ROWS = 1000;

/**
 * Todas as linhas de `brapi_dividends` com `col = val`, em páginas ordenadas por `id`. Sem
 * paginar, o corte de 1000 linhas descartava proventos sem aviso (e, sem ordem, quaisquer
 * deles). A fonte regrava o histórico em lotes de duplicatas: em out/2026 ITUB3 já tinha 821
 * linhas, ITUB4 818 e BBDC3 787.
 */
const fetchDividendPages = async (col: string, val: string) => {
  const rows: Record<string, any>[] = [];
  for (let offset = 0; ; offset += PAGE_ROWS) {
    const { data, error } = await withRetry(() =>
      supabase.from('brapi_dividends').select('*').eq(col, val).order('id').range(offset, offset + PAGE_ROWS - 1)
    );
    if (error) return { rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_ROWS) return { rows, error: null };
  }
};

/**
 * Proventos do papel: mesma busca por coluna e variante do ticker de `fetchTable`, mas erro
 * de consulta LANÇA. Antes o erro virava "sem proventos": a página afirmava que a empresa não
 * pagou nada em 12 meses e o Bazin sumia. Com o erro, a página de ontem continua no ar, como
 * acontece com qualquer ticker que falha no lote.
 */
const fetchDividendRows = async (candidates: string[]): Promise<Record<string, any>[]> => {
  for (const col of ['symbol', 'ticker']) {
    for (const val of candidates) {
      const { rows, error } = await fetchDividendPages(col, val);
      if (error) {
        if (error.code === '42703') break; // a coluna não existe nesta tabela
        throw new Error(`brapi_dividends: ${error.message}`);
      }
      if (rows.length > 0) return rows;
    }
  }
  return [];
};

/**
 * Desdobramentos, grupamentos e bonificações dos tickers pedidos, sem corte de data: um
 * desdobramento de hoje reescala o provento de 10 anos atrás. O filtro de rótulo vai no SQL
 * e é repetido no ajuste (scripts/lib/splits.ts).
 *
 * Erro LANÇA: degradar para "sem eventos" traria de volta o DY 5× com cara de dado bom.
 */
export const fetchStockSplits = async (tickers: string[]): Promise<StockSplitRow[]> => {
  const list = [...new Set(tickers.map(baseTicker).filter(Boolean))];
  if (!list.length) return [];
  const { data, error } = await withRetry(() =>
    supabase.from('brapi_stock_splits').select('ticker,ex_date,factor,label').in('ticker', list).in('label', [...SHARE_BASE_SPLIT_LABELS])
  );
  if (error) throw new Error(`brapi_stock_splits: ${error.message}`);
  return data ?? [];
};

// --- Main fetch ---

export const fetchFinancials = async (ticker: string): Promise<SupabaseFinancials | null> => {
  const t = ticker.toUpperCase().trim();

  const brapiRows = await queryByTicker('brapi_quotes', t);
  const brapi = brapiRows.map(mapBrapi).filter(r => r.symbol);
  brapi.sort((a, b) => {
    const ta = a.regularMarketTime ? new Date(a.regularMarketTime).getTime() : 0;
    const tb = b.regularMarketTime ? new Date(b.regularMarketTime).getTime() : 0;
    return tb - ta;
  });

  if (!brapi.length) return null;

  const sym = brapi[0].symbol || t;
  const candidates = Array.from(new Set([...buildCandidates(sym), ...buildCandidates(t)]));

  const fetchTable = async (table: string): Promise<Record<string, any>[]> => {
    for (const col of ['symbol', 'ticker']) {
      for (const val of candidates) {
        const { data, error } = await supabase.from(table).select('*').eq(col, val);
        if (error) { if (error.code === '42703') break; continue; }
        if (data && data.length > 0) return data;
      }
    }
    return [];
  };

  const [incomeRows, balanceRows, cashFlowRows, dividendRows, splitRows, cvmDocs] = await Promise.all([
    fetchTable('brapi_income_statements'),
    fetchTable('brapi_balance_sheets'),
    fetchTable('brapi_cashflows'),
    fetchDividendRows(candidates),
    fetchStockSplits([sym, t]),
    fetchCvmDocuments(sym, CVM_CACHE_LIMIT)
  ]);

  cvmDocsCache.set(normSym(sym), cvmDocs);
  if (normSym(t) !== normSym(sym)) cvmDocsCache.set(normSym(t), cvmDocs);

  const income = incomeRows.map(mapIncome).filter(r => r.symbol);
  const balance = balanceRows.map(mapBalance).filter(r => r.symbol);
  const cashFlow = cashFlowRows.map(mapCashFlow).filter(r => r.symbol);
  // Proventos na base acionária de hoje: divididos pelos desdobramentos/grupamentos/bonificações
  // com data-com no dia ou depois (scripts/lib/splits.ts). Daqui em diante todo consumidor —
  // DY, Bazin, Gordon, tabelas de proventos e valuations.json — recebe o valor ajustado.
  const dividends = adjustDividendsByTicker(dividendRows.map(mapDividend).filter(r => r.amount > 0 || r.symbol), splitRows, sym);

  if (!income.length && !balance.length && !cashFlow.length) return null;

  return { income, balance, cashFlow, brapi, dividends, cvmDocs };
};

// --- Get all active tickers ---

export const getAllTickers = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from('brapi_quotes')
    .select('symbol')
    .or('market_cap.gt.0,price.gt.0')
    .order('market_cap', { ascending: false });

  if (error || !data) return [];
  return data.map((r: any) => String(r.symbol).toUpperCase()).filter(Boolean);
};

export const getTickersWithNames = async (): Promise<{ ticker: string; name: string }[]> => {
  const { data, error } = await supabase
    .from('brapi_quotes')
    .select('symbol, short_name, long_name')
    .or('market_cap.gt.0,price.gt.0')
    .order('market_cap', { ascending: false });

  if (error || !data) return [];
  return data.map((r: any) => ({
    ticker: String(r.symbol).toUpperCase(),
    name: bestName(r.short_name, r.long_name)
  })).filter(t => t.ticker);
};

/**
 * Folga antes da janela de 12 meses na leitura dos proventos da lista. A deduplicação compara
 * linhas com data-com a até 3 dias (e encadeia), então a linha logo antes da janela decide se
 * a de dentro é cópia; 31 dias cobrem com sobra o que a página de ticker vê no histórico inteiro.
 */
const INDEX_DY_MARGIN_DAYS = 31;

const isoMinusDays = (iso: string, days: number): string =>
  new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) - days)).toISOString().slice(0, 10);

/** Todas as páginas de uma consulta ordenada (o PostgREST corta em 1000 linhas sem avisar). */
const allPages = async (run: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: { message: string; code?: string } | null }>, what: string): Promise<Record<string, any>[]> => {
  const rows: Record<string, any>[] = [];
  for (let offset = 0; ; offset += PAGE_ROWS) {
    const { data, error } = await withRetry(() => run(offset, offset + PAGE_ROWS - 1));
    if (error) throw new Error(`${what}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_ROWS) return rows;
  }
};

/**
 * DY da lista (/acoes/, setores, pares e mediana do setor nas páginas de ticker) com a MESMA
 * régua do DY da página de ticker (`dividendYieldTTM`: renda sem duplicatas, data-com em
 * (hoje − 12 meses, hoje], na base acionária de hoje, ÷ cotação). Antes (como
 * `adjustIndexYieldsForSplits`) só corrigia o desdobramento e o resto ficava com o
 * `dividend_yield` do banco, que soma as duplicatas da fonte: quem chegava pela lista ou pelo
 * ranking via BPAC11 com 1,84% e o topo da página com 3,69%.
 *
 * Três leituras: os eventos de base (todos — a regra de evento repetido olha os vizinhos), os
 * proventos com data-com desde 12 meses + 31 dias atrás (cerca de 1.900 linhas em out/2026,
 * em ordem de id como a página) e, só para quem não tem linha na janela e tem DY no banco, se
 * há algum provento na base. Papel sem nenhum provento na base fica com o DY do banco, como na
 * página. Falha aqui não derruba o build: a lista fica com o DY do banco (o que já está no ar)
 * e o log do CI ganha um ::warning::.
 */
const adjustIndexYields = async (entries: TickerIndexEntry[], now = new Date()): Promise<void> => {
  const today = brtDateISO(now);
  const since = isoMinusDays(isoMinusYears(today, 1), INDEX_DY_MARGIN_DAYS);
  try {
    const splitRows: StockSplitRow[] = await allPages((a, b) =>
      supabase.from('brapi_stock_splits').select('ticker,ex_date,factor,label').in('label', [...SHARE_BASE_SPLIT_LABELS])
        .order('ticker').order('ex_date').order('label').range(a, b), 'brapi_stock_splits');
    const divRows = await allPages((a, b) =>
      supabase.from('brapi_dividends').select('id,ticker,ex_date,payment_date,amount,dividend_type')
        .gte('ex_date', since).order('id').range(a, b), 'brapi_dividends');

    const divsByTicker = new Map<string, Record<string, any>[]>();
    for (const r of divRows) {
      const t = baseTicker(r.ticker);
      const list = divsByTicker.get(t);
      if (list) list.push(r); else divsByTicker.set(t, [r]);
    }
    const splitsByTicker = new Map<string, StockSplitRow[]>();
    for (const r of splitRows) {
      const t = baseTicker(r.ticker);
      const list = splitsByTicker.get(t);
      if (list) list.push(r); else splitsByTicker.set(t, [r]);
    }

    // Calcula tudo antes de trocar: com erro no meio, a lista inteira fica com o DY do banco.
    const next = new Map<TickerIndexEntry, number>();
    for (const entry of entries) {
      const rows = (divsByTicker.get(entry.ticker) ?? []).filter(r => toNumber(r.amount) > 0);
      if (rows.length) {
        const divs = adjustDividendsByTicker(rows.map(mapDividend), splitsByTicker.get(entry.ticker) ?? [], entry.ticker, today);
        next.set(entry, dividendYieldTTM(divs, entry.price, entry.divYield, today));
        continue;
      }
      // Nada na janela: com algum provento na base, a página mostra 0 (nada em 12 meses); sem
      // nenhum, a página fica com o DY do banco. Só pergunta quando o banco tem DY.
      if (!(entry.divYield > 0)) continue;
      const { data, error } = await withRetry(() =>
        supabase.from('brapi_dividends').select('id').eq('ticker', entry.ticker).gt('amount', 0).limit(1)
      );
      if (error) throw new Error(`brapi_dividends: ${error.message}`);
      if (data && data.length) next.set(entry, 0);
    }
    for (const [entry, dy] of next) entry.divYield = dy;
  } catch (err: any) {
    console.warn(`::warning::DY da lista com o dividend_yield do banco (sem a régua da página): ${err?.message || err}`);
  }
};

export const getAllTickersWithSector = async (): Promise<TickerIndexEntry[]> => {
  const { data, error } = await supabase
    .from('brapi_quotes')
    .select('symbol, short_name, long_name, sector, price, regular_market_price, pl, dividend_yield, market_cap')
    .or('market_cap.gt.0,price.gt.0')
    .order('market_cap', { ascending: false });

  if (error || !data) { console.warn('getAllTickersWithSector error:', error?.message); return []; }
  const entries: TickerIndexEntry[] = data.map((r: any) => ({
    ticker: String(r.symbol).toUpperCase(),
    name: bestName(r.short_name, r.long_name),
    sector: normalizeSector(String(r.sector || '').trim()),
    price: toNumber(r.price) || toNumber(r.regular_market_price),
    pl: toNumber(r.pl),
    divYield: toNumber(r.dividend_yield),
    marketCap: toNumber(r.market_cap)
  })).filter((t: TickerIndexEntry) => t.ticker);
  await adjustIndexYields(entries);
  return entries;
};

// Nota qualitativa: o build não lê nem publica (é conteúdo da plataforma, exige login).
// O antigo scripts/qualitative-cache.json saiu do repositório em 07/10/2026.

export const getPeersBySector = (allTickers: TickerIndexEntry[], ticker: string, limit = 8): PeerTicker[] => {
  const current = allTickers.find(t => t.ticker === ticker);
  if (!current || !current.sector) return [];
  return allTickers
    .filter(t => t.ticker !== ticker && t.sector === current.sector && t.price > 0)
    .slice(0, limit)
    .map(t => ({ ticker: t.ticker, name: t.name, sector: t.sector, price: t.price }));
};
