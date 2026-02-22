"use client";

import { useAuth } from "@/contexts/AuthContext";
import CreateProductModal from "@/features/marketplace/components/CreateProductModal-v2";
import ProductCard from "@/features/marketplace/components/ProductCard";
import { apiClient } from "@/lib/api-client";
import { Product } from "@/shared/types";
import {
  ArrowLeft,
  Filter,
  Plus,
  Search,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState, Suspense } from "react";
import toast from "react-hot-toast";
import {
  useShimmerCount,
  MarketplaceGridShimmer,
  MarketplacePageShimmer,
} from "@/shared/components/ui/ShimmerLoaders";

const MarketplacePage: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const shimmerCount = useShimmerCount();

  const categories = [
    { value: "", label: "All Categories", emoji: "🛍️" },
    { value: "fashion", label: "Fashion", emoji: "👗" },
    { value: "crafts", label: "Crafts", emoji: "🎨" },
    { value: "electronics", label: "Electronics", emoji: "📱" },
    { value: "food", label: "Food & Beverages", emoji: "🍽️" },
    { value: "beauty", label: "Beauty & Care", emoji: "💄" },
    { value: "home", label: "Home & Living", emoji: "🏠" },
    { value: "books", label: "Books", emoji: "📚" },
    { value: "art", label: "Art", emoji: "🖼️" },
    { value: "jewelry", label: "Jewelry", emoji: "💎" },
    { value: "services", label: "Services", emoji: "🔧" },
    { value: "other", label: "Other", emoji: "📦" },
  ];

  const currencies = [
    { value: "", label: "All Currencies" },
    { value: "USD", label: "USD ($)" },
    { value: "GHS", label: "GHS (₵)" },
    { value: "NGN", label: "NGN (₦)" },
    { value: "KES", label: "KES (KSh)" },
    { value: "ZAR", label: "ZAR (R)" },
    { value: "XOF", label: "XOF (CFA)" },
    { value: "XAF", label: "XAF (FCFA)" },
  ];

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, selectedCategory, selectedCurrency]);

  // Handle payment success/error messages from query params
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const message = searchParams.get('message');

    if (paymentStatus === 'success') {
      toast.success('Payment successful! Your order has been created.');
      // Clean up URL by removing query params
      router.replace('/marketplace');
    } else if (paymentStatus === 'error') {
      toast.error(message ? decodeURIComponent(message) : 'Payment failed. Please try again.');
      // Clean up URL by removing query params
      router.replace('/marketplace');
    }
  }, [searchParams, router]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<{ data: Product[] }>("/api/marketplace");
      setProducts(res.data || []);
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = products;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(term) ||
          p.description.toLowerCase().includes(term) ||
          p.tags.some((t) => t.toLowerCase().includes(term))
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }

    if (selectedCurrency) {
      filtered = filtered.filter((p) => p.currency === selectedCurrency);
    }

    setFilteredProducts(filtered);
  };

  const featuredProducts = products.filter((p) => p.is_featured).slice(0, 3);

    const handleSaveProduct = async (productId: string) => {
      if (!user) {
        toast.error('Please sign in to save products')
        return
      }
  
      try {
        const product = products.find(p => p.id === productId)
        if (!product) return

        const res = await apiClient.post<{ saved: boolean }>(`/api/marketplace/${productId}/save`)
        toast.success(res.saved ? 'Product saved!' : 'Product removed from saved items')

        setProducts(products.map(p =>
          p.id === productId ? { ...p, is_saved: res.saved } : p
        ))
      } catch (error: any) {
        console.error('Error saving product:', error)
        toast.error('Failed to save product')
      }
    }
  
    const handleViewProduct = async (productId: string) => {
      router.push(`/marketplace/${productId}`)
    }

  return (
    <div className="min-h-screen bg-gray-50 max-w-full 2xl:max-w-screen-2xl mx-auto w-full min-w-0 overflow-x-hidden">
      <div className="flex gap-4 min-w-0 w-full">
        {/* Sidebar */}
        <aside
          className={`fixed md:relative inset-y-0 left-0 z-40
          w-[280px] shrink-0 bg-white
          px-4 py-6
          top-12
          md:top-0
          h-[90vh]
          md:h-screen
          scrollbar-hover
          overflow-y-auto
          transform transition-transform duration-300
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0`}
        >
          {/* Mobile Close */}
          <div className="md:hidden flex items-center mb-4 gap-2 ">
            <button onClick={() => setIsSidebarOpen(false)}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="font-semibold">Filters</span>
          </div>

          {/* Search */}
          <div className="mb-6">
            <label className="text-sm font-medium text-gray-700">Search</label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="input-field !pl-8"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Categories */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">
              Categories
            </h3>
            <ul className="space-y-1">
              {categories.map((c) => (
                <li
                  key={c.value}
                  onClick={() => setSelectedCategory(c.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition
                    ${
                      selectedCategory === c.value
                        ? "bg-primary-50 text-primary-600 font-medium"
                        : "text-gray-700 hover:bg-gray-100"
                    }
                  `}
                >
                  <span>{c.emoji}</span>
                  <span className="text-sm">{c.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Currency */}
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">
              Currency
            </h3>
            <ul className="space-y-1">
              {currencies.map((c) => (
                <li
                  key={c.value}
                  onClick={() => setSelectedCurrency(c.value)}
                  className={`px-3 py-2 rounded-lg cursor-pointer transition text-sm
                    ${
                      selectedCurrency === c.value
                        ? "bg-primary-50 text-primary-600 font-medium"
                        : "text-gray-700 hover:bg-gray-100"
                    }
                  `}
                >
                  {c.label}
                </li>
              ))}
            </ul>
          </div>

          {/* Clear Filters */}
          <button
            onClick={() => {
              setSearchTerm("");
              setSelectedCategory("");
              setSelectedCurrency("");
            }}
            className="mt-6 w-full text-sm text-gray-600 hover:text-primary-600 transition"
          >
            Clear all filters
          </button>
        </aside>

        {/* Overlay */}
        {isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
          />
        )}

        {/* Main */}
        <main className="flex-1 px-3 sm:px-4 py-6 min-w-0 w-full">
          <div className="flex items-center justify-between mb-6 flex-wrap md:flex-nowrap gap-4 ">
            <div className="max-w-3xl">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ShoppingBag className="text-primary-600" />
                Marketplace
              </h1>
              <p className="text-gray-600 mt-1">
                Discover authentic products from entrepreneurs and
                businesses
              </p>
            </div>

            <div className="flex items-center gap-2 justify-between w-auto">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden p-2 rounded-lg bg-gray-100"
              >
                <Filter className="w-5 h-5" />
              </button>

              {user && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary hidden sm:flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Sell Product
                </button>
              )}
            </div>
          </div>

          {/* Featured */}
          {!searchTerm && !selectedCategory && featuredProducts.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="text-primary-600" />
                <h2 className="text-xl font-semibold">Featured Products</h2>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {featuredProducts.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onView={(id) => router.push(`/marketplace/${id}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Products */}
          {loading ? (
            <MarketplaceGridShimmer count={shimmerCount} />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
              {filteredProducts.map((p) => (
                <ProductCard
                  onSave={handleSaveProduct}
                  onView={handleViewProduct}
                  key={p.id}
                  product={p}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <CreateProductModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchProducts}
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
