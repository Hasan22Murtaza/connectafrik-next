"use client";

import { AP } from "../../constants/adminLayout";

function ShimmerBlock({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`animate-shimmer rounded-lg ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export function AdminSkeletonBase({ className = "" }: { className?: string }) {
  return <ShimmerBlock className={className} />;
}

export function AdminPageHeaderSkeleton() {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4" aria-busy="true" aria-label="Loading page header">
      <div className="min-w-0 flex-1 space-y-2">
        <ShimmerBlock className="h-7 w-48 sm:w-64" />
        <ShimmerBlock className="h-4 w-full max-w-md" />
      </div>
      <ShimmerBlock className="h-9 w-36 shrink-0 rounded-md" />
    </div>
  );
}

export function AdminStatCardSkeleton() {
  return (
    <div className={`${AP.card} ${AP.cardPadding}`} aria-hidden="true">
      <div className="mb-3 flex items-start justify-between">
        <ShimmerBlock className="h-3 w-20" />
        <ShimmerBlock className="h-3 w-10" />
      </div>
      <ShimmerBlock className="h-8 w-24" />
      <ShimmerBlock className="mt-2 h-3 w-28" />
    </div>
  );
}

export function AdminStatsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={AP.statsGrid} aria-busy="true" aria-label="Loading statistics">
      {Array.from({ length: count }).map((_, i) => (
        <AdminStatCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function AdminQuickLinkSkeleton() {
  return (
    <div className={`${AP.card} ${AP.cardPadding}`} aria-hidden="true">
      <div className="flex items-start gap-3">
        <ShimmerBlock className="w-10 h-10 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2 min-w-0">
          <ShimmerBlock className="h-4 w-28" />
          <ShimmerBlock className="h-3 w-full" />
        </div>
        <ShimmerBlock className="w-4 h-4 rounded shrink-0 mt-1" />
      </div>
    </div>
  );
}

export function AdminChartSkeleton() {
  return (
    <div className={`${AP.card} ${AP.cardPadding}`} aria-busy="true" aria-label="Loading chart">
      <ShimmerBlock className="h-5 w-40 mb-4" />
      <div className="flex items-end gap-2 h-40 pt-4">
        {[40, 65, 45, 80, 55, 70, 50].map((h, i) => (
          <ShimmerBlock key={i} className="flex-1 rounded-t-lg" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="flex gap-4 mt-4">
        <ShimmerBlock className="h-3 w-16" />
        <ShimmerBlock className="h-3 w-16" />
        <ShimmerBlock className="h-3 w-16" />
      </div>
    </div>
  );
}

export function AdminTableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className={`${AP.card} overflow-hidden`} aria-busy="true" aria-label="Loading table">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <ShimmerBlock className="h-5 w-32" />
        <ShimmerBlock className="h-4 w-16" />
      </div>
      <div className="p-4 space-y-3">
        <div className="flex gap-4 pb-2 border-b border-gray-50">
          {Array.from({ length: cols }).map((_, i) => (
            <ShimmerBlock key={i} className="h-3 flex-1 min-w-[60px]" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className="flex gap-4">
            {Array.from({ length: cols }).map((_, col) => (
              <ShimmerBlock key={col} className="h-4 flex-1 min-w-[60px]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className={`${AP.card} overflow-hidden`} aria-busy="true" aria-label="Loading list">
      <div className="px-4 py-3 border-b border-gray-100">
        <ShimmerBlock className="h-5 w-28" />
      </div>
      <ul className="divide-y divide-gray-50">
        {Array.from({ length: items }).map((_, i) => (
          <li key={i} className="px-4 py-3 space-y-2">
            <ShimmerBlock className="h-4 w-3/4 max-w-[200px]" />
            <ShimmerBlock className="h-3 w-full max-w-[280px]" />
            <ShimmerBlock className="h-3 w-24" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminProfileSkeleton() {
  return (
    <div className="flex items-center gap-3" aria-busy="true" aria-label="Loading profile">
      <ShimmerBlock className="w-9 h-9 rounded-full shrink-0" />
      <div className="hidden sm:block space-y-1.5 min-w-0">
        <ShimmerBlock className="h-3.5 w-24" />
        <ShimmerBlock className="h-3 w-32" />
      </div>
    </div>
  );
}

export function AdminSidebarSkeleton() {
  return (
    <aside className={AP.sidebar} aria-busy="true" aria-label="Loading navigation">
      <div className="px-2 mb-4">
        <ShimmerBlock className="h-6 w-32 mb-1" />
        <ShimmerBlock className="h-3 w-20" />
      </div>
      <nav className="space-y-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5">
            <ShimmerBlock className="w-5 h-5 rounded shrink-0" />
            <ShimmerBlock className="h-4 flex-1" />
          </div>
        ))}
      </nav>
      <div className={AP.sectionDivider} />
      <div className="flex items-center gap-3 px-3 py-2.5">
        <ShimmerBlock className="w-5 h-5 rounded shrink-0" />
        <ShimmerBlock className="h-4 w-16" />
      </div>
    </aside>
  );
}

export function AdminNavPillsSkeleton() {
  return (
    <div className="lg:hidden border-b border-gray-100 bg-white/90 px-3 py-2 flex gap-2 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <ShimmerBlock key={i} className="h-8 w-20 rounded-full shrink-0" />
      ))}
    </div>
  );
}

export function AdminDashboardSkeleton() {
  return (
    <div className="mx-auto max-w-6xl" aria-busy="true" aria-label="Loading dashboard">
      <AdminPageHeaderSkeleton />
      <div className="mb-8">
        <ShimmerBlock className="mb-3 h-4 w-20" />
        <AdminStatsGridSkeleton count={6} />
      </div>
      <div className="mb-8">
        <AdminTableSkeleton rows={6} cols={6} />
      </div>
      <AdminTableSkeleton rows={5} cols={6} />
    </div>
  );
}

export function AdminMonitoringSkeleton() {
  return (
    <div className="max-w-6xl mx-auto" aria-busy="true" aria-label="Loading monitoring">
      <AdminPageHeaderSkeleton />
      <div className={`${AP.card} ${AP.cardPadding} mb-6 flex flex-wrap gap-2`}>
        {Array.from({ length: 4 }).map((_, i) => (
          <ShimmerBlock key={i} className="h-9 w-20 rounded-xl" />
        ))}
        <ShimmerBlock className="h-9 w-28 rounded-xl ml-auto" />
      </div>
      <div className="mb-6">
        <AdminStatsGridSkeleton count={4} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <AdminStatCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <AdminChartSkeleton />
        <AdminChartSkeleton />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <AdminListSkeleton items={6} />
        <AdminTableSkeleton rows={6} cols={5} />
      </div>
    </div>
  );
}

export function AdminUsersPageSkeleton() {
  return (
    <div className="max-w-6xl mx-auto" aria-busy="true" aria-label="Loading users">
      <AdminPageHeaderSkeleton />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <AdminStatCardSkeleton key={i} />
        ))}
      </div>
      <div className={`${AP.card} ${AP.cardPadding} mb-4 space-y-3`}>
        <ShimmerBlock className="h-10 w-full max-w-md rounded-xl" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <ShimmerBlock key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      </div>
      <AdminTableSkeleton rows={10} cols={9} />
    </div>
  );
}

export function AdminUserDetailSkeleton() {
  return (
    <div className="max-w-6xl mx-auto" aria-busy="true" aria-label="Loading user profile">
      <AdminPageHeaderSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${AP.card} ${AP.cardPadding} lg:col-span-1 space-y-4`}>
          <div className="flex flex-col items-center text-center space-y-3">
            <ShimmerBlock className="w-24 h-24 rounded-full" />
            <ShimmerBlock className="h-6 w-40" />
            <ShimmerBlock className="h-4 w-28" />
            <div className="flex gap-2">
              <ShimmerBlock className="h-6 w-16 rounded-full" />
              <ShimmerBlock className="h-6 w-16 rounded-full" />
            </div>
          </div>
        </div>
        <div className="lg:col-span-2 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`${AP.card} ${AP.cardPadding} space-y-2`}>
              <ShimmerBlock className="h-5 w-36" />
              <ShimmerBlock className="h-4 w-full" />
              <ShimmerBlock className="h-4 w-5/6" />
              <ShimmerBlock className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
