# Options Backtest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web-based backtesting tool comparing Buy & Hold vs Sell ATM Cash Secured Put strategies, with Yahoo Finance data and Black-Scholes option pricing.

**Architecture:** Fastify backend fetches Yahoo Finance data, computes BS option prices and runs both backtest strategies. React frontend collects user inputs and renders comparative equity curves, statistics cards, and trade detail tables.

**Tech Stack:** React + TypeScript + Vite + Recharts + Tailwind CSS (frontend), Fastify + TypeScript + yahoo-finance2 (backend), pnpm workspace.

**No testing.** User explicitly opted out of test-related workflows.

---

## File Structure

```
options/
├── client/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── types.ts              # Request/response types
│   │   ├── index.css             # Tailwind imports
│   │   ├── components/
│   │   │   ├── InputForm.tsx     # Parameter input form
│   │   │   ├── StatsCards.tsx    # Summary statistic cards
│   │   │   ├── EquityChart.tsx   # Recharts equity curve
│   │   │   └── TradeTable.tsx    # Sell Put trade detail table
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts              # Fastify server + route
│   │   ├── yahoo.ts              # Yahoo Finance data fetching
│   │   ├── bs-model.ts           # Black-Scholes put pricing + volatility
│   │   ├── backtest.ts           # Backtest engine (both strategies)
│   │   └── types.ts              # Shared types for backend
├── package.json                  # Workspace root
└── pnpm-workspace.yaml
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json` (root)
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `client/package.json`
- Create: `client/tsconfig.json`
- Create: `client/vite.config.ts`
- Create: `client/postcss.config.js`
- Create: `client/tailwind.config.js`
- Create: `client/index.html`
- Create: `client/src/index.css`
- Create: `client/src/main.tsx`

- [ ] **Step 1: Create pnpm workspace root**

`pnpm-workspace.yaml`:
```yaml
packages:
  - "client"
  - "server"
```

`package.json` (root):
```json
{
  "name": "options-backtest",
  "private": true,
  "scripts": {
    "dev": "concurrently \"pnpm --filter server dev\" \"pnpm --filter client dev\"",
    "dev:server": "pnpm --filter server dev",
    "dev:client": "pnpm --filter client dev"
  },
  "devDependencies": {
    "concurrently": "^9.1.2"
  }
}
```

- [ ] **Step 2: Create server package**

`server/package.json`:
```json
{
  "name": "server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts"
  },
  "dependencies": {
    "fastify": "^5.3.3",
    "@fastify/cors": "^11.0.1",
    "yahoo-finance2": "^2.14.0"
  },
  "devDependencies": {
    "tsx": "^4.19.4",
    "typescript": "^5.8.3",
    "@types/node": "^22.15.3"
  }
}
```

`server/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create client package**

`client/package.json`:
```json
{
  "name": "client",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "recharts": "^2.15.3"
  },
  "devDependencies": {
    "@types/react": "^19.1.2",
    "@types/react-dom": "^19.1.2",
    "@vitejs/plugin-react": "^4.4.1",
    "autoprefixer": "^10.4.21",
    "postcss": "^8.5.3",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.8.3",
    "vite": "^6.3.4"
  }
}
```

`client/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

`client/vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
```

`client/postcss.config.js`:
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

`client/tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

`client/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Options Backtest</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`client/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`client/src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 4: Install dependencies**

```bash
cd /Users/edy/Desktop/demoes/options && pnpm install
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "scaffold: pnpm workspace with client and server packages"
```

---

### Task 2: Backend — Black-Scholes Model

**Files:**
- Create: `server/src/bs-model.ts`

- [ ] **Step 1: Implement standard normal CDF and BS put pricing**

