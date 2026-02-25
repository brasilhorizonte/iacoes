import type {
  FinancialData, ValuationMethodType as VMT, ValuationResult,
  ComprehensiveValuation, ValuationAssumptions, CalculationTrace,
  SensitivityCell, ValuationWeights, FundamentalData, SupabaseFinancials
} from './types';
import { ValuationMethodType } from './types';
import { DEFAULT_WEIGHTS, SCENARIO_PRESETS, DEFAULT_COST_OF_DEBT } from './constants';
import { fetchFinancials } from './supabase';

// --- Helpers ---

const filterByTicker = <T extends { symbol: string }>(data: T[], ticker: string): T[] => {
  const exact = data.filter(d => d.symbol.toUpperCase() === ticker.toUpperCase());
  if (exact.length > 0) return exact;
  const root = ticker.toUpperCase().replace(/[0-9F]+$/, '');
  return data.filter(d => d.symbol.toUpperCase().startsWith(root));
};

const getLatest = <T extends { end_date: string }>(data: T[]): T | null => {
  if (!data.length) return null;
  return data.sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())[0];
};

const classifyPeriod = (period: string): 'quarterly' | 'yearly' => {
  if (!period) return 'quarterly';
  if (period.toUpperCase().startsWith('FY') || period.length === 4) return 'yearly';
  return 'quarterly';
};

const normalizeType = (rawType?: string, period?: string): 'quarterly' | 'yearly' => {
  const n = (rawType ?? '').toLowerCase();
  if (['yearly', 'annual', 'anual', 'fy'].includes(n)) return 'yearly';
  if (['quarterly', 'quarter'].includes(n) || n.startsWith('q')) return 'quarterly';
  return classifyPeriod(period || rawType || '');
};

const normPercent = (v?: number | null): number | null => {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.abs(n) > 2 ? n / 100 : n;
};

const pickPos = (v?: number | null): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const getTypeFromTicker = (t: string): string => {
  if (t.endsWith('11')) return 'UNT';
  if (t.endsWith('4')) return 'PN';
  if (t.endsWith('3')) return 'ON';
  return 'ON';
};

// --- Main: get financial data ---

