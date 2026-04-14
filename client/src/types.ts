export type Period = "weekly" | "biweekly" | "monthly" | "quarterly";

export interface BacktestRequest {
  ticker: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  period: Period;
  riskFreeRate: number;
  transactionCostPct: number;
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

export interface BacktestError {
  error: string;
}
