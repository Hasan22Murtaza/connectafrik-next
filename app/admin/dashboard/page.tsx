"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  Flag,
  MessageSquare,
  ArrowRight,
  UserPlus,
  Activity,
  BadgeCheck,
  Inbox,
  Clock,
  CheckCircle2,
} from '@/shared/icons';
import toast from "react-hot-toast";
import { AdminLoading } from "@/features/admin/components/AdminLoading";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminStatCard } from "@/features/admin/components/AdminStatCard";
import { AdminMotion } from "@/features/admin/components/AdminMotion";
import { AdminEmptyState } from "@/features/admin/components/AdminEmptyState";
import { AdminErrorState } from "@/features/admin/components/AdminErrorState";
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
import { listAdminFeedback } from "@/features/feedback/services/feedbackService";
import type { PostReportGroup, PostReportStats } from "@/lib/reports/types";
import type { FeedbackStats, FeedbackWithUser } from "@/lib/feedback/types";

const QUICK_LINKS = [
  {
    href: "/admin/users",
    label: "Manage users",
    description: "Search, suspend, or review members",
    icon: Users,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50",
  },
  {
    href: "/admin/reports",
    label: "Moderate reports",
    description: "Review flagged posts and take action",
    icon: Flag,
    iconColor: "text-orange-600",
    iconBg: "bg-orange-50",
  },
  {
    href: "/admin/feedback",
    label: "Triage feedback",
    description: "Bugs, ideas, and support requests",
    icon: MessageSquare,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50",
  },
] as const;

