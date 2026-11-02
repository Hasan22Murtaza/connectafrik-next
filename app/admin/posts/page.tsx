"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, RefreshCw, Search } from "@/shared/icons";
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
  listAdminPosts,
  type AdminPostRow,
} from "@/features/admin/services/contentAdminService";
import {
  formatAdminDate,
  formatAdminProfile,
} from "@/features/admin/utils/format";

const LIMIT = 20;
const FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "removed", label: "Removed" },
] as const;

export default function AdminPostsPage() {
  const { isReady, authLoading } = useAdminAuth("/admin/posts");
  const [items, setItems] = useState<AdminPostRow[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    active: number;
    removed: number;
    last_7_days: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listAdminPosts({
        page,
        limit: LIMIT,
        filter,
        search: search || undefined,
        include_stats: true,
      });
      setItems(result.data);
      setTotal(result.count);
      setStats(result.stats);
    } catch {
      toast.error("Unable to load posts");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, filter, search]);

  useEffect(() => {
    if (!isReady) return;
    load();
  }, [isReady, load]);

  if (authLoading || !isReady) return <AdminLoading variant="table" />;

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Posts"
        description="Browse and review posts across CribsTalk."
        icon={FileText}
        action={
          <button type="button" onClick={load} className={AP.btnSecondary}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AdminStatCard label="Total" value={(stats?.total ?? 0).toLocaleString()} />
        <AdminStatCard label="Active" value={(stats?.active ?? 0).toLocaleString()} />
        <AdminStatCard label="Removed" value={(stats?.removed ?? 0).toLocaleString()} />
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
            placeholder="Search posts…"
            className={AP.searchInput}
          />
        </form>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setFilter(opt.value);
                setPage(0);
              }}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                filter === opt.value
                  ? "border-primary-600 bg-primary-600 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-primary-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <AdminTableCard title="All posts">
        {loading ? (
          <AdminTableSkeleton rows={8} cols={5} />
        ) : items.length === 0 ? (
          <AdminEmptyState
            icon={FileText}
            title="No posts found"
            description="Try another filter or search term."
          />
        ) : (
          <>
            <div className={AP.tableWrap}>
              <table className={AP.table}>
                <AdminTableHead>
                  <AdminTableHeadCell>Content</AdminTableHeadCell>
                  <AdminTableHeadCell>Author</AdminTableHeadCell>
                  <AdminTableHeadCell>Type</AdminTableHeadCell>
                  <AdminTableHeadCell>Status</AdminTableHeadCell>
                  <AdminTableHeadCell>Created</AdminTableHeadCell>
                  <AdminTableHeadCell>Action</AdminTableHeadCell>
                </AdminTableHead>
                <AdminTableBody>
                  {items.map((post) => (
                    <AdminTableRow key={post.id}>
                      <AdminTableCell>
                        <span className="line-clamp-2 max-w-xs text-gray-900">
                          {post.content?.trim() || "Untitled post"}
                        </span>
                      </AdminTableCell>
                      <AdminTableCell>
                        {post.author_id ? (
                          <Link href={`/admin/users/${post.author_id}`} className={AP.link}>
                            {formatAdminProfile(post.author)}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </AdminTableCell>
                      <AdminTableCell className="capitalize text-gray-600">
                        {post.media_type || "text"}
                      </AdminTableCell>
                      <AdminTableCell>
                        <AdminStatusBadge
                          status={post.is_deleted ? "removed" : "published"}
                        />
                      </AdminTableCell>
                      <AdminTableCell className="whitespace-nowrap text-gray-500">
                        {formatAdminDate(post.created_at)}
                      </AdminTableCell>
                      <AdminTableCell>
                        <Link href={`/admin/reports?search=${post.id}`} className={AP.link}>
                          Reports
                        </Link>
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
