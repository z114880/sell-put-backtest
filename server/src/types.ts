export type Period = "weekly" | "biweekly" | "monthly" | "bimonthly" | "quarterly";

export interface BacktestRequest {
  ticker: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  period: Period;
  riskFreeRate: number;
  delta: number; // target put delta as positive number, e.g. 0.50 = ATM, 0.30 = OTM
  ivPremium: number; // IV premium over HV, e.g. 0.20 = +20%
  volWindow: number; // number of trading days for HV calculation
  commissionPerContract: number;
  spreadPct: number;
  cashInterestEnabled: boolean;
  cashInterestRate: number;
}

export interface EquityPoint {
  date: string;
  value: number;
}

export interface StrategyStats {
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate?: number;
}

export interface Trade {
  sellDate: string;
  expiryDate: string;
  strike: number;
  premium: number;
  expiryPrice: number;
  pnl: number;
  capitalAfter: number;
  contracts: number;
}

export interface StrategyResult {
  equityCurve: EquityPoint[];
  stats: StrategyStats;
}

export interface BacktestResponse {
  buyAndHold: StrategyResult;
  sellPut: StrategyResult;
  trades: Trade[];
}