export const getFinancialData = async (ticker: string): Promise<FinancialData> => {
  const t = ticker.toUpperCase().trim().replace(/\.SA$/, '');
  const supa = await fetchFinancials(t);
  if (!supa) throw new Error(`Sem dados para ${t}`);

  const { income: rawIncome, balance: rawBalance, cashFlow: rawCashFlow, brapi: rawBrapi, dividends: rawDividends } = supa;

  const tickerIncome = filterByTicker(rawIncome, t);
  const tickerBalance = filterByTicker(rawBalance, t);
  const tickerCashFlow = filterByTicker(rawCashFlow, t);
  const tickerBrapi = rawBrapi.find(b => b.symbol === t) || rawBrapi.find(b => b.symbol.startsWith(t.replace(/[0-9F]+$/, '')));

  if (!tickerBrapi || !tickerIncome.length || !tickerBalance.length || !tickerCashFlow.length) {
    const missing: string[] = [];
    if (!tickerBrapi) missing.push('cotação');
    if (!tickerIncome.length) missing.push('DRE');
    if (!tickerBalance.length) missing.push('balanço');
    if (!tickerCashFlow.length) missing.push('fluxo de caixa');
    throw new Error(`Dados incompletos para ${t} (faltando: ${missing.join(', ')})`);
  }

  const betaFromBrapi = pickPos(tickerBrapi.beta5y);
  const revGrowth = normPercent(tickerBrapi.revenueGrowth);
  const defaultBeta = betaFromBrapi ?? SCENARIO_PRESETS.BASE.beta;
  const defaultRevGrowth = revGrowth ?? SCENARIO_PRESETS.BASE.projectedRevenueGrowth;

  const yearlyIncome = tickerIncome.filter(d => classifyPeriod(d.period) === 'yearly').sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime());
  const yearlyCF = tickerCashFlow.filter(d => classifyPeriod(d.period) === 'yearly').sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime());
  const yearlyBal = tickerBalance.filter(d => classifyPeriod(d.period) === 'yearly').sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime());

  const baseIncome = yearlyIncome[0] || getLatest(tickerIncome);
  const baseDate = baseIncome?.end_date;
  const baseBalance = yearlyBal.find(b => b.end_date === baseDate) || getLatest(tickerBalance);
  const baseCF = yearlyCF.find(c => c.end_date === baseDate) || getLatest(tickerCashFlow);

  const price = tickerBrapi.regularMarketPrice || 10;
  const mCap = tickerBrapi.marketCap || 0;
  let shares = mCap > 0 && price > 0 ? mCap / price : tickerBrapi.sharesOutstanding || 0;
  if (!shares && baseIncome?.net_income && tickerBrapi.earningsPerShare) shares = baseIncome.net_income / tickerBrapi.earningsPerShare;
  if (!shares) shares = 1_000_000;

  const grossDebt = (baseBalance?.long_term_debt || 0) + (baseBalance?.short_long_term_debt || 0);
  const cash = (baseBalance?.cash || 0) + (baseBalance?.short_term_investments || 0);
  const netDebt = grossDebt - cash;
  const depreciation = baseCF?.depreciation || 0;
  const ebit = baseIncome?.ebit || 0;
  const ebitda = ebit + depreciation;
  const equity = baseBalance?.total_stockholder_equity || (tickerBrapi.bookValue ? tickerBrapi.bookValue * shares : 0);
  const investedCapital = equity + netDebt;
  const totalAssets = baseBalance?.total_assets || 1;
  const ocf = baseCF?.total_cash_from_operating_activities || 0;
  const capex = baseCF?.capital_expenditures || 0;
  const freeCashFlow = ocf + capex;
  const netIncome = baseIncome?.net_income || 0;
  const revenue = baseIncome?.total_revenue || 0;

  const pl = tickerBrapi.pl || tickerBrapi.priceEarnings || (netIncome > 0 ? mCap / netIncome : 0);
  const pvp = tickerBrapi.pvp || tickerBrapi.priceToBook || (equity > 0 ? mCap / equity : 0);
  const lpa = tickerBrapi.lpa || tickerBrapi.earningsPerShare || (netIncome / shares);
  const vpa = tickerBrapi.vpa || tickerBrapi.bookValue || (equity / shares);
  const roe = tickerBrapi.roe ? tickerBrapi.roe / 100 : (equity > 0 ? netIncome / equity : 0);
  const roic = tickerBrapi.roic ? tickerBrapi.roic / 100 : ((equity + netDebt) > 0 ? (ebit * 0.66) / (equity + netDebt) : 0);
  const netMargin = tickerBrapi.net_margin ? tickerBrapi.net_margin / 100 : (revenue > 0 ? netIncome / revenue : 0);
  const ebitdaMargin = tickerBrapi.ebitda_margin ? tickerBrapi.ebitda_margin / 100 : (revenue > 0 ? ebitda / revenue : 0);
  const evEbitda = tickerBrapi.enterpriseToEbitda || (ebitda > 0 ? (mCap + netDebt) / ebitda : 0);
  const evEbit = tickerBrapi.ev_ebit || (ebit > 0 ? (mCap + netDebt) / ebit : 0);
  const debtEbitda = tickerBrapi.debt_ebitda || (ebitda > 0 ? netDebt / ebitda : 0);
  const changeDay = tickerBrapi.regularMarketChangePercent ? tickerBrapi.regularMarketChangePercent / 100 : 0;
  const change12m = tickerBrapi.fiftyTwoWeekChange ? tickerBrapi.fiftyTwoWeekChange / 100 : 0;
  const currentAssets = baseBalance?.total_current_assets || 0;
  const currentLiab = baseBalance?.total_current_liabilities || 0;

  const fundamentals: FundamentalData = {
    symbol: t,
    name: tickerBrapi.longName || tickerBrapi.shortName || t,
    sector: tickerBrapi.sector || '-',
    subSector: tickerBrapi.industry || '-',
    type: getTypeFromTicker(t),
    price, date: new Date().toLocaleDateString('pt-BR'),
    min52Week: tickerBrapi.fiftyTwoWeekLow || 0,
    max52Week: tickerBrapi.fiftyTwoWeekHigh || 0,
    volMed2m: tickerBrapi.averageDailyVolume3Month || 0,
    marketCap: mCap,
    firmValue: tickerBrapi.enterpriseValue || (mCap + netDebt),
    lastBalanceDate: baseDate ? new Date(baseDate).toLocaleDateString('pt-BR') : '-',
    sharesOutstanding: shares,
    changeDay, change12m,
    pl, pvp,
    pebit: ebit > 0 ? mCap / ebit : 0,
    psr: revenue > 0 ? mCap / revenue : 0,
    divYield: tickerBrapi.dividendYield || 0,
    evEbitda, evEbit, lpa, vpa,
    grossMargin: revenue > 0 ? (baseIncome?.gross_profit || 0) / revenue : 0,
    ebitMargin: revenue > 0 ? ebit / revenue : 0,
    ebitdaMargin, netMargin, roic, roe,
    currentLiquidity: currentLiab > 0 ? currentAssets / currentLiab : 0,
    debtEquity: equity > 0 ? grossDebt / equity : 0,
    debtEbitda
  };

  return {
    ticker: t, price, currency: 'BRL', sharesOutstanding: shares,
    beta: defaultBeta, wacc: 0.12, growthRate: defaultRevGrowth,
    roe, payoutRatio: 0.25,
    revenue, ebit, netIncome,
    interestExpenses: Math.abs(baseIncome?.interest_expense || 0),
    taxRate: 0.34, equity, debt: grossDebt, cashAndEquivalents: cash,
    investedCapital, freeCashFlow, depreciation,
    volatility: 0.30, sectorPE: 8.0, sectorEVEBITDA: 6.0,
    currentPE: pl, currentEVEBITDA: evEbitda, currentEPS: lpa,
    _rawIncome: tickerIncome.map(i => ({ ...i, type: normalizeType(i.type, i.period) })),
    _rawBalance: tickerBalance.map(b => ({ ...b, type: normalizeType(b.type, b.period) })),
    _rawCashFlow: tickerCashFlow.map(c => ({ ...c, type: normalizeType(c.type, c.period) })),
    _rawDividends: rawDividends,
    fundamentals,
    businessSummary: tickerBrapi.longBusinessSummary?.trim() || null
  };
};

