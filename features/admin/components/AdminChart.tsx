"use client";

import { useMemo, useState } from "react";
import { AP } from "../constants/adminLayout";

const CHART_COLORS = [
  "bg-primary-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
];

interface AdminBarChartProps {
  title: string;
  data: Record<string, number>;
  emptyLabel?: string;
}

export function AdminBarChart({
  title,
  data,
  emptyLabel = "No data available",
}: AdminBarChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const entries = useMemo(
    () =>
      Object.entries(data)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1]),
    [data]
  );

  const max = useMemo(
    () => Math.max(...entries.map(([, v]) => v), 1),
    [entries]
  );

  if (entries.length === 0) {
    return (
      <div className={`${AP.card} ${AP.cardPadding}`}>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
        <p className="text-sm text-gray-400 text-center py-12">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className={`${AP.card} ${AP.cardPadding} ${AP.cardHover}`}>
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      <div
        className="flex items-end gap-2 sm:gap-3 h-44"
        role="img"
        aria-label={`${title} bar chart`}
      >
        {entries.map(([label, value], i) => {
          const height = Math.max((value / max) * 100, 8);
          const isActive = activeIndex === i;
          return (
            <button
              key={label}
              type="button"
              className="flex-1 min-w-0 flex flex-col items-center gap-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg"
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(i)}
              onBlur={() => setActiveIndex(null)}
              aria-label={`${label}: ${value}`}
            >
              <span
                className={`text-xs font-semibold text-gray-700 transition-opacity duration-200 ${
                  isActive ? "opacity-100" : "opacity-0 sm:opacity-0 group-hover:opacity-100"
                }`}
              >
                {value.toLocaleString()}
              </span>
              <div className="w-full flex items-end h-32">
                <div
                  className={`w-full rounded-t-lg transition-all duration-300 ease-out ${CHART_COLORS[i % CHART_COLORS.length]} ${
                    isActive ? "opacity-100 scale-y-105" : "opacity-80 group-hover:opacity-100"
                  }`}
                  style={{ height: `${height}%` }}
                />
              </div>
              <span className="text-[10px] sm:text-xs text-gray-500 capitalize truncate w-full text-center leading-tight">
                {label.replace(/_/g, " ")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface AdminDonutChartProps {
  title: string;
  data: Record<string, number>;
}

export function AdminDonutChart({ title, data }: AdminDonutChartProps) {
  const entries = useMemo(
    () => Object.entries(data).filter(([, v]) => v > 0),
    [data]
  );
  const total = useMemo(
    () => entries.reduce((sum, [, v]) => sum + v, 0),
    [entries]
  );

  if (entries.length === 0 || total === 0) {
    return (
      <div className={`${AP.card} ${AP.cardPadding}`}>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
        <p className="text-sm text-gray-400 text-center py-12">No data available</p>
      </div>
    );
  }

  let cumulative = 0;
  const segments = entries.map(([label, value], i) => {
    const pct = (value / total) * 100;
    const start = cumulative;
    cumulative += pct;
    return { label, value, pct, start, color: CHART_COLORS[i % CHART_COLORS.length] };
  });

  const gradient = segments
    .map((s) => {
      const colorMap: Record<string, string> = {
        "bg-primary-500": "#f97316",
        "bg-blue-500": "#3b82f6",
        "bg-emerald-500": "#10b981",
        "bg-amber-500": "#f59e0b",
        "bg-purple-500": "#a855f7",
        "bg-rose-500": "#f43f5e",
        "bg-cyan-500": "#06b6d4",
        "bg-indigo-500": "#6366f1",
      };
      return `${colorMap[s.color] ?? "#9ca3af"} ${s.start}% ${s.start + s.pct}%`;
    })
    .join(", ");

  return (
    <div className={`${AP.card} ${AP.cardPadding} ${AP.cardHover}`}>
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div
          className="relative w-36 h-36 rounded-full shrink-0"
          style={{
            background: `conic-gradient(${gradient})`,
          }}
          role="img"
          aria-label={`${title} distribution chart`}
        >
          <div className="absolute inset-4 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
            <span className="text-2xl font-bold text-gray-900">{total}</span>
            <span className="text-xs text-gray-500">Total</span>
          </div>
        </div>
        <ul className="flex-1 space-y-2 w-full min-w-0">
          {segments.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.color}`} />
                <span className="text-gray-600 capitalize truncate">
                  {s.label.replace(/_/g, " ")}
                </span>
              </span>
              <span className="font-medium text-gray-900 shrink-0">
                {s.value} ({s.pct.toFixed(0)}%)
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
