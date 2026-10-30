'use client'

import React, { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DailyScreenTimeUsage, ScreenTimeDailyHistory } from '@/shared/types/family'
import { formatMinutes } from '@/lib/family/activity'

const RANGE_OPTIONS = [
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
] as const

const PRIMARY = 'var(--color-primary, #ea580c)'
const OVER_LIMIT = '#f59e0b'

function weekdayShort(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00.000Z`)
  return d.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })
}

function dayNumber(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00.000Z`)
  return String(d.getUTCDate())
}

function dayMonthLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00.000Z`)
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function niceCeil(value: number): number {
  if (value <= 0) return 10
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10
  return Math.ceil(nice * magnitude * 100) / 100
}

function scaleCeiling(peak: number, limit: number): number {
  const target = Math.max(peak, limit, 1)
  if (peak <= 0) return Math.max(niceCeil(limit || 10), 10)
  return Math.max(niceCeil(target * 1.08), target)
}

type ChartRow = {
  date: string
  label: string
  minutes: number
  fullLabel: string
}

type Props = {
  history: ScreenTimeDailyHistory | null
  rangeDays: number
  dailyLimitMinutes: number | null
  loading?: boolean
  onRangeChange: (days: number) => void
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: ChartRow }>
}) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-content">{row.fullLabel}</p>
      <p className="mt-0.5 tabular-nums text-content-secondary">{formatMinutes(row.minutes)}</p>
    </div>
  )
}

export function ScreenTimeUsageChart({
  history,
  rangeDays,
  dailyLimitMinutes,
  loading = false,
  onRangeChange,
}: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const daily = history?.daily ?? []

  const selected: DailyScreenTimeUsage | null = useMemo(() => {
    if (!selectedDate || !daily.length) return null
    return daily.find((d) => d.date === selectedDate) ?? null
  }, [daily, selectedDate])

  const todayKey = daily.length ? daily[daily.length - 1]?.date : null

  const chartData: ChartRow[] = useMemo(
    () =>
      daily.map((day, index) => {
        const label =
          rangeDays <= 7
            ? weekdayShort(day.date)
            : index === 0 ||
                index === daily.length - 1 ||
                index % (rangeDays <= 14 ? 2 : 5) === 0
              ? dayNumber(day.date)
              : ''
        return {
          date: day.date,
          label,
          minutes: day.minutes,
          fullLabel: dayMonthLabel(day.date),
        }
      }),
    [daily, rangeDays]
  )

  const peakMinutes = useMemo(
    () => Math.max(...daily.map((d) => d.minutes), 0),
    [daily]
  )

  const scaleMax = useMemo(() => {
    const limit =
      typeof dailyLimitMinutes === 'number' && dailyLimitMinutes > 0
        ? dailyLimitMinutes
        : 0
    return scaleCeiling(peakMinutes, limit)
  }, [peakMinutes, dailyLimitMinutes])

  const averageLabel = history
    ? formatMinutes(Math.round(history.average_minutes))
    : '0m'
  const totalLabel = history ? formatMinutes(history.total_minutes) : '0m'
  const selectedLabel = selected ? formatMinutes(selected.minutes) : averageLabel

  const barCategoryGap = rangeDays > 14 ? '18%' : rangeDays > 7 ? '24%' : '28%'

  return (
    <div className="space-y-3 rounded-[16px] border border-border-subtle bg-surface-secondary/50 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-content-secondary">
            Screen time
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-content">
            {selectedLabel}
          </p>
          <p className="mt-0.5 text-sm text-content-secondary">
            {selected
              ? dayMonthLabel(selected.date)
              : `Daily average · ${totalLabel} total`}
          </p>
        </div>
        <div
          className="inline-flex rounded-full bg-surface p-0.5 ring-1 ring-border-subtle"
          role="group"
          aria-label="Usage range filter"
        >
          {RANGE_OPTIONS.map((opt) => {
            const active = rangeDays === opt.days
            return (
              <button
                key={opt.days}
                type="button"
                disabled={loading}
                onClick={() => {
                  setSelectedDate(null)
                  onRangeChange(opt.days)
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                  active
                    ? 'bg-primary text-white'
                    : 'text-content-secondary hover:text-content'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {daily.length === 0 ? (
        <p className="py-10 text-center text-sm text-content-secondary">
          No usage yet in this range.
        </p>
      ) : (
        <div className={`h-56 w-full ${loading ? 'opacity-60' : ''}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 12, right: 8, left: 0, bottom: 4 }}
              barCategoryGap={barCategoryGap}
              onClick={(state) => {
                const date = (state?.activePayload?.[0]?.payload as ChartRow | undefined)?.date
                if (!date) return
                setSelectedDate((prev) => (prev === date ? null : date))
              }}
            >
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 4"
                stroke="currentColor"
                className="text-border-subtle"
                opacity={0.55}
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'currentColor', fontSize: 11 }}
                className="text-content-secondary"
                interval={0}
              />
              <YAxis
                domain={[0, scaleMax]}
                axisLine={false}
                tickLine={false}
                width={40}
                tick={{ fill: 'currentColor', fontSize: 11 }}
                className="text-content-secondary"
                tickFormatter={(v: number) => (v === 0 ? '0' : formatMinutes(Math.round(v)))}
              />
              <Tooltip
                cursor={{ fill: 'currentColor', opacity: 0.04 }}
                content={<ChartTooltip />}
              />
              {typeof dailyLimitMinutes === 'number' && dailyLimitMinutes > 0 ? (
                <ReferenceLine
                  y={dailyLimitMinutes}
                  stroke={PRIMARY}
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Limit ${formatMinutes(dailyLimitMinutes)}`,
                    position: 'insideTopRight',
                    fill: PRIMARY,
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                />
              ) : null}
              <Bar
                dataKey="minutes"
                radius={[8, 8, 0, 0]}
                maxBarSize={rangeDays > 14 ? 18 : rangeDays > 7 ? 28 : 44}
                isAnimationActive={!loading}
              >
                {chartData.map((row) => {
                  const isSelected = selectedDate === row.date
                  const isToday = row.date === todayKey && !selectedDate
                  const emphasize = isSelected || isToday
                  const overLimit =
                    typeof dailyLimitMinutes === 'number' &&
                    dailyLimitMinutes > 0 &&
                    row.minutes >= dailyLimitMinutes

                  return (
                    <Cell
                      key={row.date}
                      fill={overLimit ? OVER_LIMIT : PRIMARY}
                      fillOpacity={emphasize ? 1 : 0.55}
                      cursor="pointer"
                    />
                  )
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {history && history.total_minutes === 0 ? (
        <p className="text-xs text-content-secondary">
          Usage appears here as they spend time in CribsTalk.
        </p>
      ) : null}
    </div>
  )
}
