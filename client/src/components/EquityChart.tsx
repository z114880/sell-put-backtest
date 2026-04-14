import { useState, useCallback, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceArea,
} from "recharts";
import type { EquityPoint } from "../types";

interface EquityChartProps {
  buyAndHold: EquityPoint[];
  sellPut: EquityPoint[];
}

interface ChartRow {
  date: string;
  bh?: number;
  sp?: number;
}

// Custom X-axis tick: Fridays rendered in red
function CustomXTick({ x, y, payload }: { x: number; y: number; payload: { value: string } }) {
  const dateStr = payload.value;
  const day = new Date(dateStr + "T00:00:00").getDay(); // 5 = Friday
  const isFriday = day === 5;
  const label = dateStr.slice(5); // MM-DD

  return (
    <text
      x={x}
      y={y + 12}
      textAnchor="middle"
      fontSize={12}
      fill={isFriday ? "#dc2626" : "#666"}
      fontWeight={isFriday ? 600 : 400}
    >
      {label}
    </text>
  );
}

export default function EquityChart({ buyAndHold, sellPut }: EquityChartProps) {
  const allData = useMemo(() => {
    const dateMap = new Map<string, ChartRow>();
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
    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [buyAndHold, sellPut]);

  // Zoom state
  const [left, setLeft] = useState<number>(0);
  const [right, setRight] = useState<number>(allData.length - 1);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);

  const isZoomed = left !== 0 || right !== allData.length - 1;

  const data = useMemo(
    () => allData.slice(left, right + 1),
    [allData, left, right]
  );

  // Compute Y domain with padding
  const [yMin, yMax] = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const row of data) {
      if (row.bh !== undefined) { min = Math.min(min, row.bh); max = Math.max(max, row.bh); }
      if (row.sp !== undefined) { min = Math.min(min, row.sp); max = Math.max(max, row.sp); }
    }
    const padding = (max - min) * 0.05 || 100;
    return [Math.floor(min - padding), Math.ceil(max + padding)];
  }, [data]);

  const findIndex = useCallback((dateLabel: string) => {
    return allData.findIndex((d) => d.date === dateLabel);
  }, [allData]);

  const handleMouseDown = useCallback((e: { activeLabel?: string }) => {
    if (e?.activeLabel) {
      setDragStart(findIndex(e.activeLabel));
      setDragEnd(null);
    }
  }, [findIndex]);

  const handleMouseMove = useCallback((e: { activeLabel?: string }) => {
    if (dragStart !== null && e?.activeLabel) {
      setDragEnd(findIndex(e.activeLabel));
    }
  }, [dragStart, findIndex]);

  const handleMouseUp = useCallback(() => {
    if (dragStart !== null && dragEnd !== null && dragStart !== dragEnd) {
      const newLeft = Math.min(dragStart, dragEnd);
      const newRight = Math.max(dragStart, dragEnd);
      if (newRight - newLeft >= 2) {
        setLeft(newLeft);
        setRight(newRight);
      }
    }
    setDragStart(null);
    setDragEnd(null);
  }, [dragStart, dragEnd]);

  const handleZoomOut = useCallback(() => {
    setLeft(0);
    setRight(allData.length - 1);
  }, [allData.length]);

  // Resolve drag labels for ReferenceArea
  const dragStartDate = dragStart !== null ? allData[dragStart]?.date : null;
  const dragEndDate = dragEnd !== null ? allData[dragEnd]?.date : null;

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Equity Curve</h2>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <span className="font-semibold text-red-600">Fri</span>
            = Friday
          </span>
          <span className="text-xs text-gray-400">Drag to zoom</span>
          {isZoomed && (
            <button
              onClick={handleZoomOut}
              className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300"
            >
              Reset Zoom
            </button>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={data}
          onMouseDown={handleMouseDown as (e: unknown) => void}
          onMouseMove={handleMouseMove as (e: unknown) => void}
          onMouseUp={handleMouseUp}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={(props: Record<string, unknown>) => <CustomXTick x={props.x as number} y={props.y as number} payload={props.payload as { value: string }} />}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => "$" + v.toLocaleString()}
            domain={[yMin, yMax]}
          />
          <Tooltip
            formatter={(value: number) => ["$" + value.toFixed(2)]}
            labelFormatter={(label: string) => {
              const day = new Date(label + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
              return `${label} (${day})`;
            }}
          />
          <Legend />
          <Line type="monotone" dataKey="bh" name="Buy & Hold" stroke="#2563eb" dot={false} strokeWidth={2} />
          <Line type="stepAfter" dataKey="sp" name="Sell Put" stroke="#16a34a" dot={false} strokeWidth={2} />
          {dragStart !== null && dragEnd !== null && dragStartDate && dragEndDate && (
            <ReferenceArea
              x1={dragStartDate}
              x2={dragEndDate}
              strokeOpacity={0.3}
              fill="#2563eb"
              fillOpacity={0.1}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
