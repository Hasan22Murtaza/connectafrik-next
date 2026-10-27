"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Flag, Activity as ActivityIcon } from "@/shared/icons";
import toast from "react-hot-toast";
import { AdminLoading } from "@/features/admin/components/AdminLoading";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminStatCard } from "@/features/admin/components/AdminStatCard";
import { AdminEmptyState } from "@/features/admin/components/AdminEmptyState";
import { AdminErrorState } from "@/features/admin/components/AdminErrorState";
import { AdminStatusBadge } from "@/features/admin/components/AdminStatusBadge";
import {
  AdminRecentCallsCard,
  AdminSystemHealthCard,
} from "@/features/admin/components/AdminMonitoringSections";
import {
  AdminTableBody,
  AdminTableCard,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeadCell,
  AdminTableRow,
} from "@/features/admin/components/AdminTable";
import { useAdminAuth } from "@/features/admin/hooks/useAdminAuth";
import { AP } from "@/features/admin/constants/adminLayout";
import {
  AdminUserStats,
  listAdminUsers,
} from "@/features/marketplace/services/adminService";
import { listAdminReportGroups } from "@/features/social/services/reportService";
import {
  fetchMonitoringSnapshot,
  type MonitoringActivityEvent,
  type MonitoringCallRow,
  type MonitoringKpis,
  type MonitoringServiceHealth,
} from "@/features/admin/services/monitoringService";
import type { PostReportGroup, PostReportStats } from "@/lib/reports/types";

