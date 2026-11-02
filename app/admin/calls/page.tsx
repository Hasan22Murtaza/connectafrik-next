"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Phone, RefreshCw, Search } from "@/shared/icons";
import toast from "react-hot-toast";
import { AdminLoading } from "@/features/admin/components/AdminLoading";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminStatCard } from "@/features/admin/components/AdminStatCard";
import { AdminEmptyState } from "@/features/admin/components/AdminEmptyState";
import { AdminStatusBadge } from "@/features/admin/components/AdminStatusBadge";
import {
  AdminTableBody,
  AdminTableCard,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeadCell,
  AdminTableRow,
} from "@/features/admin/components/AdminTable";
import { AdminTableSkeleton } from "@/features/admin/components/skeletons/AdminShimmerLoaders";
import { useAdminAuth } from "@/features/admin/hooks/useAdminAuth";
import { AP } from "@/features/admin/constants/adminLayout";
import {
  listAdminCalls,
  type AdminCallRow,
} from "@/features/admin/services/contentAdminService";
import {
  formatAdminDate,
  formatAdminDuration,
  formatAdminProfile,
} from "@/features/admin/utils/format";

const LIMIT = 20;
const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "ended", label: "Ended" },
  { value: "missed", label: "Missed" },
  { value: "failed", label: "Failed" },
] as const;

export default function AdminCallsPage() {
  const { isReady, authLoading } = useAdminAuth("/admin/calls");
  const [items, setItems] = useState<AdminCallRow[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    active: number;
    failed: number;
    missed: number;
    last_7_days: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [status, setStatus] =
    useState<(typeof STATUS_FILTERS)[number]["value"]>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listAdminCalls({
        page,
        limit: LIMIT,
        status,
        search: search || undefined,
        include_stats: true,
      });
      setItems(result.data);
      setTotal(result.count);
      setStats(result.stats);
    } catch {
      toast.error("Unable to load calls");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, status, search]);

  useEffect(() => {
    if (!isReady) return;
    load();
  }, [isReady, load]);

  if (authLoading || !isReady) return <AdminLoading variant="table" />;

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Calls"
        description="Monitor audio and video call sessions across CribsTalk."
        icon={Phone}
        action={
          <button type="button" onClick={load} className={AP.btnSecondary}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <AdminStatCard label="Total" value={(stats?.total ?? 0).toLocaleString()} />
        <AdminStatCard
          label="Active"
          value={(stats?.active ?? 0).toLocaleString()}
          highlight={(stats?.active ?? 0) > 0}
        />
        <AdminStatCard label="Failed" value={(stats?.failed ?? 0).toLocaleString()} />
        <AdminStatCard label="Missed" value={(stats?.missed ?? 0).toLocaleString()} />
        <AdminStatCard label="Last 7 days" value={(stats?.last_7_days ?? 0).toLocaleString()} />
      </div>

      <div className={`${AP.card} ${AP.cardPadding} mb-4 space-y-3`}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(0);
            setSearch(searchInput.trim());
          }}
          className="relative max-w-md"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by call ID…"
            className={AP.searchInput}
          />
        </form>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setStatus(opt.value);
                setPage(0);
              }}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                status === opt.value
                  ? "border-primary-600 bg-primary-600 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-primary-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <AdminTableCard title="Call sessions">
        {loading ? (
          <AdminTableSkeleton rows={8} cols={6} />
        ) : items.length === 0 ? (
          <AdminEmptyState
            icon={Phone}
            title="No calls found"
            description="Call sessions will appear here as they happen."
          />
        ) : (
          <>
            <div className={AP.tableWrap}>
              <table className={AP.table}>
                <AdminTableHead>
                  <AdminTableHeadCell>Initiator</AdminTableHeadCell>
                  <AdminTableHeadCell>Type</AdminTableHeadCell>
                  <AdminTableHeadCell>Participants</AdminTableHeadCell>
                  <AdminTableHeadCell>Started</AdminTableHeadCell>
                  <AdminTableHeadCell>Duration</AdminTableHeadCell>
                  <AdminTableHeadCell>Status</AdminTableHeadCell>
                </AdminTableHead>
                <AdminTableBody>
                  {items.map((call) => (
                    <AdminTableRow key={call.id}>
                      <AdminTableCell>
                        {call.created_by ? (
                          <Link href={`/admin/users/${call.created_by}`} className={AP.link}>
                            {formatAdminProfile(call.initiator)}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </AdminTableCell>
                      <AdminTableCell className="capitalize text-gray-600">
                        {call.call_type || "—"}
                      </AdminTableCell>
                      <AdminTableCell className="tabular-nums">
                        {call.participant_count}
                      </AdminTableCell>
                      <AdminTableCell className="whitespace-nowrap text-gray-500">
                        {formatAdminDate(call.started_at)}
                      </AdminTableCell>
                      <AdminTableCell className="tabular-nums text-gray-600">
                        {formatAdminDuration(call.duration_seconds)}
                      </AdminTableCell>
                      <AdminTableCell>
                        <AdminStatusBadge status={call.status} />
                      </AdminTableCell>
                    </AdminTableRow>
                  ))}
                </AdminTableBody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3">
              <p className="text-xs text-gray-500">
                Showing {items.length} of {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className={AP.btnSecondary}
                >
                  Previous
                </button>
                <span className="text-xs text-gray-500">
                  {page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className={AP.btnSecondary}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </AdminTableCard>
    </div>
  );
}