`server/src/bs-model.ts`:
```ts
/**
 * Standard normal cumulative distribution function.
 * Abramowitz & Stegun approximation (error < 1.5e-7).
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y =
    1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Compute historical volatility from an array of closing prices.
 * Uses log returns, annualized with sqrt(252).
 * Prices must be in chronological order, at least 2 entries.
 */
export function historicalVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;

  const logReturns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    logReturns.push(Math.log(prices[i] / prices[i - 1]));
  }

  const mean = logReturns.reduce((s, r) => s + r, 0) / logReturns.length;
  const variance =
    logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (logReturns.length - 1);
  const stddev = Math.sqrt(variance);

  return stddev * Math.sqrt(252);
}

/**
 * Black-Scholes ATM put price.
 * S = K = spotPrice (ATM), r = risk-free rate, sigma = annualized vol,
 * T = time to expiry in years.
 */
export function bsPutPrice(
  spotPrice: number,
  riskFreeRate: number,
  sigma: number,
  T: number
): number {
  if (sigma === 0 || T === 0) return 0;

  const S = spotPrice;
  const K = spotPrice; // ATM
  const r = riskFreeRate;

  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  const put = K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
  return put;
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/bs-model.ts && git commit -m "feat: Black-Scholes put pricing and historical volatility"
```

---

### Task 3: Backend — Yahoo Finance Data Fetching

**Files:**
- Create: `server/src/yahoo.ts`

- [ ] **Step 1: Implement data fetching with buffer for volatility lookback**

`server/src/yahoo.ts`:
```ts
import yahooFinance from "yahoo-finance2";

export interface PriceRecord {
  date: string; // YYYY-MM-DD
  close: number;
}

/**
 * Fetch daily closing prices for a ticker.
 * Includes a 30-day buffer before startDate for volatility calculation lookback.
 */
export async function fetchPrices(
  ticker: string,
  startDate: string,
  endDate: string
): Promise<PriceRecord[]> {
  const bufferStart = new Date(startDate);
  bufferStart.setDate(bufferStart.getDate() - 30);

  const result = await yahooFinance.historical(ticker, {
    period1: bufferStart.toISOString().slice(0, 10),
    period2: endDate,
    interval: "1d",
  });

  return result
    .filter((row) => row.close != null)
    .map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      close: row.close!,
    }));
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/yahoo.ts && git commit -m "feat: Yahoo Finance historical price fetching"
```

---

### Task 4: Backend — Shared Types

**Files:**
- Create: `server/src/types.ts`

- [ ] **Step 1: Define request/response types**

`server/src/types.ts`:
```ts
export type Period = "weekly" | "biweekly" | "monthly" | "quarterly";

export interface BacktestRequest {
  ticker: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  period: Period;
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
  winRate?: number; // Sell Put only
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
  skipped: boolean;
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

export const PERIOD_DAYS: Record<Period, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
};
```

- [ ] **Step 2: Commit**

```bash
git add server/src/types.ts && git commit -m "feat: shared backtest types"
```

---

### Task 5: Backend — Backtest Engine

**Files:**
- Create: `server/src/backtest.ts`

- [ ] **Step 1: Implement helper functions**

