import Fastify from "fastify";
import cors from "@fastify/cors";
import { fetchPrices } from "./yahoo.js";
import { runBacktest } from "./backtest.js";
import type { BacktestRequest } from "./types.js";

const server = Fastify({ logger: true });

await server.register(cors, { origin: true });

server.post<{ Body: BacktestRequest }>("/api/backtest", async (request, reply) => {
  const { ticker, startDate, endDate, initialCapital, period, riskFreeRate, delta, ivPremium, volWindow, commissionPerContract, spreadPct, cashInterestEnabled, cashInterestRate } = request.body;

  if (!ticker || !startDate || !endDate || !initialCapital || !period) {
    return reply.status(400).send({ error: "Missing required parameters" });
  }

  if (initialCapital <= 0) {
    return reply.status(400).send({ error: "Initial capital must be positive" });
  }

  if (new Date(endDate) <= new Date(startDate)) {
    return reply.status(400).send({ error: "End date must be after start date" });
  }

  const validPeriods = ["weekly", "biweekly", "monthly", "bimonthly", "quarterly"];
  if (!validPeriods.includes(period)) {
    return reply.status(400).send({ error: `Invalid period. Must be one of: ${validPeriods.join(", ")}` });
  }

  try {
    const prices = await fetchPrices(ticker, startDate, endDate);
    if (prices.length === 0) {
      return reply.status(400).send({ error: `No price data found for ${ticker} in the given date range` });
    }

    const rfRate = riskFreeRate ?? 0.03;
    const targetDelta = delta ?? 0.50;
    const ivPrem = ivPremium ?? 0.20;
    const volWin = volWindow ?? 30;
    const commission = commissionPerContract ?? 0.65;
    const spread = spreadPct ?? 0.03;
    const cashRate = cashInterestEnabled ? (cashInterestRate ?? 0) : 0;
    const result = runBacktest(prices, startDate, endDate, initialCapital, period, rfRate, targetDelta, ivPrem, volWin, commission, spread, cashRate);
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
