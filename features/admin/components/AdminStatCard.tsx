"use client";

import type { LucideIcon } from "@/shared/icons";
import { TrendingDown, TrendingUp, Minus } from "@/shared/icons";
import { AP } from "../constants/adminLayout";

interface AdminStatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  trend?: { value: number; label?: string };
  footnote?: string;
  footnoteVariant?: "default" | "danger";
  highlight?: boolean;
}

export function AdminStatCard({
  label,
  value,
  icon: Icon,
  iconColor = "text-primary-600",
  iconBg = "bg-primary-50",
  trend,
  footnote,
  footnoteVariant = "default",
  highlight = false,
}: AdminStatCardProps) {
  const trendUp = trend && trend.value > 0;
  const trendDown = trend && trend.value < 0;
  const trendFlat = trend && trend.value === 0;

  return (
    <div
      className={`${AP.card} ${AP.cardPadding} ${
        highlight ? "border-primary-300 bg-primary-50/30" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        {Icon ? (
          <div className={`p-2 rounded-md ${iconBg}`}>
            <Icon className={`w-4 h-4 ${iconColor}`} aria-hidden="true" />
          </div>
        ) : (
          <p className="text-xs font-medium text-gray-500">{label}</p>
        )}
        {trend && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-medium ${
              trendUp
                ? "text-emerald-600"
                : trendDown
                  ? "text-red-600"
                  : "text-gray-500"
            }`}
          >
            {trendUp && <TrendingUp className="w-3 h-3" aria-hidden="true" />}
            {trendDown && <TrendingDown className="w-3 h-3" aria-hidden="true" />}
            {trendFlat && <Minus className="w-3 h-3" aria-hidden="true" />}
            {trend.value > 0 ? "+" : ""}
            {trend.value}%
          </span>
        )}
      </div>
      {Icon && (
        <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      )}
      <p
        className={`text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums ${
          highlight ? "text-primary-700" : "text-gray-900"
        }`}
      >
        {value}
      </p>
      {trend?.label && !footnote && (
        <p className="text-xs text-gray-400 mt-1.5">{trend.label}</p>
      )}
      {footnote && (
        <p
          className={`text-xs mt-1.5 ${
            footnoteVariant === "danger" ? "text-red-600" : "text-gray-400"
          }`}
        >
          {footnote}
        </p>
      )}
    </div>
  );
}
