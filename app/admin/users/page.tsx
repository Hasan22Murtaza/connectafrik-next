"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BadgeCheck,
  Eye,
  RefreshCw,
  Search,
  ShoppingBag,
  Store,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import toast from "react-hot-toast";
import { AdminLoading } from "@/features/admin/components/AdminLoading";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminStatCard } from "@/features/admin/components/AdminStatCard";
import { AdminStatusBadge } from "@/features/admin/components/AdminStatusBadge";
import { AdminEmptyState } from "@/features/admin/components/AdminEmptyState";
import {
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeadCell,
  AdminTableRow,
} from "@/features/admin/components/AdminTable";
import { AdminTableSkeleton } from "@/features/admin/components/skeletons/AdminShimmerLoaders";
import { useAdminAuth } from "@/features/admin/hooks/useAdminAuth";
import { AP } from "@/features/admin/constants/adminLayout";
import {
  AdminUserFilter,
  AdminUserListItem,
  AdminUserSortField,
  AdminUserStats,
  deleteAdminUser,
  listAdminUsers,
  suspendAdminUser,
  unsuspendAdminUser,
} from "@/features/marketplace/services/adminService";

const LIMIT = 20;

const FILTER_OPTIONS: { value: AdminUserFilter; label: string }[] = [
  { value: "all", label: "All Users" },
  { value: "sellers", label: "Sellers Only" },
  { value: "buyers", label: "Buyers Only" },
  { value: "verified", label: "Verified" },
  { value: "unverified", label: "Unverified" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "new", label: "New (7 Days)" },
];

const SORTABLE_COLUMNS: { field: AdminUserSortField; label: string }[] = [
  { field: "full_name", label: "Full Name" },
  { field: "username", label: "Username" },
  { field: "created_at", label: "Join Date" },
  { field: "last_login", label: "Last Login" },
];

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

function UserAvatar({ user }: { user: AdminUserListItem }) {
  const initials =
    user.full_name?.charAt(0) || user.username?.charAt(0) || "?";

  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.full_name || user.username}
        className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-sm"
      />
    );
  }

  return (
    <div className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center ring-2 ring-white shadow-sm">
      <span className="text-sm font-semibold text-primary-600">{initials}</span>
    </div>
  );
}

