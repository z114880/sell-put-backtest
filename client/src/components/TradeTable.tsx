import type { Trade } from "../types";

interface TradeTableProps {
  trades: Trade[];
}

export default function TradeTable({ trades }: TradeTableProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Sell Put Trade Details</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-500 uppercase bg-gray-50">
            <tr>
              <th className="px-4 py-3">Sell Date</th>
              <th className="px-4 py-3">Expiry Date</th>
              <th className="px-4 py-3 text-right">Strike</th>
              <th className="px-4 py-3 text-right">Contracts</th>
              <th className="px-4 py-3 text-right">Premium</th>
              <th className="px-4 py-3 text-right">Expiry Price</th>
              <th className="px-4 py-3 text-right">P&amp;L</th>
              <th className="px-4 py-3 text-right">Capital After</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {trades.map((trade, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-3">{trade.sellDate}</td>
                <td className="px-4 py-3">{trade.expiryDate}</td>
                <td className="px-4 py-3 text-right">${trade.strike.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">{trade.contracts}</td>
                <td className="px-4 py-3 text-right">${trade.premium.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">${trade.expiryPrice.toFixed(2)}</td>
                <td className={`px-4 py-3 text-right font-medium ${trade.pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                  ${trade.pnl.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right">${trade.capitalAfter.toFixed(2)}</td>
                <td className="px-4 py-3">
                  {trade.skipped ? (
                    <span className="text-yellow-600">Skipped</span>
                  ) : trade.pnl >= 0 ? (
                    <span className="text-green-600">Win</span>
                  ) : (
                    <span className="text-red-600">Loss</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