`server/src/backtest.ts`:
```ts
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

/**
 * Find the index of the first trading day on or after the given date.
 */
function findTradingDayOnOrAfter(prices: PriceRecord[], date: string): number {
  for (let i = 0; i < prices.length; i++) {
    if (prices[i].date >= date) return i;
  }
  return -1;
}

/**
 * Find the index of the last trading day on or before the given date.
 */
function findTradingDayOnOrBefore(prices: PriceRecord[], date: string): number {
  for (let i = prices.length - 1; i >= 0; i--) {
    if (prices[i].date <= date) return i;
  }
  return -1;
}

/**
 * Get closing prices from the 7 natural days before `date`.
 * If fewer than 2 trading days found, expand backward until 2 are found.
 */
function getVolatilityPrices(prices: PriceRecord[], date: string): number[] {
  const targetDate = new Date(date);
  let lookbackDays = 7;

  while (lookbackDays <= 60) {
    const windowStart = new Date(targetDate);
    windowStart.setDate(windowStart.getDate() - lookbackDays);
    const windowStartStr = windowStart.toISOString().slice(0, 10);

    const windowPrices = prices.filter(
      (p) => p.date >= windowStartStr && p.date < date
    );

    if (windowPrices.length >= 2) {
      return windowPrices.map((p) => p.close);
    }
    lookbackDays += 7;
  }

  return [];
}

function computeStats(
  equityCurve: EquityPoint[],
  initialCapital: number,
  totalDays: number
): StrategyStats {
  const finalValue = equityCurve[equityCurve.length - 1].value;
  const totalReturn = (finalValue - initialCapital) / initialCapital;
  const annualizedReturn =
    totalDays > 0
      ? Math.pow(1 + totalReturn, 365 / totalDays) - 1
      : 0;

  // Max drawdown
  let peak = -Infinity;
  let maxDrawdown = 0;
  for (const point of equityCurve) {
    if (point.value > peak) peak = point.value;
    const drawdown = (point.value - peak) / peak;
    if (drawdown < maxDrawdown) maxDrawdown = drawdown;
  }

  // Sharpe ratio: daily returns volatility annualized
  const dailyReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    dailyReturns.push(
      (equityCurve[i].value - equityCurve[i - 1].value) / equityCurve[i - 1].value
    );
  }
  let annualizedVol = 0;
  if (dailyReturns.length > 1) {
    const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
    const variance =
      dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) /
      (dailyReturns.length - 1);
    annualizedVol = Math.sqrt(variance) * Math.sqrt(252);
  }
  const sharpeRatio =
    annualizedVol > 0 ? (annualizedReturn - RISK_FREE_RATE) / annualizedVol : 0;

  return { totalReturn, annualizedReturn, maxDrawdown, sharpeRatio };
}
```

- [ ] **Step 2: Implement Buy & Hold strategy**

Append to `server/src/backtest.ts`:
```ts

function runBuyAndHold(
  prices: PriceRecord[],
  startDate: string,
  endDate: string,
  initialCapital: number
): StrategyResult {
  const startIdx = findTradingDayOnOrAfter(prices, startDate);
  const endIdx = findTradingDayOnOrBefore(prices, endDate);
  if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
    throw new Error("No trading data in the specified date range");
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

  const totalDays =
    (new Date(prices[endIdx].date).getTime() -
      new Date(prices[startIdx].date).getTime()) /
    (1000 * 60 * 60 * 24);

  const stats = computeStats(equityCurve, initialCapital, totalDays);
  return { equityCurve, stats };
}
```

- [ ] **Step 3: Implement Sell Put strategy**

