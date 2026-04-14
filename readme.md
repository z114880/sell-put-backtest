# Sell Put Backtest

期权策略回测工具，对比 **Buy & Hold** 与 **Cash-Secured Sell Put (ATM)** 两种策略在历史数据上的表现。

## 功能

- 输入股票代码、时间范围、初始资金等参数，自动从 Yahoo Finance 获取历史价格
- 使用 Black-Scholes 模型计算 ATM Put 期权理论价格
- 基于历史波动率定价，支持 weekly / biweekly / monthly / quarterly 滚动周期
- 可配置无风险利率和交易成本（模拟 bid-ask spread）
- 对比展示两种策略的权益曲线、年化收益、最大回撤、Sharpe Ratio 等指标
- 逐笔交易记录表

## 技术栈

- **前端**: React + TypeScript + Vite + Tailwind CSS + Recharts
- **后端**: Fastify + TypeScript + tsx
- **Monorepo**: pnpm workspace

## 快速开始

```bash
# 安装依赖
pnpm install

# 同时启动前端和后端开发服务器
pnpm dev

# 或分别启动
pnpm dev:server  # 后端 localhost:3000
pnpm dev:client  # 前端 localhost:5173
```

## 策略说明

### Buy & Hold

在起始日买入尽可能多的股票并持有至结束日。

### Cash-Secured Sell Put

在每个滚动日（周五）卖出 ATM Put 期权，收取权利金。到期时若股价低于行权价则承担亏损，否则赚取全部权利金。循环滚动直至回测结束。

- 行权价 = 卖出时的现价（ATM）
- 合约数 = floor(资金 / 现价 / 100)
- 权利金通过 Black-Scholes 公式计算，扣除交易成本后入账
- 持仓期间按 BS 模型逐日 mark-to-market
