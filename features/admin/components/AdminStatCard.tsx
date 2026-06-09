"use client";

import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { AP } from "../constants/adminLayout";

interface AdminStatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
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
      className={`${AP.card} ${AP.cardPadding} ${AP.cardHover} ${
        highlight ? "ring-1 ring-orange-200/60" : ""
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} aria-hidden="true" />
        </div>
        {trend && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full ${
              trendUp
                ? "bg-green-50 text-green-700"
                : trendDown
                  ? "bg-red-50 text-red-700"
                  : "bg-gray-100 text-gray-600"
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
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p
        className={`text-2xl sm:text-3xl font-bold tracking-tight ${
          highlight ? "text-orange-600" : "text-gray-900"
        }`}
      >
        {value}
      </p>
      {trend?.label && !footnote && (
        <p className="text-xs text-gray-400 mt-1">{trend.label}</p>
      )}
      {footnote && (
        <p
          className={`text-xs mt-1.5 font-medium ${
            footnoteVariant === "danger" ? "text-red-600" : "text-gray-400"
          }`}
        >
          {footnote}
        </p>
      )}
    </div>
  );
}