// --- WACC ---

export const calculateWacc = (data: FinancialData, a: ValuationAssumptions) => {
  const ke = a.riskFreeRate + (a.beta * a.equityRiskPremium);
  let rawKd = a.costOfDebt;
  if (data.debt > 0 && data.interestExpenses > 0) {
    const implied = data.interestExpenses / data.debt;
    if (implied >= 0.01 && implied <= 0.60) rawKd = implied;
  }
  const kdNet = rawKd * (1 - 0.34);
  const E = data.price * data.sharesOutstanding;
  const D = data.debt;
  const V = E + D;
  if (V === 0) return { wacc: ke, ke };
  const wacc = (ke * E / V) + (kdNet * D / V);
  return { wacc, ke };
};

// --- Valuation methods ---

const calcDCF = (data: FinancialData, wacc: number, gPerp: number, gRev: number): number => {
  const baseFCF = data.freeCashFlow;
  let currentFCF = baseFCF * (1 + gRev);
  let pvCF = 0;
  for (let i = 1; i <= 5; i++) {
    currentFCF *= (1 + gRev);
    pvCF += currentFCF / Math.pow(1 + wacc, i);
  }
  const termFCF = currentFCF * (1 + gPerp);
  const termVal = termFCF / (wacc - gPerp);
  const pvTerm = termVal / Math.pow(1 + wacc, 5);
  const ev = pvCF + pvTerm;
  const eqVal = ev + data.cashAndEquivalents - data.debt;
  return Math.max(0, eqVal / data.sharesOutstanding);
};

const calcGordon = (data: FinancialData, ke: number, g: number): number => {
  const d1 = data.currentEPS * (1 + g);
  if (ke <= g) return 0;
  return d1 / (ke - g);
};

