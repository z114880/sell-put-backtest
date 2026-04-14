# Transaction Cost Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace percentage-based transaction cost with fixed commission + bid-ask spread to match real IBKR trading costs.

**Architecture:** Delete `transactionCostPct` from all types and replace with `commissionPerContract` ($/contract) and `spreadPct` (ratio). Update backtest engine to use spread-adjusted mid-prices for opening/closing and fixed commission per contract. Update UI from 4-col to 5-col grid with two new inputs.

**Tech Stack:** TypeScript, Fastify, React, BS pricing model

---

### Task 1: Update server types

**Files:**
- Modify: `server/src/types.ts`

- [ ] **Step 1: Replace transactionCostPct with new fields in BacktestRequest**

Replace the `transactionCostPct` field and remove `PERIOD_DAYS`:

```typescript
export type Period = "weekly" | "biweekly" | "monthly" | "quarterly";

export interface BacktestRequest {
  ticker: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  period: Period;
  riskFreeRate: number;
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
```

- [ ] **Step 2: Commit**

```bash
git add server/src/types.ts
git commit -m "refactor: replace transactionCostPct with commissionPerContract and spreadPct in server types"
```

---

### Task 2: Update backtest engine — function signatures and opening logic

**Files:**
- Modify: `server/src/backtest.ts`

- [ ] **Step 1: Update runBacktest signature**

Change `runBacktest` (line 441) to accept new parameters:

```typescript
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
```

- [ ] **Step 2: Update runSellPut signature**

Change `runSellPut` (line 237) signature:

```typescript
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
```

- [ ] **Step 3: Update opening logic (sell to open)**

Replace the opening block (around lines 362-373). Old code:

```typescript
const putPrice = bsPutPrice(currentPrice, riskFreeRate, sigma, T);
const netPremium = putPrice * (1 - transactionCostPct);

strike = currentPrice;
cyclePremiumPerShare = netPremium;
cashInCycle = capital + netPremium * 100 * contracts;
```

New code:

```typescript
const putMidPrice = bsPutPrice(currentPrice, riskFreeRate, sigma, T);
const spreadCostPerShare = putMidPrice * spreadPct / 2;
const netPremiumPerShare = putMidPrice - spreadCostPerShare;
const openCommission = commissionPerContract * contracts;

strike = currentPrice;
cyclePremiumPerShare = netPremiumPerShare;
cashInCycle = capital + netPremiumPerShare * 100 * contracts - openCommission;
```

- [ ] **Step 4: Commit**

```bash
git add server/src/backtest.ts
git commit -m "refactor: update backtest signatures and opening logic for commission+spread model"
```

---

### Task 3: Update backtest engine — closing, force-settle, and PnL logic

**Files:**
- Modify: `server/src/backtest.ts`

- [ ] **Step 1: Update roll day closing logic (buy to close)**

Replace the settlement block (around lines 313-328). Old code:

```typescript
if (inCycle && isRollDay) {
  const intrinsic = Math.max(strike - currentPrice, 0);
  const closeCost = intrinsic * transactionCostPct;
  capital = cashInCycle - (intrinsic + closeCost) * 100 * contracts;
  const pnl = (cyclePremiumPerShare - intrinsic - closeCost) * 100 * contracts;
```

New code — compute put mid-price via BS (includes time value), add half spread, add commission:

```typescript
if (inCycle && isRollDay) {
  // Compute put mid-price at close time (may still have time value)
  const daysToExpiry = (new Date(cycleExpiryDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24);
  const T_close = daysToExpiry / 365;
  const putMidPrice = T_close > 0
    ? bsPutPrice(currentPrice, riskFreeRate, cycleSigma, T_close, strike)
    : Math.max(strike - currentPrice, 0);
  const closeSpreadCost = putMidPrice * spreadPct / 2;
  const closeCostPerShare = putMidPrice + closeSpreadCost;
  const closeCommission = commissionPerContract * contracts;
  capital = cashInCycle - closeCostPerShare * 100 * contracts - closeCommission;
  const pnl = cashInCycle - closeCostPerShare * 100 * contracts - closeCommission - (cashInCycle - cyclePremiumPerShare * 100 * contracts);
```

Simplify the PnL — it's the net of what we received minus what we paid out. The cleanest form:

```typescript
  const openCommission = commissionPerContract * contracts;
  // pnl = net premium received (after open spread + commission) - close cost (mid + spread + commission)
  // But openCommission was already subtracted when computing cashInCycle, so:
  const pnl = capital - (cashInCycle - cyclePremiumPerShare * 100 * contracts);
```

Wait — let's keep it cleaner. The full replacement for lines 313-330:

```typescript
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
```

Note: `capitalBefore` is capital before this cycle started (cashInCycle minus the premium we added). `pnl = capital - capitalBefore` gives us net profit from this cycle including all costs.

- [ ] **Step 2: Update force-settle at end date**

Replace the force-settle block (around lines 399-422). Old code:

```typescript
  if (inCycle) {
    const lastPrice = prices[endIdx].close;
    const lastDate = prices[endIdx].date;
    const intrinsic = Math.max(strike - lastPrice, 0);
    const closeCost = intrinsic * transactionCostPct;
    capital = cashInCycle - (intrinsic + closeCost) * 100 * contracts;
    const pnl = (cyclePremiumPerShare - intrinsic - closeCost) * 100 * contracts;
```

New code — same formula as roll day closing:

```typescript
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
```

The rest of the force-settle block (equityCurve update and trades.push) stays the same.

- [ ] **Step 3: Commit**

```bash
git add server/src/backtest.ts
git commit -m "refactor: update closing and force-settle logic for commission+spread model"
```

