"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useProductionChat } from "@/contexts/ProductionChatContext";
import MarketplaceHubNav from "@/features/marketplace/components/MarketplaceHubNav";
import {
  MARKETPLACE_INBOX_LABELS,
  MarketplaceInboxLabel,
  MarketplaceInboxRole,
} from "@/features/marketplace/constants/marketplaceConstants";
import { MP } from "@/features/marketplace/constants/marketplaceLayout";
import {
  fetchMarketplaceInbox,
  MarketplaceInboxItem,
} from "@/features/marketplace/services/marketplaceInboxService";
import { format, isThisWeek, isToday } from "date-fns";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400";

function formatInboxTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  if (isToday(date)) {
    return format(date, "h:mm a");
  }
  if (isThisWeek(date, { weekStartsOn: 0 })) {
    return format(date, "EEE");
  }
  return format(date, "MMM d");
}

const InboxPageContent: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { openThread } = useProductionChat();
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeRole = (searchParams.get("role") as MarketplaceInboxRole) || "selling";
  const activeLabel =
    (searchParams.get("label") as MarketplaceInboxLabel) || "all";

  const [items, setItems] = useState<MarketplaceInboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadInbox = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await fetchMarketplaceInbox({
        role: activeRole,
        label: activeLabel,
      });
      setItems(data);
    } catch {
      toast.error("Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }, [user, activeRole, activeLabel]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/signin?redirect=/marketplace/inbox");
      return;
    }
    loadInbox();
  }, [user, authLoading, router, loadInbox]);

  const setRole = (role: MarketplaceInboxRole) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("role", role);
    router.push(`/marketplace/inbox?${params.toString()}`);
  };

  const setLabel = (label: MarketplaceInboxLabel) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("label", label);
    router.push(`/marketplace/inbox?${params.toString()}`);
  };

  const handleOpenThread = (item: MarketplaceInboxItem) => {
    openThread(item.thread_id);
    router.push(`/chat/${encodeURIComponent(item.thread_id)}`);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen px-4 py-6">
        <div className="animate-pulse space-y-3 max-w-3xl mx-auto">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={MP.page}>
      <div className={MP.shellFull}>
        <aside className={`hidden lg:block ${MP.sidebarFull}`}>
          <button
            type="button"
            onClick={() => router.push("/marketplace")}
            className={`${MP.backLink} mb-2`}
          >
            <ArrowLeft className="w-4 h-4" />
            Marketplace
          </button>
          <MarketplaceHubNav activeHub="inbox" user={user} compact />
        </aside>

        <main className={`${MP.main} max-w-3xl`}>
          <div className="lg:hidden mb-3">
            <button
              type="button"
              onClick={() => router.push("/marketplace")}
              className={`${MP.backLink} mb-2`}
            >
              <ArrowLeft className="w-4 h-4" />
              Marketplace
            </button>
            <h1 className={MP.pageTitle}>Inbox</h1>
          </div>

          <div className="hidden lg:block mb-4">
            <h1 className={MP.pageTitle}>Inbox</h1>
          </div>

          <div className="flex border-b border-gray-200 mb-3">
            {(["selling", "buying"] as MarketplaceInboxRole[]).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setRole(role)}
                className={`px-3 py-2 text-sm font-semibold border-b-2 transition-colors capitalize ${activeRole === role
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                  }`}
              >
                {role}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-hide">
            {MARKETPLACE_INBOX_LABELS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setLabel(filter.value)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-sm font-medium transition-colors ${activeLabel === filter.value
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="animate-pulse space-y-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 bg-gray-100 rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 px-4">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">No messages yet</h2>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                {activeRole === "selling"
                  ? "When buyers contact you about a listing, conversations will appear here."
                  : "Message a seller from a product page to start a conversation."}
              </p>
              <button
                type="button"
                onClick={() => router.push("/marketplace")}
                className="mt-5 btn-primary text-sm"
              >
                Browse marketplace
              </button>
            </div>
          ) : (
            <ul className={`divide-y divide-gray-100 ${MP.card} overflow-hidden`}>
              {items.map((item) => (
                <li key={item.thread_id}>
                  <button
                    type="button"
                    onClick={() => handleOpenThread(item)}
                    className="w-full flex items-start gap-2 p-2.5 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="relative shrink-0 mt-0.5">
                      {item.unread_count > 0 && (
                        <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500" />
                      )}
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={item.product_image || FALLBACK_IMAGE}
                          alt={item.product_title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm truncate ${item.unread_count > 0 ? "font-bold text-gray-900" : "font-semibold text-gray-900"
                            }`}
                        >
                          {item.display_title}
                        </p>
                        <span className="text-xs text-gray-500 shrink-0">
                          {formatInboxTimestamp(item.last_message_at)}
                        </span>
                      </div>
                      <p
                        className={`text-sm truncate mt-0.5 ${item.unread_count > 0 ? "font-medium text-gray-800" : "text-gray-500"
                          }`}
                      >
                        {item.last_message_preview || "No messages yet"}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>
    </div>
  );
};

const MarketplaceInboxPage: React.FC = () => (
  <Suspense
    fallback={
      <div className="min-h-screen px-4 py-6">
        <div className="animate-pulse space-y-3 max-w-3xl mx-auto">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    }
  >
    <InboxPageContent />
  </Suspense>
);

export default MarketplaceInboxPage;
