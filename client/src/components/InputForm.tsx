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
          <label className="block text-sm font-medium text-gray-700 mb-1">Ticker</label>
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="SPY"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Initial Capital ($)</label>
          <input
            type="number"
            value={initialCapital}
            onChange={(e) => setInitialCapital(Number(e.target.value))}
            min={1}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
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
