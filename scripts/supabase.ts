import { createClient } from '@supabase/supabase-js';
import type {
  RawIncomeStatement, RawBalanceSheet, RawCashFlow,
  RawBrapiQuote, RawDividend, SupabaseFinancials,
  PeerTicker, TickerIndexEntry
} from './types';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
    fiftyTwoWeekLow: toNumber(pick(r, ['fifty_two_week_low'])),
    fiftyTwoWeekHigh: toNumber(pick(r, ['fifty_two_week_high'])),
    averageDailyVolume3Month: toNumber(pick(r, ['average_daily_volume_3_month', 'adtv', 'regular_market_volume'])),
    regularMarketChangePercent: toNumber(pick(r, ['regular_market_change_percent'])),
    fiftyTwoWeekChange: toNumber(pick(r, ['fifty_two_week_change'])),
    enterpriseValue: toNumber(pick(r, ['enterprise_value'])),
    priceToBook: toNumber(pick(r, ['price_to_book', 'pvp'])),
    priceToSalesTrailing12Months: toNumber(pick(r, ['price_to_sales_ttm'])),
    sector: toStr(pick(r, ['sector'])),
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
    revenueGrowth: toNumber(pick(r, ['revenue_growth']))
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

  const [incomeRows, balanceRows, cashFlowRows, dividendRows] = await Promise.all([
    fetchTable('brapi_income_statements'),
    fetchTable('brapi_balance_sheets'),
    fetchTable('brapi_cashflows'),
    fetchTable('brapi_dividends')
  ]);

  const income = incomeRows.map(mapIncome).filter(r => r.symbol);
  const balance = balanceRows.map(mapBalance).filter(r => r.symbol);
  const cashFlow = cashFlowRows.map(mapCashFlow).filter(r => r.symbol);
  const dividends = dividendRows.map(mapDividend).filter(r => r.amount > 0 || r.symbol);

  if (!income.length && !balance.length && !cashFlow.length) return null;

  return { income, balance, cashFlow, brapi, dividends };
};

// --- Get all active tickers ---

export const getAllTickers = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from('brapi_quotes')
    .select('symbol')
    .gt('market_cap', 0)
    .order('market_cap', { ascending: false });

  if (error || !data) return [];
  return data.map((r: any) => String(r.symbol).toUpperCase()).filter(Boolean);
};

export const getTickersWithNames = async (): Promise<{ ticker: string; name: string }[]> => {
  const { data, error } = await supabase
    .from('brapi_quotes')
    .select('symbol, short_name, long_name')
    .gt('market_cap', 0)
    .order('market_cap', { ascending: false });

  if (error || !data) return [];
  return data.map((r: any) => ({
    ticker: String(r.symbol).toUpperCase(),
    name: String(r.short_name || r.long_name || '').trim()
  })).filter(t => t.ticker);
};

export const getAllTickersWithSector = async (): Promise<TickerIndexEntry[]> => {
  const { data, error } = await supabase
    .from('brapi_quotes')
    .select('symbol, short_name, long_name, sector, price, regular_market_price, pl, dividend_yield, market_cap')
    .gt('market_cap', 0)
    .order('market_cap', { ascending: false });

  if (error || !data) { console.warn('getAllTickersWithSector error:', error?.message); return []; }
  return data.map((r: any) => ({
    ticker: String(r.symbol).toUpperCase(),
    name: String(r.short_name || r.long_name || '').trim(),
    sector: String(r.sector || '').trim(),
    price: toNumber(r.price) || toNumber(r.regular_market_price),
    pl: toNumber(r.pl),
    divYield: toNumber(r.dividend_yield),
    marketCap: toNumber(r.market_cap)
  })).filter(t => t.ticker);
};

export const getPeersBySector = (allTickers: TickerIndexEntry[], ticker: string, limit = 8): PeerTicker[] => {
  const current = allTickers.find(t => t.ticker === ticker);
  if (!current || !current.sector) return [];
  return allTickers
    .filter(t => t.ticker !== ticker && t.sector === current.sector && t.price > 0)
    .slice(0, limit)
    .map(t => ({ ticker: t.ticker, name: t.name, sector: t.sector, price: t.price }));
};
