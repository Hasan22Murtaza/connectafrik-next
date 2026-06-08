"use client";

import { useAuth } from "@/contexts/AuthContext";
import {
  addDisputeEvidence,
  addDisputeMessage,
  DISPUTE_REASONS,
  getDisputeDetail,
  respondToDispute,
  withdrawDispute,
} from "@/features/marketplace/services/disputeService";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  MessageSquare,
  Paperclip,
  Shield,
  XCircle,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

const ACTIVE_STATUSES = new Set(["open", "awaiting_seller", "under_review"]);

const DisputeDetailPage: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const disputeId = params?.id as string;

  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sellerResponse, setSellerResponse] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!disputeId) return;
    try {
      setLoading(true);
      const data = await getDisputeDetail(disputeId);
      setDetail(data);
    } catch {
      toast.error("Failed to load dispute");
      router.push("/my-orders");
    } finally {
      setLoading(false);
    }
  }, [disputeId, router]);

  useEffect(() => {
    if (user && disputeId) load();
  }, [user, disputeId, load]);

  if (loading || !detail) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading dispute...</div>
      </div>
    );
  }

  const { dispute, messages, evidence, order } = detail;
  const isBuyer = user?.id === dispute.buyer_id;
  const isSeller = user?.id === dispute.seller_id;
  const isActive = ACTIVE_STATUSES.has(dispute.status);
  const reasonLabel =
    DISPUTE_REASONS.find((r) => r.value === dispute.reason)?.label || dispute.reason;

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await addDisputeMessage(disputeId, message.trim());
      setMessage("");
      await load();
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSellerRespond = async (accept?: boolean) => {
    if (!sellerResponse.trim() && !accept) {
      toast.error("Please enter a response");
      return;
    }
    setSubmitting(true);
    try {
      await respondToDispute(
        disputeId,
        accept ? "Seller accepts buyer claim" : sellerResponse.trim(),
        accept
      );
      toast.success(accept ? "Refund initiated for buyer" : "Response submitted");
      await load();
    } catch {
      toast.error("Failed to submit response");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!window.confirm("Withdraw this dispute? Seller payout hold will be released.")) return;
    setSubmitting(true);
    try {
      await withdrawDispute(disputeId);
      toast.success("Dispute withdrawn");
      router.push(`/my-orders/${dispute.order_id}`);
    } catch {
      toast.error("Failed to withdraw dispute");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddEvidence = async () => {
    if (!evidenceUrl.trim()) return;
    setSubmitting(true);
    try {
      await addDisputeEvidence(disputeId, {
        evidence_type: "photo",
        file_url: evidenceUrl.trim(),
      });
      setEvidenceUrl("");
      toast.success("Evidence added");
      await load();
    } catch {
      toast.error("Failed to add evidence");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <button
          onClick={() => router.push(`/my-orders/${dispute.order_id}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to order
        </button>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-orange-600" />
                <h1 className="text-xl font-bold text-gray-900">Dispute</h1>
              </div>
              {order && (
                <p className="text-sm text-gray-600">
                  Order #{order.order_number} · {order.product_title}
                </p>
              )}
            </div>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-orange-50 text-orange-700 capitalize">
              {dispute.status.replace(/_/g, " ")}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Reason</span>
              <p className="font-medium">{reasonLabel}</p>
            </div>
            <div>
              <span className="text-gray-500">Opened</span>
              <p className="font-medium">{new Date(dispute.created_at).toLocaleString()}</p>
            </div>
            {dispute.sla_seller_deadline && isActive && (
              <div className="flex items-center gap-1 text-amber-700">
                <Clock className="w-4 h-4" />
                Seller deadline: {new Date(dispute.sla_seller_deadline).toLocaleDateString()}
              </div>
            )}
          </div>

          <p className="mt-4 text-gray-700 bg-gray-50 rounded-lg p-4 text-sm">{dispute.description}</p>

          {dispute.seller_response && (
            <div className="mt-4 border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-1">Seller response</p>
              <p className="text-sm text-gray-600">{dispute.seller_response}</p>
            </div>
          )}

          {dispute.resolution_notes && (
            <div className="mt-4 border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-1">Resolution</p>
              <p className="text-sm text-gray-600">{dispute.resolution_notes}</p>
              {dispute.resolved_amount != null && (
                <p className="text-sm text-green-600 mt-1">
                  Refunded: {order?.currency} {Number(dispute.resolved_amount).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </div>

        {evidence?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="font-semibold flex items-center gap-2 mb-3">
              <Paperclip className="w-4 h-4" /> Evidence
            </h2>
            <ul className="space-y-2">
              {evidence.map((e: any) => (
                <li key={e.id} className="text-sm bg-gray-50 rounded-lg p-3">
                  <span className="capitalize text-gray-500">{e.submitter_role}</span>
                  {e.file_url && (
                    <a
                      href={e.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-primary-600 hover:underline truncate"
                    >
                      {e.file_url}
                    </a>
                  )}
                  {e.description && <p className="text-gray-600">{e.description}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {isActive && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="font-semibold flex items-center gap-2 mb-3">
              <Paperclip className="w-4 h-4" /> Add evidence
            </h2>
            <div className="flex gap-2">
              <input
                type="url"
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                placeholder="Photo or document URL"
                className="flex-1 px-3 py-2 border rounded-lg text-sm"
              />
              <button
                onClick={handleAddEvidence}
                disabled={submitting}
                className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <MessageSquare className="w-4 h-4" /> Messages
          </h2>
          <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
            {messages?.length === 0 && (
              <p className="text-sm text-gray-500">No messages yet</p>
            )}
            {messages?.map((m: any) => (
              <div
                key={m.id}
                className={`text-sm rounded-lg p-3 ${m.sender_role === "buyer" ? "bg-blue-50 ml-0 mr-8" : "bg-gray-50 ml-8 mr-0"
                  }`}
              >
                <p className="text-xs text-gray-500 capitalize mb-1">{m.sender_role}</p>
                <p>{m.message}</p>
              </div>
            ))}
          </div>
          {isActive && (isBuyer || isSeller) && (
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write a message..."
                className="flex-1 px-3 py-2 border rounded-lg text-sm"
              />
              <button
                onClick={handleSendMessage}
                disabled={submitting}
                className="px-4 py-2 btn-primary text-sm disabled:opacity-50"
              >
                Send
              </button>
            </div>
          )}
        </div>

        {isActive && isSeller && dispute.status === "awaiting_seller" && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="font-semibold mb-3">Your response</h2>
            <textarea
              value={sellerResponse}
              onChange={(e) => setSellerResponse(e.target.value)}
              rows={3}
              placeholder="Explain your side or offer a resolution..."
              className="w-full px-3 py-2 border rounded-lg text-sm mb-3 resize-none"
            />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleSellerRespond(false)}
                disabled={submitting}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Submit response
              </button>
              <button
                onClick={() => handleSellerRespond(true)}
                disabled={submitting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-1"
              >
                <CheckCircle className="w-4 h-4" />
                Accept & refund buyer
              </button>
            </div>
          </div>
        )}

        {isActive && isBuyer && (
          <button
            onClick={handleWithdraw}
            disabled={submitting}
            className="w-full py-3 border border-gray-300 rounded-lg text-gray-600 text-sm hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <XCircle className="w-4 h-4" />
            Withdraw dispute
          </button>
        )}
      </div>
    </div>
  );
};

export default DisputeDetailPage;
