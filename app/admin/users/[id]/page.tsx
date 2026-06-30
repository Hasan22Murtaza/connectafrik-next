"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShieldOff,
  ShoppingBag,
  Star,
  Store,
  Trash2,
  User,
  UserX,
  Wallet,
} from "lucide-react";
import toast from "react-hot-toast";
import { AdminErrorState } from "@/features/admin/components/AdminErrorState";
import { AdminLoading } from "@/features/admin/components/AdminLoading";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminStatCard } from "@/features/admin/components/AdminStatCard";
import { AdminStatusBadge } from "@/features/admin/components/AdminStatusBadge";
import { useAdminAuth } from "@/features/admin/hooks/useAdminAuth";
import { AP } from "@/features/admin/constants/adminLayout";
import {
  AdminUserDetail,
  deleteAdminUser,
  getAdminUser,
  suspendAdminUser,
  unsuspendAdminUser,
} from "@/features/marketplace/services/adminService";

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}

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

function accountTypeLabel(type: AdminUserDetail["account_type"]) {
  const labels: Record<AdminUserDetail["account_type"], string> = {
    buyer: "Buyer",
    seller: "Seller",
    both: "Buyer & Seller",
    none: "Member",
  };
  return labels[type];
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.id as string;
  const { isReady, authLoading } = useAdminAuth("/admin/users");

  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"suspend" | "unsuspend" | "delete" | null>(
    null
  );

  const loadUser = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError(false);
      const data = await getAdminUser(userId);
      setUser(data);
    } catch {
      setError(true);
      toast.error("Unable to load user profile");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!isReady) return;
    loadUser();
  }, [isReady, loadUser]);

  const handleConfirmAction = async () => {
    if (!user || !confirmAction) return;

    setActionLoading(true);
    try {
      if (confirmAction === "suspend") {
        const updated = await suspendAdminUser(user.id);
        setUser(updated);
        toast.success("User suspended");
      } else if (confirmAction === "unsuspend") {
        const updated = await unsuspendAdminUser(user.id);
        setUser(updated);
        toast.success("User reactivated");
      } else if (confirmAction === "delete") {
        await deleteAdminUser(user.id);
        toast.success("User deleted");
        router.push("/admin/users");
        return;
      }
      setConfirmAction(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Action failed — check admin permissions";
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading || !isReady) {
    return <AdminLoading variant="user-detail" />;
  }

  if (loading) {
    return <AdminLoading variant="user-detail" />;
  }

  if (error || !user) {
    return (
      <div className="max-w-6xl mx-auto">
        <AdminErrorState
          title="User not found"
          message="This profile may have been removed or you may not have access."
          onRetry={loadUser}
        />
      </div>
    );
  }

  const isSeller = user.account_type === "seller" || user.account_type === "both";
  const location = [user.address, user.city, user.state, user.country]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-4">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to users
        </Link>
      </div>

      <AdminPageHeader
        title={user.full_name || user.username}
        description={`@${user.username} · ${user.id.slice(0, 8)}…`}
        icon={User}
        action={
          <div className="flex items-center gap-2">
            <Link
              href={`/user/${user.id}`}
              target="_blank"
              className={AP.btnSecondary}
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              Public profile
            </Link>
            <button
              type="button"
              onClick={loadUser}
              disabled={loading}
              className={AP.btnSecondary}
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Refresh
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className={`${AP.card} ${AP.cardPadding} lg:col-span-1`}>
          <div className="flex flex-col items-center text-center">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.full_name}
                className="w-24 h-24 rounded-full object-cover ring-4 ring-primary-50 shadow-md mb-4"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-primary-50 flex items-center justify-center ring-4 ring-primary-50 shadow-md mb-4">
                <span className="text-3xl font-bold text-primary-600">
                  {user.full_name?.charAt(0) || user.username?.charAt(0) || "?"}
                </span>
              </div>
            )}

            <h2 className="text-lg font-bold text-gray-900">{user.full_name || "—"}</h2>
            <p className="text-sm text-gray-500 mb-3">@{user.username}</p>

            <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
              <AdminStatusBadge status={user.account_type} />
              {isSeller && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-xs font-semibold">
                  <Store className="w-3 h-3" aria-hidden="true" />
                  Seller
                </span>
              )}
              {user.is_verified && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                  <BadgeCheck className="w-3 h-3" aria-hidden="true" />
                  Verified
                </span>
              )}
              <AdminStatusBadge status={user.account_status} />
            </div>

            {user.bio && (
              <p className="text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-4 w-full">
                {user.bio}
              </p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className={`${AP.card} ${AP.cardPadding}`}>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Contact & Location</h3>
            <div className="space-y-1">
              {user.email && (
                <div className="flex items-center gap-2 text-sm text-gray-600 py-1">
                  <Mail className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
                  <span className="truncate">{user.email}</span>
                </div>
              )}
              {user.phone_number && (
                <div className="flex items-center gap-2 text-sm text-gray-600 py-1">
                  <Phone className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
                  <span>{user.phone_number}</span>
                </div>
              )}
              {location && (
                <div className="flex items-center gap-2 text-sm text-gray-600 py-1">
                  <MapPin className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
                  <span>{location}</span>
                </div>
              )}
              {!user.email && !user.phone_number && !location && (
                <p className="text-sm text-gray-500">No contact information available</p>
              )}
            </div>
          </div>

          <div className={`${AP.card} ${AP.cardPadding}`}>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Account Details</h3>
            <DetailRow label="User ID" value={<span className="font-mono text-xs">{user.id}</span>} />
            <DetailRow label="Account type" value={accountTypeLabel(user.account_type)} />
            <DetailRow label="Platform role" value={user.platform_role} />
            {user.seller_tier && (
              <DetailRow label="Seller tier" value={user.seller_tier} />
            )}
            <DetailRow
              label="Verification"
              value={
                <AdminStatusBadge
                  status={user.is_verified ? "verified" : "unverified"}
                />
              }
            />
            <DetailRow label="Join date" value={formatDate(user.created_at)} />
            <DetailRow label="Last login" value={formatDate(user.last_login)} />
            <DetailRow
              label="Account status"
              value={<AdminStatusBadge status={user.account_status} />}
            />
          </div>
        </div>
      </div>

      <div className={`${AP.statsGrid} mb-6`}>
        <AdminStatCard
          label="Total Orders"
          value={user.total_orders.toLocaleString()}
          icon={ShoppingBag}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <AdminStatCard
          label="Total Reviews"
          value={user.total_reviews.toLocaleString()}
          icon={Star}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <AdminStatCard
          label="Transactions"
          value={user.total_transactions.toLocaleString()}
          icon={Globe}
          iconColor="text-teal-600"
          iconBg="bg-teal-50"
        />
        {isSeller && user.seller_stats && (
          <AdminStatCard
            label="Total Listings"
            value={user.seller_stats.total_listings.toLocaleString()}
            icon={Store}
            iconColor="text-violet-600"
            iconBg="bg-violet-50"
          />
        )}
      </div>

      {isSeller && user.seller_stats && (
        <div className={`${AP.card} ${AP.cardPadding} mb-6`}>
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Store className="w-4 h-4 text-violet-600" aria-hidden="true" />
            Seller Performance
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Listings</p>
              <p className="text-xl font-bold text-gray-900">
                {user.seller_stats.total_listings}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Active</p>
              <p className="text-xl font-bold text-gray-900">
                {user.seller_stats.active_listings}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Sold Items</p>
              <p className="text-xl font-bold text-gray-900">
                {user.seller_stats.sold_items}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Avg. Rating</p>
              <p className="text-xl font-bold text-gray-900 flex items-center gap-1">
                {user.seller_stats.average_rating != null ? (
                  <>
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" aria-hidden="true" />
                    {user.seller_stats.average_rating.toFixed(1)}
                  </>
                ) : (
                  "—"
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                <Wallet className="w-3 h-3" aria-hidden="true" />
                Earnings
              </p>
              <p className="text-xl font-bold text-gray-900">
                {user.seller_stats.total_earnings != null
                  ? user.seller_stats.total_earnings.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className={`${AP.card} ${AP.cardPadding} border-red-100`}>
        <h3 className="text-sm font-semibold text-red-700 mb-1 flex items-center gap-2">
          <UserX className="w-4 h-4" aria-hidden="true" />
          Account actions
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Suspend to block sign-in, or permanently delete this user and their auth account.
          Admin accounts cannot be modified.
        </p>
        <div className="flex flex-wrap gap-2">
          {user.account_status === "suspended" ? (
            <button
              type="button"
              onClick={() => setConfirmAction("unsuspend")}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <ShieldOff className="w-4 h-4" aria-hidden="true" />
              Reactivate account
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmAction("suspend")}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <UserX className="w-4 h-4" aria-hidden="true" />
              Suspend account
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmAction("delete")}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            Delete user
          </button>
        </div>
      </div>

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`${AP.card} shadow-2xl w-full max-w-md p-6`}>
            <h2 className="font-semibold text-lg mb-1">
              {confirmAction === "suspend" && "Suspend user"}
              {confirmAction === "unsuspend" && "Reactivate user"}
              {confirmAction === "delete" && "Delete user"}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {confirmAction === "suspend" &&
                `Suspend ${user.full_name || user.username}? They will be unable to sign in until reactivated.`}
              {confirmAction === "unsuspend" &&
                `Reactivate ${user.full_name || user.username}? They will be able to sign in again.`}
              {confirmAction === "delete" &&
                `Permanently delete ${user.full_name || user.username}? This removes their auth account and cannot be undone.`}
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
                {actionLoading
                  ? "Processing..."
                  : confirmAction === "delete"
                    ? "Delete permanently"
                    : confirmAction === "suspend"
                      ? "Suspend"
                      : "Reactivate"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={actionLoading}
                className={AP.btnSecondary}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
