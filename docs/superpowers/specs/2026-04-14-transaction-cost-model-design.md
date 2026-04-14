# Transaction Cost Model: Fixed Commission + Bid-Ask Spread

## Summary

Replace the single percentage-based `transactionCostPct` parameter with two realistic parameters that mirror actual IBKR trading costs: a fixed per-contract commission and a bid-ask spread percentage.

## Motivation

The current model applies a flat percentage to premium (on open) and intrinsic value (on close). Real option trading costs consist of:
1. **Fixed commission** — per-contract fee charged by the broker (IBKR: $0.65/contract)
2. **Bid-ask spread** — the gap between bid and ask prices, where sellers receive below mid-price and buyers pay above mid-price

The percentage model over-charges on large positions and under-charges on small ones. It also misses the structural difference between a fixed cost and a proportional cost.

## Parameters

### Removed

- `transactionCostPct` — deleted from both client and server types

### Added

| Parameter | Field | Type | Default | Unit |
|-----------|-------|------|---------|------|
| Commission per contract | `commissionPerContract` | number | 0.65 | USD |
| Bid-ask spread | `spreadPct` | number | 0.03 | ratio (3% input / 100) |

## Cost Formulas

### Opening a position (sell to open)

```
spreadCostPerShare = bsPutMidPrice * spreadPct / 2
netPremiumPerShare = bsPutMidPrice - spreadCostPerShare
totalCommission = commissionPerContract * contracts
cashInCycle = capital + netPremiumPerShare * 100 * contracts - totalCommission
```

The seller receives less than mid-price by half the spread.

### Closing a position (buy to close on roll day)

```
putMidPrice = BS price with remaining time (or intrinsic if T <= 0)
spreadCost = putMidPrice * spreadPct / 2
closeCostPerShare = putMidPrice + spreadCost
closeCommission = commissionPerContract * contracts
capital = cashInCycle - closeCostPerShare * 100 * contracts - closeCommission
```

The buyer pays more than mid-price by half the spread. The close cost is based on the put's current market value (mid-price via BS), not just intrinsic value. This is more realistic because roll day is not expiration — the put may still have time value.

### Force-settle at end date

Same as closing: BS mid-price + half spread + commission.

### PnL per trade

```
pnl = netPremiumReceived - closeCostTotal
    = (netPremiumPerShare * 100 * contracts - openCommission)
      - (closeCostPerShare * 100 * contracts + closeCommission)
```

## UI Changes

### Layout

- Grid changes from `grid-cols-4` to `grid-cols-5`
- The single Transaction Cost input is replaced by two inputs: Commission and Spread

### New inputs

**Commission ($/contract)**
- Default: 0.65
- Step: 0.01, Min: 0
- Hover tooltip: "每张期权合约的固定佣金。IBKR 标准费率为 $0.65/张，开仓和平仓各收一次。Schwab/TD 同为 $0.65，Robinhood 为 $0。"

**Bid-Ask Spread (%)**
- Default: 3
- Step: 0.1, Min: 0, Max: 50
- Hover tooltip: "实际成交价偏离 mid-price 的百分比。高流动性 ETF（SPY/QQQ）通常 1-3%，大盘个股 3-5%，低流动性标的可达 5-10%。卖出时少收 spread/2，买回时多付 spread/2。"
- Value is divided by 100 before sending to server (user enters 3, server receives 0.03)

### Removed inputs

- Transaction Cost (%) — deleted entirely

## File Changes

### server/src/types.ts
- Remove `transactionCostPct` from `BacktestRequest`
- Add `commissionPerContract: number` and `spreadPct: number`
- Remove unused `PERIOD_DAYS` constant

### server/src/index.ts
- Destructure new fields from request body
- Default values: `commissionPerContract ?? 0.65`, `spreadPct ?? 0.03`
- Pass to `runBacktest`

### server/src/backtest.ts
- `runBacktest` and `runSellPut` signatures: replace `transactionCostPct` with `commissionPerContract` and `spreadPct`
- Opening: compute spread cost per share, subtract commission total
- Closing (roll day): compute put mid-price via BS with remaining T, add half spread, add commission
- Force-settle: same formula as closing
- PnL calculation updated accordingly

### client/src/types.ts
- Mirror server type changes

### client/src/components/InputForm.tsx
- Remove `transactionCostPct` state
- Add `commissionPerContract` state (default "0.65") and `spreadPct` state (default "3")
- `handleSubmit`: pass `commissionPerContract` as number, `spreadPct` divided by 100
- Grid: `grid-cols-4` to `grid-cols-5`
- Two new inputs with hover tooltips using existing tooltip pattern

### No changes needed
- StatsCards, EquityChart, TradeTable — they consume response data, not request parameters
