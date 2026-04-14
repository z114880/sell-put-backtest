import { historicalVolatility, bsPutPrice } from "./bs-model.js";
import type {
  Period,
  EquityPoint,
  StrategyStats,
  StrategyResult,
  Trade,
  BacktestResponse,
} from "./types.js";

import type { PriceRecord } from "./yahoo.js";

// riskFreeRate is now passed as a parameter

// ---------------------------------------------------------------------------
// Helper: format a Date as YYYY-MM-DD using its local-time components.
// Avoids the timezone-shift bug where toISOString() (UTC) disagrees with
// a Date that was constructed in local time.
// ---------------------------------------------------------------------------
function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

  for (let lookback = 45; lookback <= 120; lookback += 15) {
    const windowStart = new Date(refDate);
    windowStart.setDate(windowStart.getDate() - lookback);
    const windowStartStr = formatLocalDate(windowStart);

    const window = prices.filter(
      (p) => p.date >= windowStartStr && p.date < date
    );

    if (window.length >= 20) {
      return window.map((p) => p.close);
    }
  }

  // Return whatever we can find up to 120 days back
  const fallbackStart = new Date(refDate);
  fallbackStart.setDate(fallbackStart.getDate() - 120);
  const fallbackStartStr = formatLocalDate(fallbackStart);
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
  totalDays: number,
  riskFreeRate: number
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
    const dailyRiskFree = riskFreeRate / 252;
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
  initialCapital: number,
  riskFreeRate: number
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

  const stats = computeStats(equityCurve, initialCapital, totalDays, riskFreeRate);

  return { equityCurve, stats };
}

// ---------------------------------------------------------------------------
// Helper: compute all roll Fridays for the given period within [start, end]
// - weekly:    every Friday
// - biweekly:  every other Friday (starting from the first one)
// - monthly:   last Friday of each month
// - quarterly: last Friday of the last month of each quarter (Mar, Jun, Sep, Dec)
// ---------------------------------------------------------------------------
function getRollFridays(startDate: string, endDate: string, period: Period): string[] {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const fridays: string[] = [];

  if (period === "monthly" || period === "quarterly") {
    // Collect last Friday of relevant months
    const quarterMonths = new Set([2, 5, 8, 11]); // Mar, Jun, Sep, Dec (0-indexed)
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

    while (cursor <= end) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth();

      if (period === "quarterly" && !quarterMonths.has(month)) {
        cursor.setMonth(cursor.getMonth() + 1);
        continue;
      }

      // Find the last Friday of this month
      const lastDay = new Date(year, month + 1, 0); // last day of month
      const dayOfWeek = lastDay.getDay();
      const daysBack = (dayOfWeek + 2) % 7; // Fri=0, Sat=1, Sun=2, Mon=3, ...
      const lastFriday = new Date(lastDay);
      lastFriday.setDate(lastDay.getDate() - daysBack);
      const dateStr = formatLocalDate(lastFriday);

      if (dateStr >= startDate && dateStr <= endDate) {
        fridays.push(dateStr);
      }

      cursor.setMonth(cursor.getMonth() + 1);
    }
  } else {
    // weekly / biweekly: enumerate all Fridays
    const cursor = new Date(start);
    // Advance to first Friday on or after start
    const dayOfWeek = cursor.getDay();
    const daysToFri = (5 - dayOfWeek + 7) % 7;
    cursor.setDate(cursor.getDate() + daysToFri);

    const step = period === "biweekly" ? 14 : 7;
    while (cursor <= end) {
      fridays.push(formatLocalDate(cursor));
      cursor.setDate(cursor.getDate() + step);
    }
  }

  return fridays;
}