Append to `server/src/backtest.ts`:
```ts

function runSellPut(
  prices: PriceRecord[],
  startDate: string,
  endDate: string,
  initialCapital: number,
  period: Period
): { result: StrategyResult; trades: Trade[] } {
  const periodDays = PERIOD_DAYS[period];
  const startIdx = findTradingDayOnOrAfter(prices, startDate);
  const endIdx = findTradingDayOnOrBefore(prices, endDate);
  if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
    throw new Error("No trading data in the specified date range");
  }

  let capital = initialCapital;
  const trades: Trade[] = [];
  const equityCurve: EquityPoint[] = [];

  // Build equity curve day by day
  let currentCycleIdx = startIdx;

  // Track cycle state
  let inCycle = false;
  let cycleExpiryDate = "";
  let cycleStrike = 0;
  let cyclePremium = 0;
  let cycleContracts = 0;
  let cycleSellDate = "";

  for (let i = startIdx; i <= endIdx; i++) {
    const today = prices[i].date;

    // Start a new cycle if not in one
    if (!inCycle) {
      const currentPrice = prices[i].close;
      const contracts = Math.floor(capital / (currentPrice * 100));

      if (contracts === 0) {
        // Not enough capital for even 1 contract — stay idle
        equityCurve.push({ date: today, value: capital });
        continue;
      }

      // Calculate volatility
      const volPrices = getVolatilityPrices(prices, today);
      const sigma = historicalVolatility(volPrices);

      if (sigma === 0) {
        // Skip this cycle
        trades.push({
          sellDate: today,
          expiryDate: today,
          strike: currentPrice,
          premium: 0,
          expiryPrice: currentPrice,
          pnl: 0,
          capitalAfter: capital,
          contracts: 0,
          skipped: true,
        });
        equityCurve.push({ date: today, value: capital });
        continue;
      }

      const T = periodDays / 365;
      const premiumPerShare = bsPutPrice(currentPrice, RISK_FREE_RATE, sigma, T);

      // Calculate expiry date
      const expiryDateObj = new Date(today);
      expiryDateObj.setDate(expiryDateObj.getDate() + periodDays);
      const expiryDateStr = expiryDateObj.toISOString().slice(0, 10);

      inCycle = true;
      cycleExpiryDate = expiryDateStr;
      cycleStrike = currentPrice;
      cyclePremium = premiumPerShare * 100 * contracts;
      cycleContracts = contracts;
      cycleSellDate = today;

      equityCurve.push({ date: today, value: capital });
      continue;
    }

    // In a cycle — check if today is at or past expiry
    if (today >= cycleExpiryDate) {
      // Settle the cycle: use today's close as settlement price
      // (today is the first trading day on or after expiry)
      const expiryPrice = prices[i].close;
      let pnl = cyclePremium;

      if (expiryPrice < cycleStrike) {
        // ITM: assigned, immediately sell at market
        const loss = (cycleStrike - expiryPrice) * 100 * cycleContracts;
        pnl = cyclePremium - loss;
      }

      capital += pnl;

      trades.push({
        sellDate: cycleSellDate,
        expiryDate: today,
        strike: cycleStrike,
        premium: cyclePremium,
        expiryPrice,
        pnl,
        capitalAfter: capital,
        contracts: cycleContracts,
        skipped: false,
      });

      inCycle = false;
      equityCurve.push({ date: today, value: capital });
      continue;
    }

    // Mid-cycle: capital unchanged (cash position)
    equityCurve.push({ date: today, value: capital });
  }

  // If still in a cycle at endDate, settle at last available price
  if (inCycle && equityCurve.length > 0) {
    const lastPrice = prices[endIdx].close;
    let pnl = cyclePremium;
    if (lastPrice < cycleStrike) {
      const loss = (cycleStrike - lastPrice) * 100 * cycleContracts;
      pnl = cyclePremium - loss;
    }
    capital += pnl;

    trades.push({
      sellDate: cycleSellDate,
      expiryDate: prices[endIdx].date,
      strike: cycleStrike,
      premium: cyclePremium,
      expiryPrice: lastPrice,
      pnl,
      capitalAfter: capital,
      contracts: cycleContracts,
      skipped: false,
    });

    // Update last equity point
    equityCurve[equityCurve.length - 1].value = capital;
  }

  const totalDays =
    (new Date(prices[endIdx].date).getTime() -
      new Date(prices[startIdx].date).getTime()) /
    (1000 * 60 * 60 * 24);

  const stats = computeStats(equityCurve, initialCapital, totalDays);

  // Win rate
  const completedTrades = trades.filter((t) => !t.skipped);
  const wins = completedTrades.filter((t) => t.pnl > 0).length;
  stats.winRate = completedTrades.length > 0 ? wins / completedTrades.length : 0;

  return { result: { equityCurve, stats }, trades };
}
```

- [ ] **Step 4: Implement the main backtest export**

Append to `server/src/backtest.ts`:
```ts

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
```

- [ ] **Step 5: Commit**

```bash
git add server/src/backtest.ts && git commit -m "feat: backtest engine for Buy&Hold and Sell Put strategies"
```

---

### Task 6: Backend — Fastify Server

