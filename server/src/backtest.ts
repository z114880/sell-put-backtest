import { historicalVolatility, bsPutPrice, findStrikeForDelta } from "./bs-model.js";
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
// Helper: get the last `volWindow` trading-day closing prices before `date`.
// ---------------------------------------------------------------------------
function getVolatilityPrices(prices: PriceRecord[], date: string, volWindow: number): number[] {
  // Find the index of the last trading day before `date`
  let endIdx = -1;
  for (let i = 0; i < prices.length; i++) {
    if (prices[i].date < date) endIdx = i;
    else break;
  }
  if (endIdx < 0) return [];

  const startIdx = Math.max(0, endIdx - volWindow + 1);
  return prices.slice(startIdx, endIdx + 1).map((p) => p.close);
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
// Helper: compute all roll Thursdays for the given period within [start, end]
// - weekly:    every Thursday
// - biweekly:  every other Thursday (starting from the first one)
// - monthly:   last Thursday of each month
// - bimonthly: last Thursday of every other month, anchored to the start month
// - quarterly: last Thursday of the last month of each quarter (Mar, Jun, Sep, Dec)
// ---------------------------------------------------------------------------
function getRollThursdays(startDate: string, endDate: string, period: Period): string[] {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const thursdays: string[] = [];

  if (period === "monthly" || period === "bimonthly" || period === "quarterly") {
    // Collect last Thursday of relevant months
    const quarterMonths = new Set([2, 5, 8, 11]); // Mar, Jun, Sep, Dec (0-indexed)
    const startMonthIndex = start.getFullYear() * 12 + start.getMonth();
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

    while (cursor <= end) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      const monthIndex = year * 12 + month;

      if (period === "quarterly" && !quarterMonths.has(month)) {
        cursor.setMonth(cursor.getMonth() + 1);
        continue;
      }

      if (period === "bimonthly" && (monthIndex - startMonthIndex) % 2 !== 0) {
        cursor.setMonth(cursor.getMonth() + 1);
        continue;
      }

      // Find the last Thursday of this month
      const lastDay = new Date(year, month + 1, 0); // last day of month
      const dayOfWeek = lastDay.getDay();
      const daysBack = (dayOfWeek + 3) % 7; // Thu=0, Fri=1, Sat=2, Sun=3, ...
      const lastThursday = new Date(lastDay);
      lastThursday.setDate(lastDay.getDate() - daysBack);
      const dateStr = formatLocalDate(lastThursday);

      if (dateStr >= startDate && dateStr <= endDate) {
        thursdays.push(dateStr);
      }

      cursor.setMonth(cursor.getMonth() + 1);
    }
  } else {
    // weekly / biweekly: enumerate all Thursdays
    const cursor = new Date(start);
    // Advance to first Thursday on or after start
    const dayOfWeek = cursor.getDay();
    const daysToThu = (4 - dayOfWeek + 7) % 7;
    cursor.setDate(cursor.getDate() + daysToThu);

    const step = period === "biweekly" ? 14 : 7;
    while (cursor <= end) {
      thursdays.push(formatLocalDate(cursor));
      cursor.setDate(cursor.getDate() + step);
    }
  }

  return thursdays;
}

// ---------------------------------------------------------------------------
// Strategy 2: Sell Put (cash-secured, delta-selected, rolling on Thursdays)
// ---------------------------------------------------------------------------
function runSellPut(
  prices: PriceRecord[],
  startDate: string,
  endDate: string,
  initialCapital: number,
  period: Period,
  riskFreeRate: number,
  delta: number,
  ivPremium: number,
  volWindow: number,
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

  // Pre-compute all target roll Thursdays
  const rollThursdays = getRollThursdays(startDate, endDate, period);

  // Build a set of all trading dates for quick lookup
  const tradingDates = new Set(prices.slice(startIdx, endIdx + 1).map((p) => p.date));

  // For each roll Thursday, find the actual trading day (Thursday itself, or the
  // trading day just before if Thursday is a holiday)
  const rollDates: string[] = [];
  for (const thu of rollThursdays) {
    if (tradingDates.has(thu)) {
      rollDates.push(thu);
    } else {
      // Thursday is not a trading day — use the closest trading day before it
      const idx = findTradingDayOnOrBefore(prices, thu);
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
      const volPrices = getVolatilityPrices(prices, today, volWindow);
      const hv = historicalVolatility(volPrices);

      if (hv === 0) {
        equityCurve.push({ date: today, value: capital });
        continue;
      }

      // Apply IV premium: implied vol = historical vol * (1 + ivPremium)
      const sigma = hv * (1 + ivPremium);

      // Find the next roll date to determine T (time to expiry)
      const currentRollPos = rollDates.indexOf(today);
      const nextRollDate = currentRollPos < rollDates.length - 1
        ? rollDates[currentRollPos + 1]
        : null;

      if (!nextRollDate) {
        equityCurve.push({ date: today, value: capital });
        continue;
      }

      const daysToExpiry = (new Date(nextRollDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24);
      const T = daysToExpiry / 365;

      // Find strike for target delta using IV-adjusted sigma, then round
      const targetDelta = -delta;
      strike = findStrikeForDelta(currentPrice, riskFreeRate, sigma, T, targetDelta);
      strike = Math.round(strike);

      // Compute contracts using strike (cash-secured margin = strike * 100)
      contracts = Math.floor(capital / (strike * 100));

      if (contracts === 0) {
        equityCurve.push({ date: today, value: capital });
        continue;
      }

      // Price the put at the rounded strike
      const putMidPrice = bsPutPrice(currentPrice, riskFreeRate, sigma, T, strike);
      const spreadCostPerShare = putMidPrice * spreadPct / 2;
      const netPremiumPerShare = putMidPrice - spreadCostPerShare;
      const openCommission = commissionPerContract * contracts;
      cyclePremiumPerShare = netPremiumPerShare;
      cashInCycle = capital + netPremiumPerShare * 100 * contracts - openCommission;
      cycleSigma = sigma;
      cycleExpiryDate = nextRollDate;
      cycleSellDate = today;
      inCycle = true;

      // Opening-day equity: capital minus transaction costs (spread + commission)
      const openingEquity = capital - spreadCostPerShare * 100 * contracts - openCommission;
      equityCurve.push({ date: today, value: openingEquity });
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
  delta: number,
  ivPremium: number,
  volWindow: number,
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
    delta,
    ivPremium,
    volWindow,
    commissionPerContract,
    spreadPct,
    cashInterestRate
  );
  return { buyAndHold, sellPut, trades };
}
