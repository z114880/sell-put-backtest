import { historicalVolatility, bsPutPrice } from "./bs-model.js";
import type {
  Period,
  EquityPoint,
  StrategyStats,
  StrategyResult,
  Trade,
  BacktestResponse,
} from "./types.js";
import { PERIOD_DAYS } from "./types.js";
import type { PriceRecord } from "./yahoo.js";

const RISK_FREE_RATE = 0.03;

// ---------------------------------------------------------------------------
// Helper: find first trading day index >= date string
// ---------------------------------------------------------------------------
function findTradingDayOnOrAfter(prices: PriceRecord[], date: string): number {
  for (let i = 0; i < prices.length; i++) {
    if (prices[i].date >= date) return i;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Helper: find last trading day index <= date string
// ---------------------------------------------------------------------------
function findTradingDayOnOrBefore(prices: PriceRecord[], date: string): number {
  let idx = -1;
  for (let i = 0; i < prices.length; i++) {
    if (prices[i].date <= date) idx = i;
    else break;
  }
  return idx;
}

// ---------------------------------------------------------------------------
// Helper: get closing prices from the 7 natural days before `date`.
// Expands backward in 7-day increments (up to 60 days) if < 2 trading days.
// ---------------------------------------------------------------------------
function getVolatilityPrices(prices: PriceRecord[], date: string): number[] {
  const refDate = new Date(date);

  for (let lookback = 7; lookback <= 60; lookback += 7) {
    const windowStart = new Date(refDate);
    windowStart.setDate(windowStart.getDate() - lookback);
    const windowStartStr = windowStart.toISOString().slice(0, 10);

    const window = prices.filter(
      (p) => p.date >= windowStartStr && p.date < date
    );

    if (window.length >= 2) {
      return window.map((p) => p.close);
    }
  }

  // Return whatever we can find up to 60 days back (may be < 2)
  const fallbackStart = new Date(refDate);
  fallbackStart.setDate(fallbackStart.getDate() - 60);
  const fallbackStartStr = fallbackStart.toISOString().slice(0, 10);
  return prices
    .filter((p) => p.date >= fallbackStartStr && p.date < date)
    .map((p) => p.close);
}

// ---------------------------------------------------------------------------
// Helper: compute strategy statistics from an equity curve
// ---------------------------------------------------------------------------
function computeStats(
  equityCurve: EquityPoint[],
  initialCapital: number,
  totalDays: number
): StrategyStats {
  const finalValue =
    equityCurve.length > 0
      ? equityCurve[equityCurve.length - 1].value
      : initialCapital;

  const totalReturn = (finalValue - initialCapital) / initialCapital;

  const years = totalDays / 365;
  const annualizedReturn =
    years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;

  // Max drawdown
  let peak = -Infinity;
  let maxDrawdown = 0;
  for (const point of equityCurve) {
    if (point.value > peak) peak = point.value;
    const drawdown = peak > 0 ? (peak - point.value) / peak : 0;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // Sharpe ratio: daily returns, annualized
  let sharpeRatio = 0;
  if (equityCurve.length >= 2) {
    const dailyReturns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const prev = equityCurve[i - 1].value;
      const curr = equityCurve[i].value;
      dailyReturns.push(prev !== 0 ? (curr - prev) / prev : 0);
    }
    const meanReturn =
      dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
    const variance =
      dailyReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) /
      dailyReturns.length;
    const dailyVol = Math.sqrt(variance);
    const annualizedVol = dailyVol * Math.sqrt(252);
    const dailyRiskFree = RISK_FREE_RATE / 252;
    const excessReturn = meanReturn - dailyRiskFree;
    sharpeRatio =
      annualizedVol !== 0 ? (excessReturn * Math.sqrt(252)) / annualizedVol : 0;
  }

  return { totalReturn, annualizedReturn, maxDrawdown, sharpeRatio };
}

// ---------------------------------------------------------------------------
// Strategy 1: Buy & Hold
// ---------------------------------------------------------------------------
function runBuyAndHold(
  prices: PriceRecord[],
  startDate: string,
  endDate: string,
  initialCapital: number
): StrategyResult {
  const startIdx = findTradingDayOnOrAfter(prices, startDate);
  if (startIdx === -1) {
    throw new Error("No trading data found on or after startDate");
  }

  const endIdx = findTradingDayOnOrBefore(prices, endDate);
  if (endIdx === -1 || endIdx < startIdx) {
    throw new Error("No trading data found in the given date range");
  }

  const buyPrice = prices[startIdx].close;
  const shares = Math.floor(initialCapital / buyPrice);
  const idleCash = initialCapital - shares * buyPrice;

  const equityCurve: EquityPoint[] = [];
  for (let i = startIdx; i <= endIdx; i++) {
    equityCurve.push({
      date: prices[i].date,
      value: shares * prices[i].close + idleCash,
    });
  }

  const startDateActual = new Date(prices[startIdx].date);
  const endDateActual = new Date(prices[endIdx].date);
  const totalDays =
    (endDateActual.getTime() - startDateActual.getTime()) /
    (1000 * 60 * 60 * 24);

  const stats = computeStats(equityCurve, initialCapital, totalDays);

  return { equityCurve, stats };
}

// ---------------------------------------------------------------------------
// Strategy 2: Sell Put (cash-secured, ATM, rolling)
// ---------------------------------------------------------------------------
function runSellPut(
  prices: PriceRecord[],
  startDate: string,
  endDate: string,
  initialCapital: number,
  period: Period
): { result: StrategyResult; trades: Trade[] } {
  const periodDays = PERIOD_DAYS[period];

  const startIdx = findTradingDayOnOrAfter(prices, startDate);
  if (startIdx === -1) {
    throw new Error("No trading data found on or after startDate");
  }
  const endIdx = findTradingDayOnOrBefore(prices, endDate);
  if (endIdx === -1 || endIdx < startIdx) {
    throw new Error("No trading data found in the given date range");
  }

  let capital = initialCapital;
  const equityCurve: EquityPoint[] = [];
  const trades: Trade[] = [];

  // Cycle state
  let inCycle = false;
  let expiryDate = "";
  let strike = 0;
  let premium = 0; // per share
  let contracts = 0;
  let cycleSellDate = "";

  for (let i = startIdx; i <= endIdx; i++) {
    const today = prices[i].date;
    const currentPrice = prices[i].close;

    if (!inCycle) {
      // Try to start a new cycle
      contracts = Math.floor(capital / (currentPrice * 100));

      if (contracts === 0) {
        // Not enough capital — stay idle
        equityCurve.push({ date: today, value: capital });
        continue;
      }

      // Calculate volatility
      const volPrices = getVolatilityPrices(prices, today);
      const sigma = historicalVolatility(volPrices);

      if (sigma === 0) {
        // Can't price — skip this day, mark as skipped trade
        trades.push({
          sellDate: today,
          expiryDate: today,
          strike: currentPrice,
          premium: 0,
          expiryPrice: currentPrice,
          pnl: 0,
          capitalAfter: capital,
          contracts,
          skipped: true,
        });
        equityCurve.push({ date: today, value: capital });
        continue;
      }

      const T = periodDays / 365;
      const putPrice = bsPutPrice(currentPrice, RISK_FREE_RATE, sigma, T);

      // Set expiry date (natural calendar days forward)
      const expiry = new Date(today);
      expiry.setDate(expiry.getDate() + periodDays);
      expiryDate = expiry.toISOString().slice(0, 10);

      strike = currentPrice;
      premium = putPrice;
      cycleSellDate = today;
      inCycle = true;

      equityCurve.push({ date: today, value: capital });
    } else {
      // In a cycle — equity is the current cash (unchanged until settlement)
      if (today >= expiryDate) {
        // Settle the cycle
        let pnl: number;
        if (currentPrice >= strike) {
          // OTM — keep full premium
          pnl = premium * 100 * contracts;
        } else {
          // ITM — premium minus assignment loss
          pnl = (premium - (strike - currentPrice)) * 100 * contracts;
        }

        capital += pnl;

        trades.push({
          sellDate: cycleSellDate,
          expiryDate: today,
          strike,
          premium,
          expiryPrice: currentPrice,
          pnl,
          capitalAfter: capital,
          contracts,
          skipped: false,
        });

        equityCurve.push({ date: today, value: capital });
        inCycle = false;
      } else {
        equityCurve.push({ date: today, value: capital });
      }
    }
  }

  // Force-settle any open cycle at endDate
  if (inCycle && equityCurve.length > 0) {
    const lastPrice = prices[endIdx].close;
    const lastDate = prices[endIdx].date;

    let pnl: number;
    if (lastPrice >= strike) {
      pnl = premium * 100 * contracts;
    } else {
      pnl = (premium - (strike - lastPrice)) * 100 * contracts;
    }

    capital += pnl;

    // Update the last equity point with settled value
    equityCurve[equityCurve.length - 1] = { date: lastDate, value: capital };

    trades.push({
      sellDate: cycleSellDate,
      expiryDate: lastDate,
      strike,
      premium,
      expiryPrice: lastPrice,
      pnl,
      capitalAfter: capital,
      contracts,
      skipped: false,
    });
  }

  const startDateActual = new Date(prices[startIdx].date);
  const endDateActual = new Date(prices[endIdx].date);
  const totalDays =
    (endDateActual.getTime() - startDateActual.getTime()) /
    (1000 * 60 * 60 * 24);

  const stats = computeStats(equityCurve, initialCapital, totalDays);

  // Win rate: non-skipped trades where pnl > 0
  const realTrades = trades.filter((t) => !t.skipped);
  const wins = realTrades.filter((t) => t.pnl > 0).length;
  stats.winRate = realTrades.length > 0 ? wins / realTrades.length : 0;

  return { result: { equityCurve, stats }, trades };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export function runBacktest(
  prices: PriceRecord[],
  startDate: string,
  endDate: string,
  initialCapital: number,
  period: Period
): BacktestResponse {
  const buyAndHold = runBuyAndHold(prices, startDate, endDate, initialCapital);
  const { result: sellPut, trades } = runSellPut(
    prices,
    startDate,
    endDate,
    initialCapital,
    period
  );
  return { buyAndHold, sellPut, trades };
}
