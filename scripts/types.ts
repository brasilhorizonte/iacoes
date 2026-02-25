export enum ValuationMethodType {
  DCF = 'FDC',
  GORDON = 'GORDON',
  EVA = 'EVA/MVA',
  MULTIPLES = 'MULTIPLO',
  GRAHAM = 'GRAHAM'
}

export interface RawIncomeStatement {
  symbol: string;
  type?: string;
  period: string;
  end_date: string;
  total_revenue: number;
  ebit: number;
  net_income: number;
  interest_expense: number;
  income_tax_expense: number;
  income_before_tax: number;
  gross_profit?: number;
}

export interface RawBalanceSheet {
  symbol: string;
  type?: string;
  period: string;
  end_date: string;
  total_assets: number;
  total_liab: number;
  cash: number;
  short_term_investments: number;
  long_term_debt: number;
  short_long_term_debt: number;
  total_current_assets?: number;
  total_current_liabilities?: number;
  total_stockholder_equity: number;
}

export interface RawCashFlow {
  symbol: string;
  type?: string;
  period: string;
  end_date: string;
  total_cash_from_operating_activities: number;
  total_cashflows_from_investing_activities: number;
  total_cash_from_financing_activities: number;
  capital_expenditures: number;
  depreciation: number;
  dividends_paid: number;
}

export interface RawBrapiQuote {
  symbol: string;
  shortName: string;
  longName?: string;
  regularMarketPrice: number;
  marketCap: number;
  sharesOutstanding: number;
  priceEarnings: number;
  earningsPerShare: number;
  bookValue: number;
  dividendYield: number;
  enterpriseToEbitda: number;
  regularMarketTime?: string;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  averageDailyVolume3Month?: number;
  regularMarketChangePercent?: number;
  fiftyTwoWeekChange?: number;
  ytdReturn?: number;
  enterpriseValue?: number;
  priceToBook?: number;
  priceToSalesTrailing12Months?: number;
  profitMargins?: number;
  sector?: string;
  industry?: string;
  longBusinessSummary?: string;
  pl?: number;
  pvp?: number;
  lpa?: number;
  vpa?: number;
  roe?: number;
  roic?: number;
  net_margin?: number;
  ebitda_margin?: number;
  debt_ebitda?: number;
  liquidity_ratio?: number;
  ev_ebit?: number;
  beta5y?: number;
  revenueGrowth?: number;
}

export interface RawDividend {
  symbol: string;
  amount: number;
  exDate: string;
  paymentDate: string;
  dividendType: string;
  currency: string;
}

export interface FundamentalData {
  symbol: string;
  name: string;
  sector: string;
  subSector: string;
  type: string;
  price: number;
  date: string;
  min52Week: number;
  max52Week: number;
  volMed2m: number;
  marketCap: number;
  firmValue: number;
  lastBalanceDate: string;
  sharesOutstanding: number;
  changeDay: number;
  change12m: number;
  pl: number;
  pvp: number;
  pebit: number;
  psr: number;
  divYield: number;
  evEbitda: number;
  evEbit: number;
  lpa: number;
  vpa: number;
  grossMargin: number;
  ebitMargin: number;
  ebitdaMargin: number;
  netMargin: number;
  roic: number;
  roe: number;
  currentLiquidity: number;
  debtEquity: number;
  debtEbitda: number;
}

export interface FinancialData {
  ticker: string;
  price: number;
  currency: string;
  sharesOutstanding: number;
  beta: number;
  wacc: number;
  growthRate: number;
  roe: number;
  payoutRatio: number;
  revenue: number;
  ebit: number;
  netIncome: number;
  interestExpenses: number;
  taxRate: number;
  equity: number;
  debt: number;
  cashAndEquivalents: number;
  investedCapital: number;
  freeCashFlow: number;
  depreciation: number;
  volatility: number;
  sectorPE: number;
  sectorEVEBITDA: number;
  currentPE: number;
  currentEVEBITDA: number;
  currentEPS: number;
  _rawIncome: RawIncomeStatement[];
  _rawBalance: RawBalanceSheet[];
  _rawCashFlow: RawCashFlow[];
  _rawDividends: RawDividend[];
  fundamentals: FundamentalData;
  businessSummary?: string | null;
}

export interface ValuationAssumptions {
  riskFreeRate: number;
  equityRiskPremium: number;
  beta: number;
  costOfDebt: number;
  taxRate: number;
  perpetualGrowth: number;
  projectedRevenueGrowth: number;
}

export interface CalculationTrace {
  formula: string;
  inputs: Record<string, string>;
  steps: string[];
  finalResult: number;
}

export interface ValuationResult {
  method: ValuationMethodType;
  fairValue: number;
  weight: number;
  upside: number;
  details: string;
  trace: CalculationTrace;
}

export interface SensitivityCell {
  wacc: number;
  growth: number;
  fairValue: number;
}

export interface ComprehensiveValuation {
  ticker: string;
  currentPrice: number;
  weightedFairValue: number;
  totalUpside: number;
  results: ValuationResult[];
  calculatedWacc: number;
  priceRange: { min: number; max: number };
  sensitivityMatrix: SensitivityCell[][];
}

export interface ValuationWeights {
  DCF: number;
  GORDON: number;
  EVA: number;
  MULTIPLES: number;
  GRAHAM: number;
}

export interface SupabaseFinancials {
  income: RawIncomeStatement[];
  balance: RawBalanceSheet[];
  cashFlow: RawCashFlow[];
  brapi: RawBrapiQuote[];
  dividends: RawDividend[];
}