function AccountTypeBadge({ type }: { type: AdminUserListItem["account_type"] }) {
  const labels: Record<AdminUserListItem["account_type"], string> = {
    buyer: "Buyer",
    seller: "Seller",
    both: "Buyer & Seller",
    none: "Member",
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <AdminStatusBadge status={type} />
      {(type === "seller" || type === "both") && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700 text-[10px] font-semibold uppercase tracking-wide">
          <Store className="w-3 h-3" aria-hidden="true" />
          Seller
        </span>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  const { isReady, authLoading } = useAdminAuth("/admin/users");
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [stats, setStats] = useState<AdminUserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<AdminUserFilter>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sortBy, setSortBy] = useState<AdminUserSortField>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [actionUser, setActionUser] = useState<AdminUserListItem | null>(null);
  const [confirmAction, setConfirmAction] = useState<"suspend" | "unsuspend" | "delete" | null>(
    null
  );
  const [actionLoading, setActionLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listAdminUsers({
        filter,
        search: search || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
        page,
        limit: LIMIT,
        include_stats: page === 0 && !search,
      });
      setUsers(result.data);
      setTotal(result.count);
      if (result.stats) {
        setStats(result.stats);
        setStatsLoading(false);
      }
    } catch {
      toast.error("Unable to load users — admin access required");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [filter, search, sortBy, sortDir, page]);

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const result = await listAdminUsers({
        page: 0,
        limit: 1,
        include_stats: true,
      });
      if (result.stats) setStats(result.stats);
    } catch {
      /* stats are optional on refresh failure */
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    loadUsers();
  }, [isReady, loadUsers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleSort = (field: AdminUserSortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
    setPage(0);
  };

  const handleRefresh = async () => {
    await Promise.all([loadUsers(), loadStats()]);
  };

  const openAction = (
    user: AdminUserListItem,
    action: "suspend" | "unsuspend" | "delete"
  ) => {
    setActionUser(user);
    setConfirmAction(action);
  };

  const handleConfirmAction = async () => {
    if (!actionUser || !confirmAction) return;

    setActionLoading(true);
    try {
      if (confirmAction === "suspend") {
        await suspendAdminUser(actionUser.id);
        toast.success("User suspended");
      } else if (confirmAction === "unsuspend") {
        await unsuspendAdminUser(actionUser.id);
        toast.success("User reactivated");
      } else {
        await deleteAdminUser(actionUser.id);
        toast.success("User deleted");
      }
      setConfirmAction(null);
      setActionUser(null);
      await Promise.all([loadUsers(), loadStats()]);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Action failed — check admin permissions";
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  };

  const SortIcon = useMemo(() => {
    return function SortIndicator({ field }: { field: AdminUserSortField }) {
      if (sortBy !== field) {
        return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" aria-hidden="true" />;
      }
      return sortDir === "asc" ? (
        <ArrowUp className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
      ) : (
        <ArrowDown className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
      );
    };
  }, [sortBy, sortDir]);

  if (authLoading || !isReady) {
    return <AdminLoading variant="users" />;
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="max-w-6xl mx-auto">
      <AdminPageHeader
        title="Users"
        description="Manage registered members, sellers, and buyers"
        icon={Users}
        action={
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className={AP.btnSecondary}
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {statsLoading ? (
          Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className={`${AP.card} ${AP.cardPadding} animate-pulse`}
              aria-hidden="true"
            >
              <div className="h-10 w-10 bg-gray-100 rounded-xl mb-3" />
              <div className="h-3 w-20 bg-gray-100 rounded mb-2" />
              <div className="h-8 w-16 bg-gray-100 rounded" />
            </div>
          ))
        ) : stats ? (
          <>
            <AdminStatCard
              label="Total Registered"
              value={stats.total_users.toLocaleString()}
              icon={Users}
              iconColor="text-blue-600"
              iconBg="bg-blue-50"
            />
            <AdminStatCard
              label="Total Buyers"
              value={stats.total_buyers.toLocaleString()}
              icon={ShoppingBag}
              iconColor="text-sky-600"
              iconBg="bg-sky-50"
            />
            <AdminStatCard
              label="Total Sellers"
              value={stats.total_sellers.toLocaleString()}
              icon={Store}
              iconColor="text-violet-600"
              iconBg="bg-violet-50"
              highlight
            />
            <AdminStatCard
              label="New Today"
              value={stats.new_users_today.toLocaleString()}
              icon={UserPlus}
              iconColor="text-emerald-600"
              iconBg="bg-emerald-50"
            />
            <AdminStatCard
              label="New This Week"
              value={stats.new_users_this_week.toLocaleString()}
              icon={UserCheck}
              iconColor="text-teal-600"
              iconBg="bg-teal-50"
            />
            <AdminStatCard
              label="Active Users"
              value={stats.active_users.toLocaleString()}
              icon={Activity}
              iconColor="text-orange-600"
              iconBg="bg-orange-50"
              footnote="Last 30 days"
            />
            <AdminStatCard
              label="Verified Users"
              value={stats.verified_users.toLocaleString()}
              icon={BadgeCheck}
              iconColor="text-indigo-600"
              iconBg="bg-indigo-50"
            />
          </>
        ) : null}
      </div>

      <div className={`${AP.card} ${AP.cardPadding} mb-4 space-y-4`}>
        <div className="relative max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, username, or email..."
            className={AP.searchInput}
            aria-label="Search users"
          />
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="User filters">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setFilter(opt.value);
                setPage(0);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                filter === opt.value
                  ? "bg-primary-600 text-white shadow-sm shadow-primary-600/20"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <p className="text-sm text-gray-500">
          {total.toLocaleString()} user{total !== 1 ? "s" : ""} found
        </p>
      </div>

      {loading ? (
        <AdminTableSkeleton rows={10} cols={9} />
      ) : (
        <div className={`${AP.card} overflow-hidden`}>
          {users.length === 0 ? (
            <AdminEmptyState
              icon={UserX}
              title="No users found"
              description="Try adjusting your search or filters."
            />
          ) : (
            <div className={`${AP.tableWrap} max-h-[70vh] overflow-y-auto`}>
              <table className={AP.table}>
                <AdminTableHead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm">
                  <AdminTableHeadCell>Photo</AdminTableHeadCell>
                  {SORTABLE_COLUMNS.map((col) => (
                    <AdminTableHeadCell key={col.field}>
                      <button
                        type="button"
                        onClick={() => handleSort(col.field)}
                        className="inline-flex items-center gap-1 hover:text-gray-900 transition-colors"
                      >
                        {col.label}
                        <SortIcon field={col.field} />
                      </button>
                    </AdminTableHeadCell>
                  ))}
                  <AdminTableHeadCell>Email</AdminTableHeadCell>
                  <AdminTableHeadCell>User ID</AdminTableHeadCell>
                  <AdminTableHeadCell>Account Type</AdminTableHeadCell>
                  <AdminTableHeadCell>Verification</AdminTableHeadCell>
                  <AdminTableHeadCell>Status</AdminTableHeadCell>
                  <AdminTableHeadCell>Actions</AdminTableHeadCell>
                </AdminTableHead>
                <AdminTableBody>
                  {users.map((user) => (
                    <AdminTableRow key={user.id} className="group">
                      <AdminTableCell>
                        <UserAvatar user={user} />
                      </AdminTableCell>
                      <AdminTableCell className="font-medium text-gray-900 whitespace-nowrap">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="hover:text-primary-600 transition-colors"
                        >
                          {user.full_name || "—"}
                        </Link>
                      </AdminTableCell>
                      <AdminTableCell className="text-gray-600 whitespace-nowrap">
                        @{user.username}
                      </AdminTableCell>
                      <AdminTableCell className="text-gray-500 whitespace-nowrap">
                        {formatDate(user.created_at)}
                      </AdminTableCell>
                      <AdminTableCell className="text-gray-500 whitespace-nowrap">
                        {formatDate(user.last_login)}
                      </AdminTableCell>
                      <AdminTableCell className="max-w-[180px] truncate text-gray-600">
                        {user.email || "—"}
                      </AdminTableCell>
                      <AdminTableCell className="font-mono text-xs text-gray-500">
                        {user.id.slice(0, 8)}…
                      </AdminTableCell>
                      <AdminTableCell>
                        <AccountTypeBadge type={user.account_type} />
                        {(user.account_type === "seller" || user.account_type === "both") && (
                          <p className="text-[11px] text-gray-400 mt-1">
                            {user.listings_count} listing
                            {user.listings_count !== 1 ? "s" : ""}
                          </p>
                        )}
                      </AdminTableCell>
                      <AdminTableCell>
                        <AdminStatusBadge
                          status={user.is_verified ? "verified" : "unverified"}
                        />
                      </AdminTableCell>
                      <AdminTableCell>
                        <AdminStatusBadge status={user.account_status} />
                      </AdminTableCell>
                      <AdminTableCell>
                        <div className="flex flex-col gap-1 min-w-[88px]">
                          <Link
                            href={`/admin/users/${user.id}`}
                            className="text-primary-600 hover:text-primary-700 text-xs flex items-center gap-0.5 font-medium transition-colors"
                          >
                            View <Eye className="w-3 h-3" aria-hidden="true" />
                          </Link>
                          {user.account_status === "suspended" ? (
                            <button
                              type="button"
                              onClick={() => openAction(user, "unsuspend")}
                              className="text-xs text-green-600 hover:text-green-700 font-medium text-left transition-colors"
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openAction(user, "suspend")}
                              className="text-xs text-amber-600 hover:text-amber-700 font-medium text-left transition-colors"
                            >
                              Suspend
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openAction(user, "delete")}
                            className="text-xs text-red-600 hover:text-red-700 font-medium text-left transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </AdminTableCell>
                    </AdminTableRow>
                  ))}
                </AdminTableBody>
              </table>
            </div>
          )}
        </div>
      )}

      {confirmAction && actionUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`${AP.card} shadow-2xl w-full max-w-md p-6`}>
            <h2 className="font-semibold text-lg mb-1">
              {confirmAction === "suspend" && "Suspend user"}
              {confirmAction === "unsuspend" && "Reactivate user"}
              {confirmAction === "delete" && "Delete user"}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {confirmAction === "suspend" &&
                `Suspend ${actionUser.full_name || actionUser.username}? They will be unable to sign in.`}
              {confirmAction === "unsuspend" &&
                `Reactivate ${actionUser.full_name || actionUser.username}?`}
              {confirmAction === "delete" &&
                `Permanently delete ${actionUser.full_name || actionUser.username}? This cannot be undone.`}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={actionLoading}
                className={`flex-1 px-4 py-2 text-white rounded-xl text-sm font-medium active:scale-[0.98] transition-all disabled:opacity-50 ${
                  confirmAction === "delete"
                    ? "bg-red-600 hover:bg-red-700"
                    : confirmAction === "suspend"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {actionLoading ? "Processing..." : "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmAction(null);
                  setActionUser(null);
                }}
                disabled={actionLoading}
                className={AP.btnSecondary}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className={AP.btnSecondary}
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page + 1} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className={AP.btnSecondary}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
