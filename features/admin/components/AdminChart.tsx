"use client";

import { useMemo, useState } from "react";
import { AP } from "../constants/adminLayout";

/** Brand-aligned chart palette: orange primary + green accents + neutrals. */
const CHART_COLORS = [
  "bg-primary-600",
  "bg-[var(--african-green)]",
  "bg-primary-400",
  "bg-gray-700",
  "bg-primary-300",
  "bg-[var(--african-green-light)]",
  "bg-gray-400",
  "bg-amber-500",
];

const COLOR_HEX: Record<string, string> = {
  "bg-primary-600": "#ea580c",
  "bg-[var(--african-green)]": "#16a34a",
  "bg-primary-400": "#fb923c",
  "bg-gray-700": "#374151",
  "bg-primary-300": "#fdba74",
  "bg-[var(--african-green-light)]": "#22c55e",
  "bg-gray-400": "#9ca3af",
  "bg-amber-500": "#f59e0b",
};

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
        <h3 className="mb-4 text-sm font-medium text-gray-900">{title}</h3>
        <p className="py-12 text-center text-sm text-gray-400">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className={`${AP.card} ${AP.cardPadding}`}>
      <h3 className="mb-4 text-sm font-medium text-gray-900">{title}</h3>
      <div
        className="flex h-44 items-end gap-2 sm:gap-3"
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
              className="group flex min-w-0 flex-1 flex-col items-center gap-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(i)}
              onBlur={() => setActiveIndex(null)}
              aria-label={`${label}: ${value}`}
            >
              <span
                className={`text-xs font-medium text-gray-700 transition-opacity ${
                  isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                {value.toLocaleString()}
              </span>
              <div className="flex h-32 w-full items-end">
                <div
                  className={`w-full rounded-t-md transition-opacity ${CHART_COLORS[i % CHART_COLORS.length]} ${
                    isActive ? "opacity-100" : "opacity-85 group-hover:opacity-100"
                  }`}
                  style={{ height: `${height}%` }}
                />
              </div>
              <span className="w-full truncate text-center text-[10px] leading-tight text-gray-500 capitalize sm:text-xs">
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
        <h3 className="mb-4 text-sm font-medium text-gray-900">{title}</h3>
        <p className="py-12 text-center text-sm text-gray-400">No data available</p>
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
    .map((s) => `${COLOR_HEX[s.color] ?? "#9ca3af"} ${s.start}% ${s.start + s.pct}%`)
    .join(", ");

  return (
    <div className={`${AP.card} ${AP.cardPadding}`}>
      <h3 className="mb-4 text-sm font-medium text-gray-900">{title}</h3>
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <div
          className="relative h-36 w-36 shrink-0 rounded-full"
          style={{ background: `conic-gradient(${gradient})` }}
          role="img"
          aria-label={`${title} distribution chart`}
        >
          <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-white">
            <span className="text-2xl font-semibold text-gray-900">{total}</span>
            <span className="text-xs text-gray-500">Total</span>
          </div>
        </div>
        <ul className="min-w-0 w-full flex-1 space-y-2">
          {segments.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${s.color}`} />
                <span className="truncate capitalize text-gray-600">
                  {s.label.replace(/_/g, " ")}
                </span>
              </span>
              <span className="shrink-0 font-medium text-gray-900">
                {s.value} ({s.pct.toFixed(0)}%)
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