// ---------------------------------------------------------------------------
// Strategy 2: Sell Put (cash-secured, ATM, rolling on Fridays)
// ---------------------------------------------------------------------------
function runSellPut(
  prices: PriceRecord[],
  startDate: string,
  endDate: string,
  initialCapital: number,
  period: Period,
  riskFreeRate: number,
  commissionPerContract: number,
  spreadPct: number,
  cashInterestRate: number
): { result: StrategyResult; trades: Trade[] } {
  const startIdx = findTradingDayOnOrAfter(prices, startDate);
  if (startIdx === -1) {
    throw new Error("No trading data found on or after startDate");
  }
  const endIdx = findTradingDayOnOrBefore(prices, endDate);
  if (endIdx === -1 || endIdx < startIdx) {
    throw new Error("No trading data found in the given date range");
  }

  // Pre-compute all target roll Fridays
  const rollFridays = getRollFridays(startDate, endDate, period);
  const rollFridaySet = new Set(rollFridays);

  // Build a set of all trading dates for quick lookup
  const tradingDates = new Set(prices.slice(startIdx, endIdx + 1).map((p) => p.date));

  // For each roll Friday, find the actual trading day (Friday itself, or the
  // trading day just before if Friday is a holiday)
  const rollDates: string[] = [];
  for (const fri of rollFridays) {
    if (tradingDates.has(fri)) {
      rollDates.push(fri);
    } else {
      // Friday is not a trading day — use the closest trading day before it
      const idx = findTradingDayOnOrBefore(prices, fri);
      if (idx >= startIdx && idx <= endIdx) {
        rollDates.push(prices[idx].date);
      }
    }
  }

  const rollDateSet = new Set(rollDates);

  let capital = initialCapital;
  const equityCurve: EquityPoint[] = [];
  const trades: Trade[] = [];

  // Cycle state
  let inCycle = false;
  let strike = 0;
  let contracts = 0;
  let cycleSellDate = "";
  let cycleSigma = 0;
  let cycleExpiryDate = "";
  let cashInCycle = 0; // cash after receiving premium
  let cyclePremiumPerShare = 0;

  const dailyInterestRate = cashInterestRate > 0 ? Math.pow(1 + cashInterestRate, 1 / 252) - 1 : 0;

  for (let i = startIdx; i <= endIdx; i++) {
    const today = prices[i].date;
    const currentPrice = prices[i].close;
    const isRollDay = rollDateSet.has(today);

    // Accrue daily interest on cash
    if (dailyInterestRate > 0) {
      if (inCycle) {
        const interest = cashInCycle * dailyInterestRate;
        cashInCycle += interest;
      } else {
        const interest = capital * dailyInterestRate;
        capital += interest;
      }
    }

    // Settle existing cycle if we hit a roll day
    if (inCycle && isRollDay) {
      const daysToExpiry = (new Date(cycleExpiryDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24);
      const T_close = daysToExpiry / 365;
      const putMidPrice = T_close > 0
        ? bsPutPrice(currentPrice, riskFreeRate, cycleSigma, T_close, strike)
        : Math.max(strike - currentPrice, 0);
      const closeSpreadCost = putMidPrice * spreadPct / 2;
      const closeCostPerShare = putMidPrice + closeSpreadCost;
      const closeCommission = commissionPerContract * contracts;
      const capitalBefore = cashInCycle - cyclePremiumPerShare * 100 * contracts;
      capital = cashInCycle - closeCostPerShare * 100 * contracts - closeCommission;
      const pnl = capital - capitalBefore;

      trades.push({
        sellDate: cycleSellDate,
        expiryDate: today,
        strike,
        premium: cyclePremiumPerShare,
        expiryPrice: currentPrice,
        pnl,
        capitalAfter: capital,
        contracts,
      });

      inCycle = false;
    }

    // Open new cycle on a roll day (after settling the previous one)
    if (!inCycle && isRollDay) {
      contracts = Math.floor(capital / (currentPrice * 100));

      if (contracts === 0) {
        equityCurve.push({ date: today, value: capital });
        continue;
      }

      const volPrices = getVolatilityPrices(prices, today);
      const sigma = historicalVolatility(volPrices);

      if (sigma === 0) {
        equityCurve.push({ date: today, value: capital });
        continue;
      }

      // Find the next roll date to determine T (time to expiry)
      const currentRollPos = rollDates.indexOf(today);
      const nextRollDate = currentRollPos < rollDates.length - 1
        ? rollDates[currentRollPos + 1]
        : null;

      if (!nextRollDate) {
        // No future roll date — don't open a new position
        equityCurve.push({ date: today, value: capital });
        continue;
      }

      const daysToExpiry = (new Date(nextRollDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24);
      const T = daysToExpiry / 365;
      const putMidPrice = bsPutPrice(currentPrice, riskFreeRate, sigma, T);
      const spreadCostPerShare = putMidPrice * spreadPct / 2;
      const netPremiumPerShare = putMidPrice - spreadCostPerShare;
      const openCommission = commissionPerContract * contracts;

      strike = currentPrice;
      cyclePremiumPerShare = netPremiumPerShare;
      cashInCycle = capital + netPremiumPerShare * 100 * contracts - openCommission;
      cycleSigma = sigma;
      cycleExpiryDate = nextRollDate;
      cycleSellDate = today;
      inCycle = true;

      // Mark-to-market on sell day
      const putMtm = bsPutPrice(currentPrice, riskFreeRate, cycleSigma, T, strike);
      const equity = cashInCycle - putMtm * 100 * contracts;
      equityCurve.push({ date: today, value: equity });
    } else if (!inCycle) {
      // Not a roll day and not in cycle — idle
      equityCurve.push({ date: today, value: capital });
    } else {
      // In cycle — mark to market the short put position
      const daysRemaining = (new Date(cycleExpiryDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24);
      const T_remaining = daysRemaining / 365;

      let putMtm: number;
      if (T_remaining <= 0) {
        putMtm = Math.max(strike - currentPrice, 0);
      } else {
        putMtm = bsPutPrice(currentPrice, riskFreeRate, cycleSigma, T_remaining, strike);
      }

      const equity = cashInCycle - putMtm * 100 * contracts;
      equityCurve.push({ date: today, value: equity });
    }
  }

  // Force-settle any open cycle at endDate
  if (inCycle) {
    const lastPrice = prices[endIdx].close;
    const lastDate = prices[endIdx].date;
    const daysToExpiry = (new Date(cycleExpiryDate).getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24);
    const T_close = daysToExpiry / 365;
    const putMidPrice = T_close > 0
      ? bsPutPrice(lastPrice, riskFreeRate, cycleSigma, T_close, strike)
      : Math.max(strike - lastPrice, 0);
    const closeSpreadCost = putMidPrice * spreadPct / 2;
    const closeCostPerShare = putMidPrice + closeSpreadCost;
    const closeCommission = commissionPerContract * contracts;
    const capitalBefore = cashInCycle - cyclePremiumPerShare * 100 * contracts;
    capital = cashInCycle - closeCostPerShare * 100 * contracts - closeCommission;
    const pnl = capital - capitalBefore;

    if (equityCurve.length > 0) {
      equityCurve[equityCurve.length - 1] = { date: lastDate, value: capital };
    }

    trades.push({
      sellDate: cycleSellDate,
      expiryDate: lastDate,
      strike,
      premium: cyclePremiumPerShare,
      expiryPrice: lastPrice,
      pnl,
      capitalAfter: capital,
      contracts,
    });
  }

  const startDateActual = new Date(prices[startIdx].date);
  const endDateActual = new Date(prices[endIdx].date);
  const totalDays =
    (endDateActual.getTime() - startDateActual.getTime()) /
    (1000 * 60 * 60 * 24);

  const stats = computeStats(equityCurve, initialCapital, totalDays, riskFreeRate);

  const wins = trades.filter((t) => t.pnl > 0).length;
  stats.winRate = trades.length > 0 ? wins / trades.length : 0;

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
  period: Period,
  riskFreeRate: number,
  commissionPerContract: number,
  spreadPct: number,
  cashInterestRate: number
): BacktestResponse {
  const buyAndHold = runBuyAndHold(prices, startDate, endDate, initialCapital, riskFreeRate);
  const { result: sellPut, trades } = runSellPut(
    prices,
    startDate,
    endDate,
    initialCapital,
    period,
    riskFreeRate,
    commissionPerContract,
    spreadPct,
    cashInterestRate
  );
  return { buyAndHold, sellPut, trades };
}