**Files:**
- Create: `server/src/index.ts`

- [ ] **Step 1: Implement API server with /api/backtest endpoint**

`server/src/index.ts`:
```ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import { fetchPrices } from "./yahoo.js";
import { runBacktest } from "./backtest.js";
import type { BacktestRequest } from "./types.js";

const server = Fastify({ logger: true });

await server.register(cors, { origin: true });

server.post<{ Body: BacktestRequest }>("/api/backtest", async (request, reply) => {
  const { ticker, startDate, endDate, initialCapital, period } = request.body;

  if (!ticker || !startDate || !endDate || !initialCapital || !period) {
    return reply.status(400).send({ error: "Missing required parameters" });
  }

  if (initialCapital <= 0) {
    return reply.status(400).send({ error: "Initial capital must be positive" });
  }

  if (new Date(endDate) <= new Date(startDate)) {
    return reply.status(400).send({ error: "End date must be after start date" });
  }

  const validPeriods = ["weekly", "biweekly", "monthly", "quarterly"];
  if (!validPeriods.includes(period)) {
    return reply.status(400).send({ error: `Invalid period. Must be one of: ${validPeriods.join(", ")}` });
  }

  try {
    const prices = await fetchPrices(ticker, startDate, endDate);
    if (prices.length === 0) {
      return reply.status(400).send({ error: `No price data found for ${ticker} in the given date range` });
    }

    const result = runBacktest(prices, startDate, endDate, initialCapital, period);
    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return reply.status(500).send({ error: message });
  }
});

server.listen({ port: 3000 }, (err) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
});
```

- [ ] **Step 2: Verify server starts**

```bash
cd /Users/edy/Desktop/demoes/options && pnpm dev:server
```

Expected: Fastify logs `Server listening at http://127.0.0.1:3000`

- [ ] **Step 3: Commit**

```bash
git add server/src/index.ts && git commit -m "feat: Fastify API server with /api/backtest endpoint"
```

---

### Task 7: Frontend — Types

**Files:**
- Create: `client/src/types.ts`

- [ ] **Step 1: Define frontend types matching API response**

`client/src/types.ts`:
```ts
export type Period = "weekly" | "biweekly" | "monthly" | "quarterly";

export interface BacktestRequest {
  ticker: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  period: Period;
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
  skipped: boolean;
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
```

- [ ] **Step 2: Commit**

```bash
git add client/src/types.ts && git commit -m "feat: frontend type definitions"
```

---

### Task 8: Frontend — InputForm Component

**Files:**
- Create: `client/src/components/InputForm.tsx`

- [ ] **Step 1: Implement the input form**

`client/src/components/InputForm.tsx`:
```tsx
import { useState } from "react";
import type { BacktestRequest, Period } from "../types";

interface InputFormProps {
  onSubmit: (params: BacktestRequest) => void;
  loading: boolean;
}

export default function InputForm({ onSubmit, loading }: InputFormProps) {
  const [ticker, setTicker] = useState("SPY");
  const [startDate, setStartDate] = useState("2023-01-01");
  const [endDate, setEndDate] = useState("2024-01-01");
  const [initialCapital, setInitialCapital] = useState(100000);
  const [period, setPeriod] = useState<Period>("monthly");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ticker, startDate, endDate, initialCapital, period });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ticker
          </label>
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="SPY"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Initial Capital ($)
          </label>
          <input
            type="number"
            value={initialCapital}
            onChange={(e) => setInitialCapital(Number(e.target.value))}
            min={1}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Option Period
          </label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="weekly">Weekly (7d)</option>
            <option value="biweekly">Biweekly (14d)</option>
            <option value="monthly">Monthly (30d)</option>
            <option value="quarterly">Quarterly (90d)</option>
          </select>
        </div>
        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
          >
            {loading ? "Running..." : "Run Backtest"}
          </button>
        </div>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/InputForm.tsx && git commit -m "feat: InputForm component"
```

