# Options Strategy Backtest: Buy & Hold vs Cash Secured Put

## Overview

A web-based backtesting tool that compares two US stock market strategies:

1. **Buy & Hold** — buy at start, hold until end
2. **Sell ATM Cash Secured Put** — repeatedly sell at-the-money puts, collect premium, settle at expiry

The tool fetches historical price data from Yahoo Finance, prices options using the Black-Scholes model, and displays comparative results with charts and statistics.

## Architecture

### Project Structure

```
options/
├── client/              # React + TypeScript (Vite)
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── types.ts     # Shared response types
│   │   └── App.tsx
│   └── package.json
├── server/              # Node.js + TypeScript (Fastify)
│   ├── src/
│   │   ├── backtest.ts  # Core backtest engine
│   │   ├── bs-model.ts  # Black-Scholes pricing
│   │   ├── yahoo.ts     # Yahoo Finance data fetching
│   │   └── index.ts     # API server
│   └── package.json
├── package.json         # pnpm workspace root
└── pnpm-workspace.yaml
```

### Tech Stack

- **Frontend:** React + TypeScript, Vite, Recharts, Tailwind CSS
- **Backend:** Fastify + TypeScript, yahoo-finance2
- **Package manager:** pnpm workspace
- **No testing, no database, no auth**

### API

Single endpoint:

```
POST /api/backtest
```

**Request:**
```json
{
  "ticker": "AAPL",
  "startDate": "2023-01-01",
  "endDate": "2024-01-01",
  "initialCapital": 10000,
  "period": "monthly"
}
```

`period` values: `"weekly"` (7d), `"biweekly"` (14d), `"monthly"` (30d), `"quarterly"` (90d)

**Response:**
```json
{
  "buyAndHold": {
    "equityCurve": [{ "date": "2023-01-03", "value": 10000 }, ...],
    "stats": {
      "totalReturn": 0.15,
      "annualizedReturn": 0.15,
      "maxDrawdown": -0.08,
      "sharpeRatio": 1.2
    }
  },
  "sellPut": {
    "equityCurve": [{ "date": "2023-01-03", "value": 10000 }, ...],
    "stats": {
      "totalReturn": 0.10,
      "annualizedReturn": 0.10,
      "maxDrawdown": -0.05,
      "sharpeRatio": 1.5,
      "winRate": 0.75
    }
  },
  "trades": [
    {
      "sellDate": "2023-01-03",
      "expiryDate": "2023-02-02",
      "strike": 150.00,
      "premium": 5.20,
      "expiryPrice": 155.00,
      "pnl": 5.20,
      "capitalAfter": 10520.00,
      "contracts": 1,
      "skipped": false
    }
  ]
}
```

## Backtest Engine

### Buy & Hold

1. On `startDate`, buy `Math.floor(initialCapital / closePrice)` shares at closing price
2. Remaining cash is idle (no interest)
3. Each trading day: portfolio value = shares x close price + idle cash
4. Final value on `endDate`

### Sell ATM Cash Secured Put

**Cycle:**

1. On cycle start date, use all available capital as margin
2. Number of contracts = `Math.floor(availableCapital / (currentPrice x 100))`
3. Sell ATM puts: strike = current closing price
4. Collect premium per contract from BS model
5. On expiry date, check closing price:
   - **OTM (price >= strike):** put expires worthless, keep premium. Available capital = previous capital + total premium
   - **ITM (price < strike):** assigned and immediately sold at market. Loss = (strike - price) x 100 x contracts. Available capital = previous capital + total premium - loss
6. Next cycle starts the next trading day after expiry
7. Repeat until `endDate`

**Cash secured constraint:** margin per contract = strike x 100. No leverage — total margin cannot exceed available capital.

**Premium reinvestment:** collected premiums add to available capital for the next cycle's margin, allowing more contracts over time if the strategy is profitable.

**Capital idle between cycles:** on non-cycle dates, the Sell Put equity curve value = available capital (cash, not affected by stock price movement).

### Volatility Calculation

For each sell point:

1. Collect closing prices from the 7 natural days preceding the current date
2. Compute log returns: `ln(P_t / P_{t-1})` for consecutive trading days within that window
3. Compute standard deviation of log returns
4. Annualize: `sigma = stddev x sqrt(252)`
5. If fewer than 2 trading days in the 7-day window, expand backward until 2 trading days are found

### Black-Scholes Put Pricing

```
d1 = [ln(S/K) + (r + sigma^2 / 2) * T] / (sigma * sqrt(T))
d2 = d1 - sigma * sqrt(T)
Put = K * e^(-r*T) * N(-d2) - S * N(-d1)
```

- S = K = current closing price (ATM)
- r = 0.03 (fixed risk-free rate)
- sigma = historical volatility from above
- T = period days / 365 (weekly=7/365, biweekly=14/365, monthly=30/365, quarterly=90/365)
- N() = standard normal CDF

### Period Day Mapping

| Period    | Days |
|-----------|------|
| weekly    | 7    |
| biweekly  | 14   |
| monthly   | 30   |
| quarterly | 90   |

Expiry date = sell date + period days. If expiry lands on a non-trading day, use the most recent prior trading day's close as settlement price.

## Statistics

Computed for both strategies:

| Metric | Formula |
|--------|---------|
| Total Return | (final - initial) / initial |
| Annualized Return | (1 + totalReturn)^(365 / totalDays) - 1 |
| Max Drawdown | max peak-to-trough decline in equity curve |
| Sharpe Ratio | (annualizedReturn - 0.03) / annualizedVolatility |
| Win Rate (Sell Put only) | profitable cycles / total cycles |

Annualized volatility for Sharpe: daily equity curve returns standard deviation x sqrt(252).

## Frontend

### Page Layout

```
+--------------------------------------------------+
|  Input Area                                       |
|  [Ticker] [Start] [End] [Capital] [Period v]      |
|                                   [Run Backtest]  |
+--------------------------------------------------+
|  Summary Cards                                    |
|  +----------+ +----------+ +----------+           |
|  | Total    | | Annual   | | Max      | ...       |
|  | Return   | | Return   | | Drawdown |           |
|  | BH / SP  | | BH / SP  | | BH / SP  |          |
|  +----------+ +----------+ +----------+           |
+--------------------------------------------------+
|  Equity Curve Chart (two lines overlay)           |
|  X: date   Y: portfolio value                     |
+--------------------------------------------------+
|  Trade Detail Table (Sell Put trades)             |
|  Date | Strike | Premium | Expiry Price | PnL     |
|  | Capital After | Contracts                      |
+--------------------------------------------------+
```

### UI Details

- **Chart:** Recharts LineChart with two series (Buy & Hold, Sell Put), shared X axis
- **Styling:** Tailwind CSS, clean minimal design
- **Loading:** spinner during backtest API call
- **Input validation:** dates must be valid, end > start, capital > 0, ticker non-empty

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid ticker | Backend returns error message, frontend shows alert |
| No data in date range | Backend returns error, frontend shows alert |
| Volatility = 0 | Skip that cycle, capital unchanged, trade marked `skipped: true` |
| Capital insufficient for 1 contract | Stop selling puts, remaining capital idle until end |
| Expiry on non-trading day | Use most recent prior trading day's close |
| < 2 trading days in 7-day vol window | Expand window backward until 2 trading days found |