---

### Task 4: Update server API handler

**Files:**
- Modify: `server/src/index.ts`

- [ ] **Step 1: Update request destructuring and defaults**

Replace line 12:

```typescript
  const { ticker, startDate, endDate, initialCapital, period, riskFreeRate, transactionCostPct, cashInterestEnabled, cashInterestRate } = request.body;
```

With:

```typescript
  const { ticker, startDate, endDate, initialCapital, period, riskFreeRate, commissionPerContract, spreadPct, cashInterestEnabled, cashInterestRate } = request.body;
```

Replace lines 37-40:

```typescript
    const rfRate = riskFreeRate ?? 0.03;
    const txCost = transactionCostPct ?? 0;
    const cashRate = cashInterestEnabled ? (cashInterestRate ?? 0) : 0;
    const result = runBacktest(prices, startDate, endDate, initialCapital, period, rfRate, txCost, cashRate);
```

With:

```typescript
    const rfRate = riskFreeRate ?? 0.03;
    const commission = commissionPerContract ?? 0.65;
    const spread = spreadPct ?? 0.03;
    const cashRate = cashInterestEnabled ? (cashInterestRate ?? 0) : 0;
    const result = runBacktest(prices, startDate, endDate, initialCapital, period, rfRate, commission, spread, cashRate);
```

- [ ] **Step 2: Verify server compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/index.ts
git commit -m "refactor: update API handler for commission+spread parameters"
```

---

### Task 5: Update client types

**Files:**
- Modify: `client/src/types.ts`

- [ ] **Step 1: Replace transactionCostPct with new fields**

Replace `transactionCostPct: number;` with:

```typescript
  commissionPerContract: number;
  spreadPct: number;
```

Remove `PERIOD_DAYS` if it exists in client types (check first).

- [ ] **Step 2: Commit**

```bash
git add client/src/types.ts
git commit -m "refactor: update client types for commission+spread parameters"
```

---

### Task 6: Update InputForm UI

**Files:**
- Modify: `client/src/components/InputForm.tsx`

- [ ] **Step 1: Replace state variables**

Remove:

```typescript
const [transactionCostPct, setTransactionCostPct] = useState("2");
```

Add:

```typescript
const [commissionPerContract, setCommissionPerContract] = useState("0.65");
const [spreadPct, setSpreadPct] = useState("3");
```

- [ ] **Step 2: Update handleSubmit**

In the `onSubmit` call, remove:

```typescript
transactionCostPct: parseNum(transactionCostPct, 2) / 100,
```

Add:

```typescript
commissionPerContract: parseNum(commissionPerContract, 0.65),
spreadPct: parseNum(spreadPct, 3) / 100,
```

- [ ] **Step 3: Change grid to 5 columns**

Replace `grid-cols-4` with `grid-cols-5` in the grid div className.

- [ ] **Step 4: Replace Transaction Cost input with two new inputs**

Remove the entire Transaction Cost div (the one with label "Transaction Cost (%)"). Replace with two new divs:

Commission input:

```tsx
<div className="min-w-0">
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Commission ($/contract)
    <span className="relative inline-block ml-1 group">
      <span className="cursor-help text-gray-400 hover:text-gray-600">&#9432;</span>
      <span className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-56 bg-gray-800 text-white text-xs rounded px-3 py-2 z-10 leading-relaxed">
        每张期权合约的固定佣金。IBKR 标准费率为 $0.65/张，开仓和平仓各收一次。Schwab/TD 同为 $0.65，Robinhood 为 $0。
      </span>
    </span>
  </label>
  <input
    type="number"
    value={commissionPerContract}
    onChange={(e) => setCommissionPerContract(e.target.value)}
    onBlur={() => setCommissionPerContract(String(parseNum(commissionPerContract, 0.65)))}
    step={0.01}
    min={0}
    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
  />
</div>
```

Spread input:

```tsx
<div className="min-w-0">
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Bid-Ask Spread (%)
    <span className="relative inline-block ml-1 group">
      <span className="cursor-help text-gray-400 hover:text-gray-600">&#9432;</span>
      <span className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-56 bg-gray-800 text-white text-xs rounded px-3 py-2 z-10 leading-relaxed">
        实际成交价偏离 mid-price 的百分比。高流动性 ETF（SPY/QQQ）通常 1-3%，大盘个股 3-5%，低流动性标的可达 5-10%。卖出时少收 spread/2，买回时多付 spread/2。
      </span>
    </span>
  </label>
  <input
    type="number"
    value={spreadPct}
    onChange={(e) => setSpreadPct(e.target.value)}
    onBlur={() => setSpreadPct(String(parseNum(spreadPct, 3)))}
    step={0.1}
    min={0}
    max={50}
    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
  />
</div>
```

- [ ] **Step 5: Verify client compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/InputForm.tsx
git commit -m "feat: replace transaction cost input with commission and spread inputs"
```

---

### Task 7: End-to-end smoke test

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Test in browser**

Open the app. Verify:
1. The form shows 5 columns with Commission ($/contract) default 0.65 and Bid-Ask Spread (%) default 3
2. Hover tooltips display correctly on both new inputs
3. The old Transaction Cost field is gone
4. Run a backtest with QQQ, 2023-01-01 to 2026-04-13, $100,000, monthly
5. Equity curve renders, trades table shows, stats cards display
6. Try commission = 0, spread = 0 — should produce highest returns (no costs)
7. Try commission = 2, spread = 10 — should show noticeably lower returns

- [ ] **Step 3: Commit all remaining changes (if any)**

```bash
git add -A
git commit -m "feat: transaction cost model — fixed commission + bid-ask spread"
```
