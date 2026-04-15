import { useState } from "react";
import type { BacktestRequest, Period } from "../types";

interface InputFormProps {
  onSubmit: (params: BacktestRequest) => void;
  loading: boolean;
}

export default function InputForm({ onSubmit, loading }: InputFormProps) {
  const [ticker, setTicker] = useState("QQQ");
  const [startDate, setStartDate] = useState("2023-01-01");
  const [endDate, setEndDate] = useState("2026-04-13");
  const [initialCapital, setInitialCapital] = useState("100000");
  const [period, setPeriod] = useState<Period>("monthly");
  const [riskFreeRate, setRiskFreeRate] = useState("4.5");
  const [commissionPerContract, setCommissionPerContract] = useState("0.65");
  const [spreadPct, setSpreadPct] = useState("3");
  const [cashInterestEnabled, setCashInterestEnabled] = useState(false);
  const [cashInterestRate, setCashInterestRate] = useState("4.4");

  const parseNum = (v: string, fallback: number) => {
    const n = Number(v);
    return isNaN(n) ? fallback : n;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ticker,
      startDate,
      endDate,
      initialCapital: parseNum(initialCapital, 100000),
      period,
      riskFreeRate: parseNum(riskFreeRate, 4.5) / 100,
      commissionPerContract: parseNum(commissionPerContract, 0.65),
      spreadPct: parseNum(spreadPct, 3) / 100,
      cashInterestEnabled,
      cashInterestRate: parseNum(cashInterestRate, 4.4) / 100,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="-mx-1 px-1">
        <div className="grid gap-4 items-end grid-cols-5">
   
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
              onChange={(e) => setInitialCapital(e.target.value)}
              onBlur={() => setInitialCapital(String(parseNum(initialCapital, 100000)))}
              min={1}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">Option Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="w-full border border-gray-300 rounded px-3 py-2 pr-6 text-sm select-arrow"
            >
              <option value="weekly">Weekly (7d)</option>
              <option value="biweekly">Biweekly (14d)</option>
              <option value="monthly">Monthly (30d)</option>
              <option value="quarterly">Quarterly (90d)</option>
            </select>
          </div>
          <div className="min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Risk-Free Rate (%)
              <span className="relative inline-block ml-1 group">
                <span className="cursor-help text-gray-400 hover:text-gray-600">&#9432;</span>
                <span className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-56 bg-gray-800 text-white text-xs rounded px-3 py-2 z-10 leading-relaxed">
                  用于 Black-Scholes 期权定价模型的无风险利率，通常参考同期美国十年期国债收益率。影响 Put 权利金的理论定价。
                </span>
              </span>
            </label>
            <input
              type="number"
              value={riskFreeRate}
              onChange={(e) => setRiskFreeRate(e.target.value)}
              onBlur={() => setRiskFreeRate(String(parseNum(riskFreeRate, 4.5)))}
              step={0.1}
              min={0}
              max={20}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="min-w-0 flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cash Interest (%)
                <span className="relative inline-block ml-1 group">
                  <span className="cursor-help text-gray-400 hover:text-gray-600">&#9432;</span>
                  <span className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-56 bg-gray-800 text-white text-xs rounded px-3 py-2 z-10 leading-relaxed">
                    现金保证金的年化收益率，按交易日复利计算。模拟将闲置资金投入货币市场基金（如 SGOV）获得的利息收入。
                  </span>
                </span>
              </label>
              <input
                type="number"
                value={cashInterestRate}
                onChange={(e) => setCashInterestRate(e.target.value)}
                onBlur={() => setCashInterestRate(String(parseNum(cashInterestRate, 4.4)))}
                step={0.1}
                min={0}
                max={20}
                disabled={!cashInterestEnabled}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
              />
            </div>
            <label className="flex items-center gap-1 pb-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={cashInterestEnabled}
                onChange={(e) => setCashInterestEnabled(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-xs text-gray-500 whitespace-nowrap">Enable</span>
            </label>
          </div>
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
          <div className="min-w-0">
            <button
              type="submit"
              disabled={loading}
              className="w-[120px] h-[38px] bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              {loading ? "Running..." : "Run Backtest"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
