"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Shield, Clock, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import { AdminLoading } from "@/features/admin/components/AdminLoading";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { useAdminAuth } from "@/features/admin/hooks/useAdminAuth";
import { MP } from "@/features/marketplace/constants/marketplaceLayout";
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

  if (authLoading || loading) {
    return <AdminLoading message="Loading disputes..." />;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <AdminPageHeader
        title="Disputes"
        description="Review open cases and resolve with full, partial, or no refund."
        icon={Shield}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`lg:col-span-1 ${MP.card} overflow-hidden`}>
          <div className="px-4 py-3 border-b bg-gray-50 font-medium text-sm">
            Open queue ({disputes.length})
          </div>
          {disputes.length === 0 ? (
            <p className="p-6 text-sm text-gray-500 text-center">No open disputes</p>
          ) : (
            <ul className="divide-y max-h-[70vh] overflow-y-auto">
              {disputes.map((d) => {
                const order = d.orders;
                const reason =
                  DISPUTE_REASONS.find((r) => r.value === d.reason)?.label || d.reason;
                const slaBreached =
                  d.sla_seller_deadline &&
                  new Date(d.sla_seller_deadline) < new Date() &&
                  d.status === "awaiting_seller";

                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(d.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                        selectedId === d.id ? "bg-orange-50" : ""
                      }`}
                    >
                      <p className="font-medium text-sm text-gray-900">
                        {order?.order_number || d.order_id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {order?.product_title}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">{reason}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs capitalize text-orange-600">
                          {d.status.replace(/_/g, " ")}
                        </span>
                        {slaBreached && (
                          <span className="text-xs text-red-600 flex items-center gap-0.5">
                            <Clock className="w-3 h-3" /> SLA
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

        <div className={`lg:col-span-2 ${MP.card} p-6`}>
          {!selected ? (
            <p className="text-gray-500 text-sm text-center py-16">
              Select a dispute to review and resolve
            </p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="font-semibold text-lg">
                    {selected.orders?.product_title || "Dispute"}
                  </h2>
                  <p className="text-sm text-gray-500">
                    Order #{selected.orders?.order_number} ·{" "}
                    {selected.orders?.currency}{" "}
                    {Number(selected.orders?.total_amount || 0).toLocaleString()}
                  </p>
                </div>
                <a
                  href={`/marketplace/disputes/${selected.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-600 flex items-center gap-1 hover:underline"
                >
                  Full detail <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-4 mb-4">
                {selected.description}
              </p>

              {selected.seller_response && (
                <div className="mb-4 text-sm">
                  <p className="font-medium text-gray-700">Seller response</p>
                  <p className="text-gray-600">{selected.seller_response}</p>
                </div>
              )}

              <div className="border-t pt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Resolution notes *
                  </label>
                  <textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                    placeholder="Document your decision..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Partial refund amount (if applicable)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="w-full max-w-xs px-3 py-2 border rounded-lg text-sm"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleResolve("buyer_wins")}
                    disabled={resolving}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    Buyer wins (full refund)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResolve("partial")}
                    disabled={resolving}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                  >
                    Partial refund
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResolve("seller_wins")}
                    disabled={resolving}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                  >
                    Seller wins (release payout)
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
