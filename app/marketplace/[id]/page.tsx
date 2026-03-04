"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShoppingBag,
  Heart,
  Share2,
  MapPin,
  Phone,
  Truck,
  Shield,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProductionChat } from "@/contexts/ProductionChatContext";
import { apiClient } from "@/lib/api-client";
import { Product } from "@/shared/types";
import toast from "react-hot-toast";
import ProductReviews from "@/features/marketplace/components/ProductReviews";
import { ProductDetailPageShimmer } from "@/shared/components/ui/ShimmerLoaders";

const ProductDetailPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user } = useAuth();
  const { startChatWithMembers, openThread } = useProductionChat();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    if (id) {
      fetchProduct();
      updateViewCount();
    }
  }, [id, user]);

  const fetchProduct = async () => {
    try {
      setLoading(true);

      const res = await apiClient.get<{ data: Product }>(`/api/marketplace/${id}`);
      const productData = res.data;

      setProduct(productData);
      setIsSaved(!!productData.is_saved);
      if (productData.images && productData.images.length > 0) {
        setSelectedImage(0);
      }
    } catch (error: any) {
      console.error("Error fetching product:", error);
      toast.error(
        `Failed to load product: ${error.message || "Unknown error"}`
      );
    } finally {
      setLoading(false);
    }
  };

  const updateViewCount = async () => {
    try {
      await apiClient.post(`/api/marketplace/${id}/view`);
    } catch (error) {
      console.error("Error updating view count:", error);
    }
  };

  const handleSave = async () => {
    if (!user) {
      toast.error("Please sign in to save products");
      return;
    }

    try {
      const res = await apiClient.post<{ saved: boolean }>(`/api/marketplace/${id}/save`);
      setIsSaved(res.saved);
      toast.success(res.saved ? "Added to saved items" : "Removed from saved items");
    } catch (error) {
      toast.error("Failed to update saved status");
    }
  };

  const handleShare = () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: product?.title,
        text: product?.description,
        url: url,
      });
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    }
  };

  const handleContactSeller = async () => {
    if (!user) {
      toast.error("Please sign in to contact seller");
      return;
    }

    if (!product?.seller?.id) {
      toast.error("Seller information not available");
      return;
    }

    try {
      const loadingToast = toast.loading("Starting chat with seller...");

      // Create chat participant for seller
      const sellerParticipant = {
        id: product.seller.id,
        name: product.seller.full_name,
        avatarUrl: product.seller.avatar_url || undefined,
      };

      // Start chat with seller
      const threadId = await startChatWithMembers([sellerParticipant], {
        participant_ids: [product.seller_id],
        openInDock: true,
      });

      toast.dismiss(loadingToast);

      if (threadId) {
        openThread(threadId);
        toast.success(`Chat started with ${product.seller.full_name}`);
      } else {
        toast.error("Failed to start chat");
      }
    } catch (error) {
      console.error("Error starting chat:", error);
      toast.error("Failed to start chat");
    }
  };

  if (loading) {
    return <ProductDetailPageShimmer />;
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center max-w-full 2xl:max-w-screen-2xl mx-auto px-3 sm:px-4 w-full min-w-0">
        <ShoppingBag className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mb-4" />
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 text-center">
          Product not found
        </h2>
        <button
          onClick={() => router.push("/marketplace")}
          className="text-primary-600 hover:text-primary-700 font-medium"
        >
          Back to Marketplace
        </button>
      </div>
    );
  }

  const images = product.images || [];
  const hasMultipleImages = images.length > 1;

  return (
    <div className="min-h-screen bg-gray-50 max-w-full 2xl:max-w-screen-2xl mx-auto w-full min-w-0 overflow-x-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-3 sm:px-4 w-full min-w-0">
          <div className="flex items-center justify-between h-14 sm:h-16 min-w-0 gap-2">
            <button
              onClick={() => router.push("/marketplace")}
              className="flex items-center text-gray-600 hover:text-gray-900 min-w-0 text-sm sm:text-base"
            >
              <ArrowLeft className="w-5 h-5 mr-1 sm:mr-2 shrink-0" />
              <span className="hidden sm:inline truncate">Back to Marketplace</span>
              <span className="sm:hidden">Back</span>
            </button>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <button
                onClick={handleShare}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full"
                aria-label="Share"
              >
                <Share2 className="w-5 h-5" />
              </button>
              <button
                onClick={handleSave}
                className={`p-2 rounded-full ${
                  isSaved
                    ? "text-red-600 bg-red-50"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
                aria-label={isSaved ? "Unsave" : "Save"}
              >
                <Heart className={`w-5 h-5 ${isSaved ? "fill-current" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Product Details */}
      <div className="px-3 sm:px-4 py-6 sm:py-12 w-full min-w-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Images */}
          <div className="space-y-3 sm:space-y-4 min-w-0">
            <div className="relative w-full max-w-xl mx-auto lg:mx-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-100 pt-[50%]">
              <img
                src={
                  images[selectedImage] ||
                  "https://via.placeholder.com/600x600?text=No+Image"
                }
                alt={product.title}
                className="absolute inset-0 w-full h-full object-contain"
              />
            </div>
            {hasMultipleImages && (
              <div className="grid grid-cols-4 gap-2">
                {images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`border-2 rounded-lg overflow-hidden aspect-square max-h-20 sm:max-h-24 ${
                      selectedImage === index
                        ? "border-primary-600"
                        : "border-gray-200"
                    }`}
                  >
                    <img
                      src={image}
                      alt={`${product.title} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-4 sm:space-y-6 min-w-0">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-2 break-words">
                {product.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-gray-600 min-w-0">
                <span className="flex items-center shrink-0">
                  <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-1 shrink-0" />
                  <span className="truncate">{product.location || "Location not specified"}</span>
                </span>
                <span className="shrink-0">•</span>
                <span className="shrink-0">{product.views_count || 0} views</span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 sm:p-4 space-y-3 min-w-0">
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Product Details</h3>
              <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                <div className="min-w-0">
                  <span className="text-gray-900 font-bold">Category:</span>
                  <span className="ml-1 sm:ml-2 text-gray-600 capitalize truncate block">
                    {product.category}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-gray-900 font-bold">Condition:</span>
                  <span className="ml-1 sm:ml-2 text-gray-600 capitalize">
                    {product.condition}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-gray-900 font-bold">Stock:</span>
                  <span className="ml-1 sm:ml-2 text-gray-600">
                    {product.stock_quantity > 0
                      ? `${product.stock_quantity} available`
                      : "Out of stock"}
                  </span>
                </div>
                {product.shipping_available && (
                  <div className="flex items-center text-green-600 col-span-2">
                    <Truck className="w-3 h-3 sm:w-4 sm:h-4 mr-1 shrink-0" />
                    <span>Shipping available</span>
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Description</h3>
              <p className="text-gray-600 whitespace-pre-wrap text-sm sm:text-base break-words">
                {product.description}
              </p>
            </div>

            <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary-600">
              {product.currency} {product.price.toLocaleString()}
            </div>

            {/* Seller Info */}
            <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 min-w-0">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-3 sm:mb-4">
                <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                  Seller Information
                </h3>
                <button
                  onClick={handleContactSeller}
                  className="btn-primary text-xs sm:text-sm w-full sm:w-auto shrink-0"
                >
                  Contact Seller
                </button>
              </div>
              <div className="flex items-start gap-3 min-w-0">
                <img
                  src={
                    product.seller?.avatar_url ||
                    `https://ui-avatars.com/api/?name=${
                      product.seller?.full_name || "User"
                    }&background=random`
                  }
                  alt={product.seller?.full_name || "Seller"}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 text-sm sm:text-base truncate">
                    {product.seller?.full_name || "Unknown"}
                  </h4>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">
                    @{product.seller?.username || "unknown"}
                  </p>
                </div>
              </div>
              {product.seller?.bio && (
                <p className="text-xs sm:text-sm text-gray-600 mt-3 line-clamp-3">
                  {product.seller.bio}
                </p>
              )}
            </div>

            {/* Contact Buttons */}
            <div className="space-y-3">
              {product.contact_phone && (
                <a
                  href={`tel:${product.contact_phone}`}
                  className="w-full bg-white border-2 border-primary-600 text-primary-600 py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg hover:bg-primary-50 transition-colors flex items-center justify-center font-medium text-sm sm:text-base"
                >
                  <Phone className="w-4 h-4 sm:w-5 sm:h-5 mr-2 shrink-0" />
                  Call Seller
                </a>
              )}
            </div>

            {/* Trust & Safety */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 min-w-0">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-xs sm:text-sm min-w-0">
                  <h4 className="font-semibold text-blue-900 mb-1">
                    Stay Safe
                  </h4>
                  <ul className="text-blue-700 space-y-1">
                    <li>• Meet in a safe, public location</li>
                    <li>• Inspect items before purchasing</li>
                    <li>• Don&apos;t send money in advance</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product Reviews Section */}
        <div className="mt-6 sm:mt-8 w-full min-w-0">
          <ProductReviews
            productId={product.id}
            sellerId={product.seller_id}
            averageRating={product.average_rating || 0}
            reviewsCount={product.reviews_count || 0}
            ratingBreakdown={{
              rating_1_count: product.rating_1_count || 0,
              rating_2_count: product.rating_2_count || 0,
              rating_3_count: product.rating_3_count || 0,
              rating_4_count: product.rating_4_count || 0,
              rating_5_count: product.rating_5_count || 0,
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
