"use client";

import { useAuth } from "@/contexts/AuthContext";
import SellerSidebar, { SellerMobileNav } from "@/features/marketplace/components/SellerSidebar";
import { CREATE_LISTING_PATH } from "@/features/marketplace/constants/marketplaceConstants";
import { MP } from "@/features/marketplace/constants/marketplaceLayout";
import { classifySellerListings } from "@/features/marketplace/utils/listingStates";
import { apiClient } from "@/lib/api-client";
import {
  SellerDashboardContentShimmer,
  SellerDashboardPageShimmer,
} from "@/shared/components/ui/ShimmerLoaders";
import { Product } from "@/shared/types";
import {
  AlertCircle,
  ArrowLeft,
  FileText,
  MessageCircle,
  Package,
  Pause,
  Plus,
  RefreshCw,
  Star,
  Tag,
} from "@/shared/icons";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

interface MarketplaceThreadRow {
  id: string;
}

const SellerDashboardPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [listings, setListings] = useState<Product[]>([]);
  const [chatsToAnswer, setChatsToAnswer] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      const allListings: Product[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const res = await apiClient.get<{ data: Product[]; hasMore?: boolean }>(
          "/api/marketplace",
          {
            seller_id: user.id,
            include_unavailable: "true",
            page,
            limit: 50,
          }
        );
        const pageListings = res.data || [];
        allListings.push(...pageListings);
        hasMore = Boolean(res.hasMore);
        page += 1;
        if (pageListings.length === 0) break;
      }

      setListings(allListings);

      const unreadRes = await apiClient
        .get<{ data: MarketplaceThreadRow[] }>("/api/chat/threads/unread", {
          category: "marketplace",
          limit: 50,
        })
        .catch(() => ({ data: [] as MarketplaceThreadRow[] }));
      setChatsToAnswer(unreadRes.data?.length || 0);
    } catch {
      toast.error("Failed to load seller dashboard");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/signin?redirect=/marketplace/selling/dashboard");
      return;
    }
    fetchDashboardData();
  }, [user, authLoading, router, fetchDashboardData]);

  const stats = useMemo(() => classifySellerListings(listings), [listings]);

  const sellerRating = useMemo(() => {
    const rated = listings.filter(
      (item) => (item.reviews_count || 0) > 0 && typeof item.average_rating === "number"
    );
    if (rated.length === 0) return null;
    const sum = rated.reduce((total, item) => total + (item.average_rating || 0), 0);
    return sum / rated.length;
  }, [listings]);

  const listingStateCards = [
    {
      key: "needs-attention",
      label: "Needs attention",
      value: stats.needsAttention,
      icon: AlertCircle,
      href: "/marketplace/selling?status=needs-attention",
    },
    {
      key: "active-pending",
      label: "Active & pending",
      value: stats.activePending,
      icon: Pause,
      href: "/marketplace/selling?status=active-pending",
    },
    {
      key: "sold",
      label: "Sold & out of stock",
      value: stats.soldOut,
      icon: Tag,
      href: "/marketplace/selling?status=sold",
    },
    {
      key: "draft",
      label: "Drafts",
      value: stats.drafts,
      icon: FileText,
      href: "/marketplace/selling?status=draft",
    },
    {
      key: "renew",
      label: "To renew",
      value: stats.toRenew,
      icon: RefreshCw,
      href: "/marketplace/selling?status=renew",
    },
  ];

  if (authLoading || (!user && loading)) {
    return <SellerDashboardPageShimmer />;
  }

  return (
    <div className={MP.page}>
      <div className={MP.shellFull}>
        <SellerSidebar />

        <main className={MP.main}>
          <div className="lg:hidden mb-4">
            <button
              type="button"
              onClick={() => router.push("/marketplace")}
              className={`${MP.backLink} mb-2`}
            >
              <ArrowLeft className="w-4 h-4" />
              TradeHub
            </button>
            <div className="flex items-center justify-between gap-2">
              <h1 className={MP.pageTitle}>Selling</h1>
              <button
                type="button"
                onClick={() => router.push(CREATE_LISTING_PATH)}
                className="btn-primary flex items-center gap-1.5 text-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                New listing
              </button>
            </div>
          </div>

          <SellerMobileNav />

          {loading ? (
            <SellerDashboardContentShimmer />
          ) : (
            <div className="space-y-6 max-w-4xl">
              <section className={`${MP.card} p-4 sm:p-5`}>
                <h2 className="text-lg font-bold text-content mb-3">Overview</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => router.push("/marketplace/buying?tab=inbox")}
                    className="flex items-start gap-3 rounded-xl border border-border-subtle p-4 text-left hover:bg-surface-hover transition-colors"
                  >
                    <MessageCircle className="w-6 h-6 text-content shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-content">Chats to answer</p>
                      <p className="text-2xl font-bold text-content mt-1">{chatsToAnswer}</p>
                    </div>
                  </button>
                  <div className="flex items-start gap-3 rounded-xl border border-border-subtle p-4">
                    <Star className="w-6 h-6 text-content shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-content">Seller rating</p>
                      <p className="text-2xl font-bold text-content mt-1">
                        {sellerRating == null ? "—" : sellerRating.toFixed(1)}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className={`${MP.card} p-4 sm:p-5`}>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h2 className="text-lg font-bold text-content">Your listings</h2>
                  <button
                    type="button"
                    onClick={() => router.push(CREATE_LISTING_PATH)}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 text-primary-600 text-sm font-semibold hover:bg-primary-100 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create new listing
                  </button>
                </div>

                {listings.length === 0 ? (
                  <div className="text-center py-10">
                    <Package className="w-10 h-10 text-content-tertiary mx-auto mb-3" />
                    <p className="text-content-secondary mb-1">No listings yet</p>
                    <p className="text-sm text-content-tertiary mb-4">
                      Create a listing to start selling
                    </p>
                    <button
                      type="button"
                      onClick={() => router.push(CREATE_LISTING_PATH)}
                      className="btn-primary"
                    >
                      Create listing
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {listingStateCards.map((card) => {
                        const Icon = card.icon;
                        return (
                          <button
                            key={card.key}
                            type="button"
                            onClick={() => router.push(card.href)}
                            className="flex items-start gap-3 rounded-xl border border-border-subtle p-4 text-left hover:bg-surface-hover transition-colors"
                          >
                            <Icon className="w-6 h-6 text-content shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold text-content">{card.label}</p>
                              <p className="text-2xl font-bold text-content mt-1">{card.value}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push("/marketplace/selling")}
                      className="mt-4 text-sm font-semibold text-primary-600 hover:underline"
                    >
                      See all listings
                    </button>
                  </>
                )}
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default SellerDashboardPage;