---

### Task 9: Frontend — StatsCards Component

**Files:**
- Create: `client/src/components/StatsCards.tsx`

- [ ] **Step 1: Implement statistics cards**

`client/src/components/StatsCards.tsx`:
```tsx
import type { StrategyStats } from "../types";

interface StatsCardsProps {
  buyAndHold: StrategyStats;
  sellPut: StrategyStats;
}

function formatPercent(value: number): string {
  return (value * 100).toFixed(2) + "%";
}

function formatNumber(value: number): string {
  return value.toFixed(2);
}

interface CardProps {
  label: string;
  bh: string;
  sp: string;
}

function Card({ label, bh, sp }: CardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-sm text-gray-500 mb-2">{label}</div>
      <div className="flex justify-between gap-4">
        <div>
          <div className="text-xs text-gray-400">Buy & Hold</div>
          <div className="text-lg font-semibold text-blue-600">{bh}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Sell Put</div>
          <div className="text-lg font-semibold text-green-600">{sp}</div>
        </div>
      </div>
    </div>
  );
}

export default function StatsCards({ buyAndHold, sellPut }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      <Card
        label="Total Return"
        bh={formatPercent(buyAndHold.totalReturn)}
        sp={formatPercent(sellPut.totalReturn)}
      />
      <Card
        label="Annualized Return"
        bh={formatPercent(buyAndHold.annualizedReturn)}
        sp={formatPercent(sellPut.annualizedReturn)}
      />
      <Card
        label="Max Drawdown"
        bh={formatPercent(buyAndHold.maxDrawdown)}
        sp={formatPercent(sellPut.maxDrawdown)}
      />
      <Card
        label="Sharpe Ratio"
        bh={formatNumber(buyAndHold.sharpeRatio)}
        sp={formatNumber(sellPut.sharpeRatio)}
      />
      <Card
        label="Win Rate"
        bh="—"
        sp={sellPut.winRate != null ? formatPercent(sellPut.winRate) : "—"}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/StatsCards.tsx && git commit -m "feat: StatsCards component"
```

---

### Task 10: Frontend — EquityChart Component

**Files:**
- Create: `client/src/components/EquityChart.tsx`

- [ ] **Step 1: Implement equity curve chart**

`client/src/components/EquityChart.tsx`:
```tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { EquityPoint } from "../types";

interface EquityChartProps {
  buyAndHold: EquityPoint[];
  sellPut: EquityPoint[];
}

export default function EquityChart({ buyAndHold, sellPut }: EquityChartProps) {
  // Merge both curves into a single dataset keyed by date
  const dateMap = new Map<string, { date: string; bh?: number; sp?: number }>();

  for (const point of buyAndHold) {
    dateMap.set(point.date, { date: point.date, bh: point.value });
  }
  for (const point of sellPut) {
    const existing = dateMap.get(point.date);
    if (existing) {
      existing.sp = point.value;
    } else {
      dateMap.set(point.date, { date: point.date, sp: point.value });
    }
  }

  const data = Array.from(dateMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4">Equity Curve</h2>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            tickFormatter={(d: string) => d.slice(5)}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) =>
              "$" + v.toLocaleString()
            }
          />
          <Tooltip
            formatter={(value: number) => ["$" + value.toFixed(2)]}
            labelFormatter={(label: string) => label}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="bh"
            name="Buy & Hold"
            stroke="#2563eb"
            dot={false}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="sp"
            name="Sell Put"
            stroke="#16a34a"
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/EquityChart.tsx && git commit -m "feat: EquityChart component"
```

---

### Task 11: Frontend — TradeTable Component

**Files:**
- Create: `client/src/components/TradeTable.tsx`

- [ ] **Step 1: Implement trade detail table**

