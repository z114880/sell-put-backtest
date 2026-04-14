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
          Buy &amp; Hold vs Cash Secured Put (ATM)
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
