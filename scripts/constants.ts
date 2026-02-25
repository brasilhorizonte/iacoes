export const DEFAULT_RISK_FREE_RATE = 0.15;
export const DEFAULT_MARKET_PREMIUM = 0.05;
export const TERMINAL_GROWTH_DEFAULT = 0.05;
export const DEFAULT_COST_OF_DEBT = 0.16;
export const DEFAULT_REVENUE_GROWTH = 0.05;

export const DEFAULT_WEIGHTS = {
  GROWTH: { DCF: 0.50, GORDON: 0.0, EVA: 0.20, MULTIPLES: 0.20, GRAHAM: 0.10 },
  MATURE: { DCF: 0.40, GORDON: 0.10, EVA: 0.15, MULTIPLES: 0.15, GRAHAM: 0.20 },
  DISTRESS: { DCF: 0.40, GORDON: 0.0, EVA: 0.15, MULTIPLES: 0.25, GRAHAM: 0.20 }
};

export const SCENARIO_PRESETS = {
  BASE: {
    riskFreeRate: 0.15,
    equityRiskPremium: 0.05,
    beta: 1.0,
    perpetualGrowth: 0.05,
    projectedRevenueGrowth: 0.05
  },
  BULL: {
    riskFreeRate: 0.12,
    equityRiskPremium: 0.045,
    beta: 1.1,
    perpetualGrowth: 0.06,
    projectedRevenueGrowth: 0.08
  },
  BEAR: {
    riskFreeRate: 0.16,
    equityRiskPremium: 0.06,
    beta: 0.9,
    perpetualGrowth: 0.03,
    projectedRevenueGrowth: 0.02
  }
};
