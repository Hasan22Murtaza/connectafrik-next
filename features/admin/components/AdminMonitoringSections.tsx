"use client";

import Link from "next/link";
import { Flag, Phone, Shield } from "@/shared/icons";
import { AdminEmptyState } from "./AdminEmptyState";
import { AdminStatusBadge } from "./AdminStatusBadge";
import {
  AdminTableBody,
  AdminTableCard,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeadCell,
  AdminTableRow,
} from "./AdminTable";
import { AP } from "../constants/adminLayout";
import type {
  MonitoringAdminAction,
  MonitoringCallRow,
  MonitoringContentRow,
  MonitoringServiceHealth,
} from "../services/monitoringService";

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

function formatDuration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = seconds / 60;
  if (mins < 60) return `${mins.toFixed(1)} min`;
  return `${(mins / 60).toFixed(1)} hr`;
}

function healthTone(status: MonitoringServiceHealth["status"]) {
  switch (status) {
    case "healthy":
      return "border-[color-mix(in_srgb,var(--african-green)_35%,white)] bg-[color-mix(in_srgb,var(--african-green)_12%,white)] text-[var(--african-green-dark)]";
    case "degraded":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "down":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-gray-200 bg-gray-50 text-gray-600";
  }
}

export function AdminSystemHealthCard({
  services,
}: {
  services: MonitoringServiceHealth[];
}) {
  return (
    <AdminTableCard title="System health">
      {services.length === 0 ? (
        <AdminEmptyState
          icon={Shield}
          title="No health checks"
          description="Service health will appear when checks are available."
        />
      ) : (
        <ul className="divide-y divide-gray-100">
          {services.map((service) => (
            <li
              key={service.id}
              className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{service.label}</p>
                <p className="mt-0.5 text-xs text-gray-500">{service.detail}</p>
                <p className="mt-1 text-[11px] text-gray-400">
                  {formatDate(service.last_checked)}
                  {service.response_ms != null ? ` · ${service.response_ms} ms` : ""}
                </p>
              </div>
              <span
                className={`inline-flex shrink-0 rounded border px-2 py-0.5 text-xs font-medium capitalize ${healthTone(
                  service.status
                )}`}
              >
                {service.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </AdminTableCard>
  );
}

export function AdminRecentCallsCard({ calls }: { calls: MonitoringCallRow[] }) {
  return (
    <AdminTableCard title="Recent calls">
      {calls.length === 0 ? (
        <AdminEmptyState
          icon={Phone}
          title="No call sessions yet"
          description="Call activity will appear here as sessions are created."
        />
      ) : (
        <div className={AP.tableWrap}>
          <table className={AP.table}>
            <AdminTableHead>
              <AdminTableHeadCell>Initiator</AdminTableHeadCell>
              <AdminTableHeadCell>Type</AdminTableHeadCell>
              <AdminTableHeadCell>Started</AdminTableHeadCell>
              <AdminTableHeadCell>Duration</AdminTableHeadCell>
              <AdminTableHeadCell>Status</AdminTableHeadCell>
            </AdminTableHead>
            <AdminTableBody>
              {calls.slice(0, 8).map((call) => (
                <AdminTableRow key={call.id}>
                  <AdminTableCell>
                    {call.initiator_id ? (
                      <Link href={`/admin/users/${call.initiator_id}`} className={AP.link}>
                        {call.initiator_name || call.initiator_username || "User"}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </AdminTableCell>
                  <AdminTableCell className="capitalize text-gray-600">
                    {call.call_type}
                  </AdminTableCell>
                  <AdminTableCell className="whitespace-nowrap text-gray-500">
                    {formatDate(call.started_at)}
                  </AdminTableCell>
                  <AdminTableCell className="tabular-nums text-gray-600">
                    {formatDuration(call.duration_seconds)}
                  </AdminTableCell>
                  <AdminTableCell>
                    <AdminStatusBadge status={call.status} />
                  </AdminTableCell>
                </AdminTableRow>
              ))}
            </AdminTableBody>
          </table>
        </div>
      )}
    </AdminTableCard>
  );
}

export function AdminRecentContentCard({
  items,
}: {
  items: MonitoringContentRow[];
}) {
  return (
    <AdminTableCard
      title="Content & moderation"
      action={
        <Link href="/admin/reports" className={AP.link}>
          Open reports
        </Link>
      }
    >
      {items.length === 0 ? (
        <AdminEmptyState
          icon={Flag}
          title="No content activity"
          description="Recent posts, reels, listings, and reports will show here."
        />
      ) : (
        <div className={AP.tableWrap}>
          <table className={AP.table}>
            <AdminTableHead>
              <AdminTableHeadCell>Preview</AdminTableHeadCell>
              <AdminTableHeadCell>Creator</AdminTableHeadCell>
              <AdminTableHeadCell>Type</AdminTableHeadCell>
              <AdminTableHeadCell>Reports</AdminTableHeadCell>
              <AdminTableHeadCell>Status</AdminTableHeadCell>
              <AdminTableHeadCell>Action</AdminTableHeadCell>
            </AdminTableHead>
            <AdminTableBody>
              {items.slice(0, 10).map((item) => (
                <AdminTableRow key={`${item.content_type}:${item.id}`}>
                  <AdminTableCell>
                    <span className="line-clamp-1 max-w-[220px] text-gray-800">
                      {item.preview}
                    </span>
                  </AdminTableCell>
                  <AdminTableCell className="text-gray-600">
                    {item.creator_name || item.creator_username || "—"}
                  </AdminTableCell>
                  <AdminTableCell className="capitalize text-gray-600">
                    {item.content_type}
                  </AdminTableCell>
                  <AdminTableCell className="tabular-nums">{item.reports}</AdminTableCell>
                  <AdminTableCell>
                    <AdminStatusBadge status={item.status} />
                  </AdminTableCell>
                  <AdminTableCell>
                    {item.href ? (
                      <Link href={item.href} className={AP.link}>
                        {item.reports > 0 ? "Review" : "View"}
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
  );
}

export function AdminAuditActionsCard({
  actions,
}: {
  actions: MonitoringAdminAction[];
}) {
  return (
    <AdminTableCard title="Admin audit activity">
      {actions.length === 0 ? (
        <AdminEmptyState
          icon={Shield}
          title="No admin actions yet"
          description="Moderation decisions from the reports queue will appear here."
        />
      ) : (
        <div className={AP.tableWrap}>
          <table className={AP.table}>
            <AdminTableHead>
              <AdminTableHeadCell>Admin</AdminTableHeadCell>
              <AdminTableHeadCell>Action</AdminTableHeadCell>
              <AdminTableHeadCell>Target</AdminTableHeadCell>
              <AdminTableHeadCell>Date</AdminTableHeadCell>
            </AdminTableHead>
            <AdminTableBody>
              {actions.slice(0, 10).map((action) => (
                <AdminTableRow key={action.id}>
                  <AdminTableCell>
                    {action.admin_name || action.admin_username || "Admin"}
                  </AdminTableCell>
                  <AdminTableCell className="capitalize text-gray-700">
                    {action.action.replace(/_/g, " ")}
                  </AdminTableCell>
                  <AdminTableCell>
                    {action.href ? (
                      <Link href={action.href} className={AP.link}>
                        {action.target_label || action.target_id.slice(0, 8)}
                      </Link>
                    ) : (
                      action.target_label || action.target_id.slice(0, 8)
                    )}
                  </AdminTableCell>
                  <AdminTableCell className="whitespace-nowrap text-gray-500">
                    {formatDate(action.timestamp)}
                  </AdminTableCell>
                </AdminTableRow>
              ))}
            </AdminTableBody>
          </table>
        </div>
      )}
    </AdminTableCard>
  );
}
