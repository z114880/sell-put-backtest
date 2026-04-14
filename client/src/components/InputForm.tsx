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
  const [riskFreeRate, setRiskFreeRate] = useState(4.5);
  const [transactionCostPct, setTransactionCostPct] = useState(5);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ticker,
      startDate,
      endDate,
      initialCapital,
      period,
      riskFreeRate: riskFreeRate / 100,
      transactionCostPct: transactionCostPct / 100,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="grid gap-4 items-end grid-cols-4">
   
          <div className="min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">Ticker</label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="SPY"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">Initial Capital ($)</label>
            <input
              type="number"
              value={initialCapital}
              onChange={(e) => setInitialCapital(Number(e.target.value))}
              min={1}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">Option Period</label>
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
          <div className="min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">Risk-Free Rate (%)</label>
            <input
              type="number"
              value={riskFreeRate}
              onChange={(e) => setRiskFreeRate(Number(e.target.value))}
              step={0.1}
              min={0}
              max={20}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transaction Cost (%)
              <span className="relative inline-block ml-1 group">
                <span className="cursor-help text-gray-400 hover:text-gray-600">&#9432;</span>
                <span className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-56 bg-gray-800 text-white text-xs rounded px-3 py-2 z-10 leading-relaxed">
                  占期权权利金的百分比，模拟买卖价差 (bid-ask spread) 和佣金等交易摩擦。例如 5% 表示卖出 Put 后实际收到 95% 的理论权利金。
                </span>
              </span>
            </label>
            <input
              type="number"
              value={transactionCostPct}
              onChange={(e) => setTransactionCostPct(Number(e.target.value))}
              step={0.1}
              min={0}
              max={50}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="min-w-0">
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[38px] bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              {loading ? "Running..." : "Run Backtest"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