`client/src/components/TradeTable.tsx`:
```tsx
import type { Trade } from "../types";

interface TradeTableProps {
  trades: Trade[];
}

export default function TradeTable({ trades }: TradeTableProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Sell Put Trade Details</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-500 uppercase bg-gray-50">
            <tr>
              <th className="px-4 py-3">Sell Date</th>
              <th className="px-4 py-3">Expiry Date</th>
              <th className="px-4 py-3 text-right">Strike</th>
              <th className="px-4 py-3 text-right">Contracts</th>
              <th className="px-4 py-3 text-right">Premium</th>
              <th className="px-4 py-3 text-right">Expiry Price</th>
              <th className="px-4 py-3 text-right">P&L</th>
              <th className="px-4 py-3 text-right">Capital After</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {trades.map((trade, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-3">{trade.sellDate}</td>
                <td className="px-4 py-3">{trade.expiryDate}</td>
                <td className="px-4 py-3 text-right">
                  ${trade.strike.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right">{trade.contracts}</td>
                <td className="px-4 py-3 text-right">
                  ${trade.premium.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right">
                  ${trade.expiryPrice.toFixed(2)}
                </td>
                <td
                  className={`px-4 py-3 text-right font-medium ${
                    trade.pnl >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  ${trade.pnl.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right">
                  ${trade.capitalAfter.toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  {trade.skipped ? (
                    <span className="text-yellow-600">Skipped</span>
                  ) : trade.pnl >= 0 ? (
                    <span className="text-green-600">Win</span>
                  ) : (
                    <span className="text-red-600">Loss</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/TradeTable.tsx && git commit -m "feat: TradeTable component"
```

---

### Task 12: Frontend — App.tsx (Wire Everything Together)

**Files:**
- Create: `client/src/App.tsx`

- [ ] **Step 1: Implement the main App component**

`client/src/App.tsx`:
```tsx
import { useState } from "react";
import InputForm from "./components/InputForm";
import StatsCards from "./components/StatsCards";
import EquityChart from "./components/EquityChart";
import TradeTable from "./components/TradeTable";
import type { BacktestRequest, BacktestResponse } from "./types";

export default function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResponse | null>(null);

  const handleSubmit = async (params: BacktestRequest) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Unknown error");
        return;
      }

      setResult(data as BacktestResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Options Strategy Backtest
        </h1>
        <p className="text-gray-500 mb-6">
          Buy & Hold vs Cash Secured Put (ATM)
        </p>

        <InputForm onSubmit={handleSubmit} loading={loading} />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
            {error}
          </div>
        )}

        {result && (
          <>
            <StatsCards
              buyAndHold={result.buyAndHold.stats}
              sellPut={result.sellPut.stats}
            />
            <EquityChart
              buyAndHold={result.buyAndHold.equityCurve}
              sellPut={result.sellPut.equityCurve}
            />
            <TradeTable trades={result.trades} />
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/App.tsx && git commit -m "feat: App component wiring all pieces together"
```

---

### Task 13: End-to-End Verification

- [ ] **Step 1: Start the full dev environment**

```bash
cd /Users/edy/Desktop/demoes/options && pnpm dev
```

Expected: Server on `http://localhost:3000`, Client on `http://localhost:5173`

- [ ] **Step 2: Open browser and test**

Open `http://localhost:5173`. Fill in:
- Ticker: `SPY`
- Start: `2023-01-01`
- End: `2024-01-01`
- Capital: `100000`
- Period: `Monthly`

Click "Run Backtest". Verify:
1. Statistics cards show values for both strategies
2. Equity curve chart renders two lines
3. Trade table shows individual Sell Put trades with P&L

- [ ] **Step 3: Test edge cases in browser**

Test with:
- Invalid ticker (e.g., `ZZZZZ`) — should show error message
- Very short date range (1 week) — should still work
- Small capital (e.g., `$100`) with expensive stock — should handle 0-contract case

- [ ] **Step 4: Fix any issues found, then commit**

```bash
git add -A && git commit -m "feat: end-to-end options backtest tool complete"
```
