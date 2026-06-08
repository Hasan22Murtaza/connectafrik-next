"use client";

import { useAuth } from "@/contexts/AuthContext";
import CreateProductModal from "@/features/marketplace/components/CreateProductModal-v2";
import MarketplaceHubNav from "@/features/marketplace/components/MarketplaceHubNav";
import ProductBrowseCard from "@/features/marketplace/components/ProductBrowseCard";
import {
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_COUNTRIES,
  MARKETPLACE_CURRENCIES,
  MARKETPLACE_SORT_OPTIONS,
  MarketplaceSort,
} from "@/features/marketplace/constants/marketplaceConstants";
import { apiClient } from "@/lib/api-client";
import { Product } from "@/shared/types";
import {
  useShimmerCount,
  MarketplaceGridShimmer,
  MarketplacePageShimmer,
} from "@/shared/components/ui/ShimmerLoaders";
import {
  ArrowLeft,
  ChevronDown,
  Filter,
  MapPin,
  Plus,
  Search,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState, Suspense } from "react";
import toast from "react-hot-toast";

const PAGE_SIZE = 24;

const mapSortToApi = (sort: MarketplaceSort): string => {
  const map: Record<MarketplaceSort, string> = {
    newest: "newest",
    "price-asc": "price_asc",
    "price-desc": "price_desc",
    featured: "featured",
  };
  return map[sort];
};