interface DashboardData {
  users: AdminUserStats;
  reports: PostReportStats;
  kpis: MonitoringKpis;
  recentActivity: MonitoringActivityEvent[];
  recentReports: PostReportGroup[];
  services: MonitoringServiceHealth[];
  recentCalls: MonitoringCallRow[];
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

function activityTypeLabel(type: string) {
  return type.replace(/_/g, " ");
}

function reportReasonLabel(group: PostReportGroup) {
  if (!group.latest_reason) return "Reported content";
  return String(group.latest_reason).replace(/_/g, " ");
}

function reportTargetLabel(group: PostReportGroup) {
  if (group.post?.content?.trim()) {
    const content = group.post.content.trim();
    return content.length > 56 ? `${content.slice(0, 56).trimEnd()}…` : content;
  }
  const author =
    group.post?.author?.full_name || group.post?.author?.username || null;
  if (author) return `Post by ${author}`;
  return `Post ${group.post_id.slice(0, 8)}…`;
}

function reportReporterLabel(group: PostReportGroup) {
  const reporter = group.latest_reporter;
  if (reporter?.full_name || reporter?.username) {
    return reporter.full_name || reporter.username || "Unknown";
  }
  return `${group.report_count} reporter${group.report_count === 1 ? "" : "s"}`;
}

export default function AdminDashboardPage() {
  const { isReady, authLoading } = useAdminAuth("/admin/dashboard");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadDashboard = React.useCallback(() => {
    setLoading(true);
    setError(false);

    Promise.all([
      listAdminUsers({ page: 0, limit: 1, include_stats: true }),
      listAdminReportGroups({
        status: "all",
        page: 0,
        limit: 8,
        include_stats: true,
      }),
      fetchMonitoringSnapshot({ range: "7d" }),
    ])
      .then(([usersResult, reportsResult, monitoring]) => {
        if (!usersResult.stats) {
          throw new Error("Missing user stats");
        }
        setData({
          users: usersResult.stats,
          reports: reportsResult.stats,
          kpis: monitoring.kpis,
          recentActivity: monitoring.activity_events.slice(0, 10),
          recentReports: reportsResult.items,
          services: monitoring.services,
          recentCalls: monitoring.recent_calls,
        });
      })
      .catch(() => {
        setError(true);
        toast.error("Admin access required or dashboard unavailable");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isReady) return;
    loadDashboard();
  }, [isReady, loadDashboard]);

  if (authLoading || (loading && !data)) {
    return <AdminLoading variant="dashboard" />;
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-6xl">
        <AdminErrorState
          title="Dashboard unavailable"
          message="We couldn't load platform metrics. Verify your admin access and try again."
          onRetry={loadDashboard}
        />
      </div>
    );
  }

  const openReports = data.reports.pending + data.reports.under_review;
  const pendingReports = data.recentReports.filter(
    (g) => g.status === "pending" || g.status === "under_review"
  );

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Dashboard"
        description="Overview of members, content, and moderation across CribsTalk."
        action={
          <Link href="/admin/reports" className={AP.btnPrimary}>
            Review reports
            {openReports > 0 ? ` (${openReports})` : ""}
          </Link>
        }
      />

      <section className="mb-8" aria-labelledby="overview-heading">
        <h2 id="overview-heading" className="mb-3 text-sm font-medium text-gray-900">
          Overview
        </h2>
        <div className={AP.statsGrid}>
          <AdminStatCard
            label="Total users"
            value={data.users.total_users.toLocaleString()}
            footnote={`${data.users.new_users_today.toLocaleString()} new today`}
          />
          <AdminStatCard
            label="Active users"
            value={data.users.active_users.toLocaleString()}
            footnote={`${data.kpis.online_users.toLocaleString()} online now`}
          />
          <AdminStatCard
            label="Posts"
            value={data.kpis.posts_in_period.toLocaleString()}
            footnote={`${data.kpis.reels_in_period.toLocaleString()} reels · 7d`}
          />
          <AdminStatCard
            label="Reports"
            value={openReports.toLocaleString()}
            highlight={openReports > 0}
            footnote={
              data.kpis.high_priority_reports > 0
                ? `${data.kpis.high_priority_reports} high priority`
                : `${data.reports.resolved.toLocaleString()} resolved`
            }
            footnoteVariant={
              data.kpis.high_priority_reports > 0 ? "danger" : "default"
            }
          />
          <AdminStatCard
            label="Calls"
            value={data.kpis.calls_in_period.toLocaleString()}
            footnote={`${data.kpis.active_calls.toLocaleString()} active now`}
          />
          <AdminStatCard
            label="TradeHub"
            value={data.kpis.listings_in_period.toLocaleString()}
            footnote="Listings · last 7 days"
          />
        </div>
      </section>

      <section className="mb-8" aria-labelledby="activity-heading">
        <AdminTableCard title={<span id="activity-heading">Recent activity</span>}>
          {data.recentActivity.length === 0 ? (
            <AdminEmptyState
              icon={ActivityIcon}
              title="No recent activity"
              description="Platform events from the last 7 days will appear here."
            />
          ) : (
            <div className={AP.tableWrap}>
              <table className={AP.table}>
                <AdminTableHead>
                  <AdminTableHeadCell>User</AdminTableHeadCell>
                  <AdminTableHeadCell>Activity</AdminTableHeadCell>
                  <AdminTableHeadCell>Type</AdminTableHeadCell>
                  <AdminTableHeadCell>Date</AdminTableHeadCell>
                  <AdminTableHeadCell>Status</AdminTableHeadCell>
                  <AdminTableHeadCell>Action</AdminTableHeadCell>
                </AdminTableHead>
                <AdminTableBody>
                  {data.recentActivity.map((event) => (
                    <AdminTableRow key={event.id}>
                      <AdminTableCell>
                        <span className="font-medium text-gray-900">
                          {event.actor_name || event.actor_username || "System"}
                        </span>
                        {event.actor_username && event.actor_name && (
                          <span className="mt-0.5 block text-xs text-gray-500">
                            @{event.actor_username}
                          </span>
                        )}
                      </AdminTableCell>
                      <AdminTableCell>
                        <span className="line-clamp-2 text-gray-700">
                          {event.title}
                          {event.target_label ? ` · ${event.target_label}` : ""}
                        </span>
                      </AdminTableCell>
                      <AdminTableCell className="whitespace-nowrap capitalize text-gray-600">
                        {activityTypeLabel(event.event_type)}
                      </AdminTableCell>
                      <AdminTableCell className="whitespace-nowrap text-gray-500">
                        {formatDate(event.timestamp)}
                      </AdminTableCell>
                      <AdminTableCell>
                        <AdminStatusBadge status={event.status} />
                      </AdminTableCell>
                      <AdminTableCell>
                        {event.href ? (
                          <Link href={event.href} className={AP.link}>
                            View
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </AdminTableCell>
                    </AdminTableRow>
                  ))}
                </AdminTableBody>
              </table>
            </div>
          )}
        </AdminTableCard>
      </section>

      <section className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdminSystemHealthCard services={data.services} />
        <AdminRecentCallsCard calls={data.recentCalls} />
      </section>

      <section className="mb-4" aria-labelledby="reports-heading">
        <AdminTableCard
          title={<span id="reports-heading">Reports queue</span>}
          highlight={pendingReports.length > 0}
          action={
            <Link href="/admin/reports" className={AP.link}>
              Open queue
            </Link>
          }
        >
          {pendingReports.length === 0 ? (
            <AdminEmptyState
              icon={Flag}
              title="No pending reports"
              description="Flagged posts that need review will appear here."
            />
          ) : (
            <div className={AP.tableWrap}>
              <table className={AP.table}>
                <AdminTableHead>
                  <AdminTableHeadCell>Reason</AdminTableHeadCell>
                  <AdminTableHeadCell>Reported</AdminTableHeadCell>
                  <AdminTableHeadCell>Reporter</AdminTableHeadCell>
                  <AdminTableHeadCell>Status</AdminTableHeadCell>
                  <AdminTableHeadCell>Date</AdminTableHeadCell>
                  <AdminTableHeadCell>Action</AdminTableHeadCell>
                </AdminTableHead>
                <AdminTableBody>
                  {pendingReports.map((group) => (
                    <AdminTableRow key={group.post_id}>
                      <AdminTableCell className="whitespace-nowrap capitalize text-gray-700">
                        {reportReasonLabel(group)}
                      </AdminTableCell>
                      <AdminTableCell>
                        <span className="line-clamp-2 text-gray-900">
                          {reportTargetLabel(group)}
                        </span>
                      </AdminTableCell>
                      <AdminTableCell className="text-gray-600">
                        {reportReporterLabel(group)}
                      </AdminTableCell>
                      <AdminTableCell>
                        <AdminStatusBadge status={group.status} />
                      </AdminTableCell>
                      <AdminTableCell className="whitespace-nowrap text-gray-500">
                        {formatDate(group.last_reported_at)}
                      </AdminTableCell>
                      <AdminTableCell>
                        <Link
                          href={`/admin/reports/${group.post_id}`}
                          className={AP.link}
                        >
                          Review
                        </Link>
                      </AdminTableCell>
                    </AdminTableRow>
                  ))}
                </AdminTableBody>
              </table>
            </div>
          )}
        </AdminTableCard>
      </section>
    </div>
  );
}
