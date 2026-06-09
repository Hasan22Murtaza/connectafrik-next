"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Shield, Clock, ExternalLink, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { AdminLoading } from "@/features/admin/components/AdminLoading";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminEmptyState } from "@/features/admin/components/AdminEmptyState";
import { AdminMotion } from "@/features/admin/components/AdminMotion";
import { AdminListSkeleton } from "@/features/admin/components/skeletons/AdminShimmerLoaders";
import { useAdminAuth } from "@/features/admin/hooks/useAdminAuth";
import { AP } from "@/features/admin/constants/adminLayout";
import {
  listAdminDisputes,
  resolveDisputeAdmin,
  DISPUTE_REASONS,
} from "@/features/marketplace/services/disputeService";

export default function AdminDisputesPage() {
  const { isReady, authLoading } = useAdminAuth("/admin/disputes");
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [resolving, setResolving] = useState(false);

  const loadDisputes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listAdminDisputes();
      setDisputes(data);
    } catch {
      toast.error("Unable to load disputes — admin access required");
      setDisputes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    loadDisputes();
  }, [isReady, loadDisputes]);

  const selected = disputes.find((d) => d.id === selectedId);

  const handleResolve = async (outcome: "buyer_wins" | "seller_wins" | "partial") => {
    if (!selectedId || !resolutionNotes.trim()) {
      toast.error("Resolution notes are required");
      return;
    }
    if (outcome === "partial" && (!refundAmount || Number(refundAmount) <= 0)) {
      toast.error("Enter a valid partial refund amount");
      return;
    }

    setResolving(true);
    try {
      await resolveDisputeAdmin(selectedId, {
        outcome,
        resolution_notes: resolutionNotes.trim(),
        refund_amount: outcome === "partial" ? Number(refundAmount) : undefined,
      });
      toast.success("Dispute resolved");
      setSelectedId(null);
      setResolutionNotes("");
      setRefundAmount("");
      await loadDisputes();
    } catch {
      toast.error("Failed to resolve dispute");
    } finally {
      setResolving(false);
    }
  };

  if (authLoading || !isReady) {
    return <AdminLoading variant="disputes" />;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <AdminPageHeader
        title="Disputes"
        icon={Shield}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <AdminMotion delay={0} className="lg:col-span-1">
          {loading ? (
            <AdminListSkeleton items={6} />
          ) : (
            <div className={`${AP.card} overflow-hidden`}>
              <div className="px-4 py-3.5 border-b border-gray-100 bg-gray-50/80 font-medium text-sm">
                Open queue ({disputes.length})
              </div>
              {disputes.length === 0 ? (
                <AdminEmptyState
                  icon={CheckCircle2}
                  title="No open disputes"
                  description="All cases have been resolved. Great work!"
                />
              ) : (
                <ul className="divide-y divide-gray-50 max-h-[70vh] overflow-y-auto">
                  {disputes.map((d) => {
                    const order = d.orders;
                    const reason =
                      DISPUTE_REASONS.find((r) => r.value === d.reason)?.label ||
                      d.reason;
                    const slaBreached =
                      d.sla_seller_deadline &&
                      new Date(d.sla_seller_deadline) < new Date() &&
                      d.status === "awaiting_seller";

                    return (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(d.id)}
                          className={`w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-all duration-200 ${
                            selectedId === d.id
                              ? "bg-gradient-to-r from-primary-50 to-orange-50 border-l-2 border-l-primary-500"
                              : ""
                          }`}
                        >
                          <p className="font-semibold text-sm text-gray-900">
                            {order?.order_number || d.order_id.slice(0, 8)}
                          </p>
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {order?.product_title}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">{reason}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs capitalize font-medium text-orange-600">
                              {d.status.replace(/_/g, " ")}
                            </span>
                            {slaBreached && (
                              <span className="text-xs text-red-600 flex items-center gap-0.5 font-medium">
                                <Clock className="w-3 h-3" aria-hidden="true" /> SLA
                              </span>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </AdminMotion>

        <AdminMotion delay={80} className="lg:col-span-2">
          <div className={`${AP.card} p-5 sm:p-6 min-h-[400px]`}>
            {!selected ? (
              <AdminEmptyState
                icon={Shield}
                title="Select a dispute"
                description="Choose a case from the queue to review details and resolve."
              />
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <h2 className="font-bold text-lg text-gray-900">
                      {selected.orders?.product_title || "Dispute"}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Order #{selected.orders?.order_number} ·{" "}
                      {selected.orders?.currency}{" "}
                      {Number(selected.orders?.total_amount || 0).toLocaleString()}
                    </p>
                  </div>
                  <a
                    href={`/marketplace/disputes/${selected.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary-600 flex items-center gap-1 hover:text-primary-700 font-medium transition-colors shrink-0"
                  >
                    Full detail <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                </div>

                <p className="text-sm text-gray-700 bg-gray-50/80 rounded-xl p-4 mb-4 leading-relaxed">
                  {selected.description}
                </p>

                {selected.seller_response && (
                  <div className="mb-4 text-sm bg-blue-50/50 rounded-xl p-4">
                    <p className="font-semibold text-gray-800 mb-1">Seller response</p>
                    <p className="text-gray-600 leading-relaxed">{selected.seller_response}</p>
                  </div>
                )}

                <div className="border-t border-gray-100 pt-5 space-y-4">
                  <div>
                    <label
                      htmlFor="resolution-notes"
                      className="block text-sm font-medium text-gray-700 mb-1.5"
                    >
                      Resolution notes *
                    </label>
                    <textarea
                      id="resolution-notes"
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 focus:outline-none transition-all"
                      placeholder="Document your decision..."
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="refund-amount"
                      className="block text-sm font-medium text-gray-700 mb-1.5"
                    >
                      Partial refund amount (if applicable)
                    </label>
                    <input
                      id="refund-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      className="w-full max-w-xs px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 focus:outline-none transition-all"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleResolve("buyer_wins")}
                      disabled={resolving}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      Buyer wins (full refund)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResolve("partial")}
                      disabled={resolving}
                      className="px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      Partial refund
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResolve("seller_wins")}
                      disabled={resolving}
                      className="px-4 py-2 bg-gray-700 text-white rounded-xl text-sm font-medium hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      Seller wins (release payout)
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </AdminMotion>
      </div>
    </div>
  );
}
