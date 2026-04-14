import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { EquityPoint } from "../types";

interface EquityChartProps {
  buyAndHold: EquityPoint[];
  sellPut: EquityPoint[];
}

export default function EquityChart({ buyAndHold, sellPut }: EquityChartProps) {
  const dateMap = new Map<string, { date: string; bh?: number; sp?: number }>();

  for (const point of buyAndHold) {
    dateMap.set(point.date, { date: point.date, bh: point.value });
  }
  for (const point of sellPut) {
    const existing = dateMap.get(point.date);
    if (existing) {
      existing.sp = point.value;
    } else {
      dateMap.set(point.date, { date: point.date, sp: point.value });
    }
  }

  const data = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4">Equity Curve</h2>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(d: string) => d.slice(5)} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => "$" + v.toLocaleString()} />
          <Tooltip formatter={(value: number) => ["$" + value.toFixed(2)]} labelFormatter={(label: string) => label} />
          <Legend />
          <Line type="monotone" dataKey="bh" name="Buy & Hold" stroke="#2563eb" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="sp" name="Sell Put" stroke="#16a34a" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