interface DashboardData {
  users: AdminUserStats;
  reports: PostReportStats;
  feedback: FeedbackStats;
  recentReports: PostReportGroup[];
  recentFeedback: FeedbackWithUser[];
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
        limit: 5,
        include_stats: true,
      }),
      listAdminFeedback({
        status: "all",
        page: 0,
        limit: 5,
        include_stats: true,
      }),
    ])
      .then(([usersResult, reportsResult, feedbackResult]) => {
        if (!usersResult.stats) {
          throw new Error("Missing user stats");
        }
        setData({
          users: usersResult.stats,
          reports: reportsResult.stats,
          feedback: feedbackResult.stats,
          recentReports: reportsResult.items,
          recentFeedback: feedbackResult.items,
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
      <div className="max-w-6xl mx-auto">
        <AdminErrorState
          title="Dashboard unavailable"
          message="We couldn't load platform metrics. Verify your admin access and try again."
          onRetry={loadDashboard}
        />
      </div>
    );
  }

  const openReports = data.reports.pending + data.reports.under_review;
  const openFeedback = data.feedback.new + data.feedback.under_review;

  return (
    <div className="max-w-6xl mx-auto">
      <AdminPageHeader
        title="Dashboard"
        description="Overview of members, moderation, and feedback across CribsTalk."
        icon={LayoutDashboard}
        action={
          <Link href="/admin/reports" className={AP.btnPrimary}>
            <Flag className="w-4 h-4" aria-hidden="true" />
            Report queue ({openReports})
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {QUICK_LINKS.map((link, i) => {
          const Icon = link.icon;
          return (
            <AdminMotion key={link.href} delay={i * 80}>
              <Link
                href={link.href}
                className={`${AP.card} ${AP.cardPadding} ${AP.cardHover} ${AP.cardInteractive} block`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl ${link.iconBg}`}>
                    <Icon className={`w-5 h-5 ${link.iconColor}`} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm group-hover:text-primary-600 transition-colors">
                      {link.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      {link.description}
                    </p>
                  </div>
                  <ArrowRight
                    className="w-4 h-4 text-gray-300 group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1"
                    aria-hidden="true"
                  />
                </div>
              </Link>
            </AdminMotion>
          );
        })}
      </div>

      <div className={`${AP.statsGrid} mb-6 sm:mb-8`}>
        <AdminMotion delay={0}>
          <AdminStatCard
            label="Total members"
            value={data.users.total_users.toLocaleString()}
            icon={Users}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
          />
        </AdminMotion>
        <AdminMotion delay={60}>
          <AdminStatCard
            label="New today"
            value={data.users.new_users_today.toLocaleString()}
            icon={UserPlus}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
          />
        </AdminMotion>
        <AdminMotion delay={120}>
          <AdminStatCard
            label="Active (30 days)"
            value={data.users.active_users.toLocaleString()}
            icon={Activity}
            iconBg="bg-orange-50"
            iconColor="text-orange-600"
          />
        </AdminMotion>
        <AdminMotion delay={180}>
          <AdminStatCard
            label="Verified"
            value={data.users.verified_users.toLocaleString()}
            icon={BadgeCheck}
            iconBg="bg-indigo-50"
            iconColor="text-indigo-600"
          />
        </AdminMotion>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <AdminMotion delay={0}>
          <AdminStatCard
            label="Open reports"
            value={openReports}
            icon={Flag}
            iconBg="bg-orange-50"
            iconColor="text-orange-600"
            highlight={openReports > 0}
          />
        </AdminMotion>
        <AdminMotion delay={60}>
          <AdminStatCard
            label="Resolved reports"
            value={data.reports.resolved}
            icon={CheckCircle2}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
          />
        </AdminMotion>
        <AdminMotion delay={120}>
          <AdminStatCard
            label="Open feedback"
            value={openFeedback}
            icon={Inbox}
            iconBg="bg-sky-50"
            iconColor="text-sky-600"
            highlight={openFeedback > 0}
          />
        </AdminMotion>
        <AdminMotion delay={180}>
          <AdminStatCard
            label="New this week"
            value={data.users.new_users_this_week.toLocaleString()}
            icon={Clock}
            iconBg="bg-violet-50"
            iconColor="text-violet-600"
          />
        </AdminMotion>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 sm:mb-8">
        <AdminMotion delay={0}>
          <AdminTableCard
            title={
              <span className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-orange-600" aria-hidden="true" />
                Recent reports
              </span>
            }
            action={
              <Link
                href="/admin/reports"
                className="text-xs font-medium text-primary-600 hover:text-orange-500 transition-colors"
              >
                View all →
              </Link>
            }
          >
            {data.recentReports.length === 0 ? (
              <AdminEmptyState
                icon={Flag}
                title="No reports yet"
                description="Flagged posts will appear here for moderation."
              />
            ) : (
              <div className={AP.tableWrap}>
                <table className={AP.table}>
                  <AdminTableHead>
                    <AdminTableHeadCell>Post</AdminTableHeadCell>
                    <AdminTableHeadCell>Reports</AdminTableHeadCell>
                    <AdminTableHeadCell>Status</AdminTableHeadCell>
                    <AdminTableHeadCell>Updated</AdminTableHeadCell>
                  </AdminTableHead>
                  <AdminTableBody>
                    {data.recentReports.map((group) => (
                      <AdminTableRow key={group.post_id}>
                        <AdminTableCell>
                          <Link
                            href={`/admin/reports/${group.post_id}`}
                            className="text-primary-600 hover:text-orange-500 font-medium text-sm transition-colors line-clamp-1"
                          >
                            {group.post?.content?.trim()
                              ? group.post.content.length > 48
                                ? `${group.post.content.slice(0, 48).trimEnd()}…`
                                : group.post.content
                              : `Post ${group.post_id.slice(0, 8)}…`}
                          </Link>
                        </AdminTableCell>
                        <AdminTableCell className="tabular-nums">
                          {group.report_count}
                        </AdminTableCell>
                        <AdminTableCell className="capitalize text-xs text-gray-600">
                          {group.status.replace(/_/g, " ")}
                        </AdminTableCell>
                        <AdminTableCell className="text-gray-500 whitespace-nowrap">
                          {formatDate(group.last_reported_at)}
                        </AdminTableCell>
                      </AdminTableRow>
                    ))}
                  </AdminTableBody>
                </table>
              </div>
            )}
          </AdminTableCard>
        </AdminMotion>

        <AdminMotion delay={80}>
          <AdminTableCard
            title={
              <span className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                Recent feedback
              </span>
            }
            action={
              <Link
                href="/admin/feedback"
                className="text-xs font-medium text-primary-600 hover:text-orange-500 transition-colors"
              >
                View all →
              </Link>
            }
          >
            {data.recentFeedback.length === 0 ? (
              <AdminEmptyState
                icon={MessageSquare}
                title="No feedback yet"
                description="User feedback will appear here as it comes in."
              />
            ) : (
              <div className={AP.tableWrap}>
                <table className={AP.table}>
                  <AdminTableHead>
                    <AdminTableHeadCell>Subject</AdminTableHeadCell>
                    <AdminTableHeadCell>Type</AdminTableHeadCell>
                    <AdminTableHeadCell>Status</AdminTableHeadCell>
                    <AdminTableHeadCell>Submitted</AdminTableHeadCell>
                  </AdminTableHead>
                  <AdminTableBody>
                    {data.recentFeedback.map((item) => (
                      <AdminTableRow key={item.id}>
                        <AdminTableCell>
                          <Link
                            href={`/admin/feedback/${item.id}`}
                            className="text-primary-600 hover:text-orange-500 font-medium text-sm transition-colors line-clamp-1"
                          >
                            {item.title || item.message.slice(0, 48)}
                          </Link>
                        </AdminTableCell>
                        <AdminTableCell className="capitalize text-xs text-gray-600">
                          {item.feedback_type.replace(/_/g, " ")}
                        </AdminTableCell>
                        <AdminTableCell className="capitalize text-xs text-gray-600">
                          {item.status.replace(/_/g, " ")}
                        </AdminTableCell>
                        <AdminTableCell className="text-gray-500 whitespace-nowrap">
                          {formatDate(item.created_at)}
                        </AdminTableCell>
                      </AdminTableRow>
                    ))}
                  </AdminTableBody>
                </table>
              </div>
            )}
          </AdminTableCard>
        </AdminMotion>
      </div>
    </div>
  );
}