const MarketplacePage: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [sortBy, setSortBy] = useState<MarketplaceSort>("newest");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const shimmerCount = useShimmerCount();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const paymentHandledRef = useRef(false);
  const pageRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (paymentHandledRef.current) return;

    const paymentStatus = searchParams.get("payment");
    const message = searchParams.get("message");

    if (paymentStatus === "success") {
      paymentHandledRef.current = true;
      toast.success("Payment successful! Your order has been created.");
      router.replace("/marketplace");
    } else if (paymentStatus === "error") {
      paymentHandledRef.current = true;
      toast.error(
        message ? decodeURIComponent(message) : "Payment failed. Please try again."
      );
      router.replace("/marketplace");
    }
  }, [searchParams, router]);

  const fetchProducts = useCallback(
    async (reset = true) => {
      try {
        if (reset) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }

        const currentPage = reset ? 0 : pageRef.current + 1;

        const params: Record<string, string | number> = {
          page: currentPage,
          limit: PAGE_SIZE,
          sort: mapSortToApi(sortBy),
        };

        if (selectedCategory) params.category = selectedCategory;
        if (selectedCurrency) params.currency = selectedCurrency;
        if (selectedCountry) params.country = selectedCountry;
        if (debouncedSearch) params.search = debouncedSearch;

        const res = await apiClient.get<{ data: Product[]; hasMore?: boolean }>(
          "/api/marketplace",
          params
        );

        const nextProducts = res.data || [];

        setProducts((prev) => (reset ? nextProducts : [...prev, ...nextProducts]));
        pageRef.current = currentPage;
        setHasMore(Boolean(res.hasMore));
      } catch {
        toast.error("Failed to load products");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      selectedCategory,
      selectedCurrency,
      selectedCountry,
      debouncedSearch,
      sortBy,
    ]
  );

  useEffect(() => {
    fetchProducts(true);
  }, [selectedCategory, selectedCurrency, selectedCountry, debouncedSearch, sortBy]);

  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchProducts(false);
        }
      },
      { rootMargin: "200px" }
    );

    const node = loadMoreRef.current;
    if (node) observer.observe(node);

    return () => {
      if (node) observer.unobserve(node);
    };
  }, [hasMore, loading, loadingMore, fetchProducts]);

  const handleViewProduct = (productId: string) => {
    router.push(`/marketplace/${productId}`);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCategory("");
    setSelectedCurrency("");
    setSelectedCountry("");
    setSortBy("newest");
  };

  const hasActiveFilters =
    searchTerm ||
    selectedCategory ||
    selectedCurrency ||
    selectedCountry ||
    sortBy !== "newest";

  const selectedCountryLabel =
    MARKETPLACE_COUNTRIES.find((c) => c.value === selectedCountry)?.label ||
    "All locations";

  const renderSidebarItem = (
    isActive: boolean,
    onClick: () => void,
    label: string,
    Icon?: React.ComponentType<{ className?: string }>
  ) => (
    <div
      onClick={onClick}
      className={`group relative flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-all duration-200 ${
        isActive
          ? "bg-orange-50 text-primary-600"
          : "text-gray-500 hover:bg-gray-100 hover:text-primary-600"
      }`}
    >
      <span
        className={`absolute left-0 top-0 h-full w-[3px] rounded-r transition-all duration-200 ${
          isActive
            ? "bg-primary-600 opacity-100 scale-y-100"
            : "bg-primary-600 opacity-0 scale-y-0 group-hover:opacity-100 group-hover:scale-y-100"
        }`}
      />
      {Icon && (
        <Icon
          className={`w-[18px] h-[18px] transition-transform ${
            isActive ? "scale-110" : "group-hover:scale-110"
          }`}
        />
      )}
      <span className="text-sm font-medium">{label}</span>
    </div>
  );

  const renderEmptyState = () => (
    <div className="text-center py-16 px-4">
      <p className="text-gray-600 mb-2">No products found</p>
      <p className="text-sm text-gray-400 mb-4">
        Try adjusting your filters or create a new listing
      </p>
      {hasActiveFilters && (
        <button onClick={clearFilters} className="text-primary-600 text-sm font-medium">
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen px-4">
      <div className="flex gap-4 min-w-0 w-full">
        <aside
          className={`fixed md:relative inset-y-0 left-0 z-40 w-[280px] shrink-0 px-4 py-6 sm:top-0 top-12 md:h-screen h-[calc(100vh-6rem)] scrollbar-hover overflow-y-auto transform transition-transform duration-300 ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } md:translate-x-0`}
        >
          <div className="md:hidden flex items-center mb-4 gap-2">
            <button onClick={() => setIsSidebarOpen(false)} aria-label="Close filters">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="font-semibold">Marketplace</span>
          </div>

          <MarketplaceHubNav
            activeHub="browse"
            user={user}
            onCreateListing={() => {
              if (!user) {
                router.push("/signin?redirect=/marketplace");
                return;
              }
              setShowCreateModal(true);
              setIsSidebarOpen(false);
            }}
          />

          <div className="mb-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="w-full px-4 py-2.5 pl-10 bg-[#EEF1F4] hover:bg-[#DDE2E6] focus-visible:bg-[#DDE2E6] border-0 rounded-full focus:ring-0 focus:outline-none transition-colors text-sm"
                placeholder="Search Marketplace"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3 px-2">
              Location
            </h3>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="w-full px-3 py-2.5 bg-[#EEF1F4] hover:bg-[#DDE2E6] border-0 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-primary-500 focus:outline-none cursor-pointer"
            >
              {MARKETPLACE_COUNTRIES.map((country) => (
                <option key={country.value || "all"} value={country.value}>
                  {country.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3 px-2">
              Categories
            </h3>
            <ul className="space-y-1">
              {MARKETPLACE_CATEGORIES.map((category) => {
                const Icon = category.icon;
                return (
                  <li key={category.value || "all"}>
                    {renderSidebarItem(
                      selectedCategory === category.value,
                      () => setSelectedCategory(category.value),
                      category.label,
                      Icon
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3 px-2">
              Currency
            </h3>
            <ul className="space-y-1">
              {MARKETPLACE_CURRENCIES.map((currency) => (
                <li key={currency.value || "all"}>
                  {renderSidebarItem(
                    selectedCurrency === currency.value,
                    () => setSelectedCurrency(currency.value),
                    currency.label
                  )}
                </li>
              ))}
            </ul>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="w-full text-sm text-gray-600 hover:text-primary-600 transition py-2"
            >
              Clear all filters
            </button>
          )}
        </aside>

        {isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
          />
        )}

        <main className="flex-1 px-1 sm:px-4 py-6 min-w-0 w-full">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden p-2 rounded-lg bg-gray-100 shrink-0"
                aria-label="Open filters"
              >
                <Filter className="w-5 h-5" />
              </button>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                Today&apos;s picks
              </h1>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {selectedCountry && (
                <span className="inline-flex items-center gap-1 text-xs sm:text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
                  <MapPin className="w-3.5 h-3.5 text-primary-600" />
                  {selectedCountryLabel}
                </span>
              )}

              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as MarketplaceSort)}
                  className="appearance-none pl-3 pr-8 py-1.5 sm:py-2 bg-white border border-gray-200 rounded-lg text-xs sm:text-sm text-gray-700 focus:ring-2 focus:ring-primary-500 focus:outline-none cursor-pointer"
                  aria-label="Sort products"
                >
                  {MARKETPLACE_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {user && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary hidden sm:flex items-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Sell
                </button>
              )}
            </div>
          </div>

          {!hasActiveFilters && (
            <p className="text-sm text-gray-500 mb-5">
              {user
                ? "Discover authentic products from entrepreneurs and businesses worldwide"
                : "Browse listings freely — sign in to save, message sellers, or buy"}
            </p>
          )}

          {loading ? (
            <MarketplaceGridShimmer count={shimmerCount} />
          ) : products.length === 0 ? (
            renderEmptyState()
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
                {products.map((product) => (
                  <ProductBrowseCard
                    key={product.id}
                    product={product}
                    onView={handleViewProduct}
                  />
                ))}
              </div>

              <div ref={loadMoreRef} className="h-8 mt-4">
                {loadingMore && (
                  <p className="text-center text-sm text-gray-400 py-4">
                    Loading more...
                  </p>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {user && (
        <button
          onClick={() => setShowCreateModal(true)}
          className="sm:hidden fixed bottom-6 right-6 z-20 w-14 h-14 rounded-full bg-primary-600 text-white shadow-lg flex items-center justify-center hover:bg-primary-700 transition-colors"
          aria-label="Create new listing"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      <CreateProductModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => fetchProducts(true)}
      />
    </div>
  );
};

const MarketplacePageWrapper: React.FC = () => {
  return (
    <Suspense fallback={<MarketplacePageShimmer />}>
      <MarketplacePage />
    </Suspense>
  );
};

export default MarketplacePageWrapper;