const calcGraham = (data: FinancialData): number => {
  const lpa = data.currentEPS;
  const vpa = data.sharesOutstanding > 0 ? data.equity / data.sharesOutstanding : 0;
  if (lpa <= 0 || vpa <= 0) return 0;
  return Math.sqrt(22.5 * lpa * vpa);
};

const calcEVA = (data: FinancialData, wacc: number, gRev: number): number => {
  const year1Ebit = data.ebit * (1 + gRev) * (1 + gRev);
  const nopat = year1Ebit * 0.66;
  const capCharge = data.investedCapital * wacc;
  const eva = nopat - capCharge;
  const mva = eva / wacc;
  const eqVal = data.investedCapital + mva - data.debt + data.cashAndEquivalents;
  return Math.max(0, eqVal / data.sharesOutstanding);
};

const calcMultiples = (data: FinancialData): number => {
  const byPE = (data.netIncome * data.sectorPE) / data.sharesOutstanding;
  const impliedEV = data.ebit * data.sectorEVEBITDA;
  const byEBITDA = (impliedEV - data.debt + data.cashAndEquivalents) / data.sharesOutstanding;
  return (byPE + byEBITDA) / 2;
};

// --- Perform valuation ---

export const performValuation = (data: FinancialData, assumptions: ValuationAssumptions, customWeights?: ValuationWeights): ComprehensiveValuation => {
  const { wacc, ke } = calculateWacc(data, assumptions);
  const gPerp = assumptions.perpetualGrowth;
  const gRev = assumptions.projectedRevenueGrowth;

  const dcf = calcDCF(data, wacc, gPerp, gRev);
  const gordon = calcGordon(data, ke, gPerp);
  const graham = calcGraham(data);
  const eva = calcEVA(data, wacc, gRev);
  const multiples = calcMultiples(data);

  const w = customWeights || DEFAULT_WEIGHTS.MATURE;
  const totalW = w.DCF + w.GORDON + w.EVA + w.MULTIPLES + w.GRAHAM;
  const weighted = (dcf * w.DCF + gordon * w.GORDON + eva * w.EVA + multiples * w.MULTIPLES + graham * w.GRAHAM) / totalW;

  const trace = (formula: string, val: number): CalculationTrace => ({
    formula, inputs: {}, steps: [], finalResult: val
  });

  const results: ValuationResult[] = [
    { method: ValuationMethodType.DCF, fairValue: dcf, weight: w.DCF / totalW, upside: dcf / data.price - 1, details: 'FCD', trace: trace('DCF', dcf) },
    { method: ValuationMethodType.GORDON, fairValue: gordon, weight: w.GORDON / totalW, upside: gordon / data.price - 1, details: 'Gordon', trace: trace('Gordon', gordon) },
    { method: ValuationMethodType.EVA, fairValue: eva, weight: w.EVA / totalW, upside: eva / data.price - 1, details: 'EVA', trace: trace('EVA', eva) },
    { method: ValuationMethodType.MULTIPLES, fairValue: multiples, weight: w.MULTIPLES / totalW, upside: multiples / data.price - 1, details: 'Múltiplos', trace: trace('Múltiplos', multiples) },
    { method: ValuationMethodType.GRAHAM, fairValue: graham, weight: w.GRAHAM / totalW, upside: graham / data.price - 1, details: 'Graham', trace: trace('Graham', graham) },
  ];

  const values = results.map(r => r.fairValue).filter(v => v > 0);

  // Sensitivity matrix
  const matrix: SensitivityCell[][] = [];
  for (const wStep of [-2, -1, 0, 1, 2]) {
    const row: SensitivityCell[] = [];
    const simW = wacc + wStep * 0.005;
    for (const gStep of [-2, -1, 0, 1, 2]) {
      const simG = gPerp + gStep * 0.005;
      row.push({ wacc: simW, growth: simG, fairValue: calcDCF(data, simW, simG, gRev) });
    }
    matrix.push(row);
  }

  return {
    ticker: data.ticker,
    currentPrice: data.price,
    weightedFairValue: weighted,
    calculatedWacc: wacc,
    totalUpside: weighted / data.price - 1,
    results,
    priceRange: { min: Math.min(...values), max: Math.max(...values) },
    sensitivityMatrix: matrix
  };
};
