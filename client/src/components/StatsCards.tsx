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
          <div className="text-xs text-gray-400">Buy &amp; Hold</div>
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
      <Card label="Total Return" bh={formatPercent(buyAndHold.totalReturn)} sp={formatPercent(sellPut.totalReturn)} />
      <Card label="Annualized Return" bh={formatPercent(buyAndHold.annualizedReturn)} sp={formatPercent(sellPut.annualizedReturn)} />
      <Card label="Max Drawdown" bh={formatPercent(buyAndHold.maxDrawdown)} sp={formatPercent(sellPut.maxDrawdown)} />
      <Card label="Sharpe Ratio" bh={formatNumber(buyAndHold.sharpeRatio)} sp={formatNumber(sellPut.sharpeRatio)} />
      <Card label="Win Rate" bh="—" sp={sellPut.winRate != null ? formatPercent(sellPut.winRate) : "—"} />
    </div>
  );
}
