"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Truck,
  UserPlus,
  X,
  ZoomIn,
} from "@/shared/icons";
import { useAuth } from "@/contexts/AuthContext";
import { useProductionChat } from "@/contexts/ProductionChatContext";
import { apiClient } from "@/lib/api-client";
import { Product } from "@/shared/types";
import toast from "react-hot-toast";
import ProductReviews from "@/features/marketplace/components/ProductReviews";
import { startMarketplaceConversation } from "@/features/marketplace/services/marketplaceInboxService";
import { buildMarketplaceSeedThread } from "@/features/marketplace/utils/marketplaceChatThread";
import {
  formatProductLocation,
  formatProductPrice,
} from "@/features/marketplace/utils/productFormatting";
import {
  getCategoryLabel,
  getSubcategoryLabel,
  PRODUCT_CONDITIONS,
} from "@/features/marketplace/constants/marketplaceConstants";
import {
  DELIVERY_TAG,
  hasTag,
  PICKUP_TAG,
  resolveSubcategory,
  stripReservedListingTags,
} from "@/features/marketplace/utils/listingTags";
import {
  checkIsFollowing,
  followUser,
  unfollowUser,
} from "@/features/social/services/followService";
import { ProductDetailPageShimmer } from "@/shared/components/ui/ShimmerLoaders";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800";
const DESC_COLLAPSE_CHARS = 320;

const ProductDetailPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user } = useAuth();
  const { openThread } = useProductionChat();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [contactingSeller, setContactingSeller] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [similar, setSimilar] = useState<Product[]>([]);
  const [sellerListingCount, setSellerListingCount] = useState<number | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  const fetchProduct = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<{ data: Product }>(`/api/marketplace/${id}`);
      const productData = res.data;
      setProduct(productData);
      setIsSaved(!!productData.is_saved);
      setSelectedImage(0);
      setDescExpanded(false);
      requestAnimationFrame(() => setFadeIn(true));
    } catch (error: any) {
      console.error("Error fetching product:", error);
      toast.error(`Failed to load product: ${error.message || "Unknown error"}`);
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const updateViewCount = useCallback(async () => {
    try {
      await apiClient.post(`/api/marketplace/${id}/view`);
    } catch (error) {
      console.error("Error updating view count:", error);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setFadeIn(false);
    fetchProduct();
    updateViewCount();
  }, [id, user, fetchProduct, updateViewCount]);

  useEffect(() => {
    if (!product) return;

    let cancelled = false;

    const loadRelated = async () => {
      try {
        const relatedRes = await apiClient.get<{
          data: Product[];
          total?: number;
          seller_listing_count?: number | null;
        }>(`/api/marketplace/${product.id}/related`, { limit: 5 });

        if (cancelled) return;

        setSimilar(relatedRes.data || []);
        setSellerListingCount(
          typeof relatedRes.seller_listing_count === "number"
            ? relatedRes.seller_listing_count
            : null
        );
      } catch {
        if (!cancelled) {
          setSimilar([]);
          setSellerListingCount(null);
        }
      }
    };

    loadRelated();
    return () => {
      cancelled = true;
    };
  }, [product?.id]);

  useEffect(() => {
    if (!user?.id || !product?.seller_id || user.id === product.seller_id) {
      setIsFollowing(false);
      return;
    }

    let cancelled = false;
    checkIsFollowing(user.id, product.seller_id).then((following) => {
      if (!cancelled) setIsFollowing(following);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, product?.seller_id]);

  useEffect(() => {
    if (!lightboxOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxOpen(false);
        setLightboxZoom(1);
      } else if (e.key === "ArrowLeft") {
        setSelectedImage((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        setSelectedImage((i) => {
          const max = (product?.images?.length || 1) - 1;
          return Math.min(max, i + 1);
        });
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [lightboxOpen, product?.images?.length]);

  const handleSave = async () => {
    if (!user) {
      toast.error("Please sign in to save products");
      return;
    }

    try {
      const res = await apiClient.post<{ saved: boolean }>(
        `/api/marketplace/${id}/save`
      );
      setIsSaved(res.saved);
      toast.success(res.saved ? "Added to saved items" : "Removed from saved items");
    } catch {
      toast.error("Failed to update saved status");
    }
  };

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: product?.title,
          text: product?.description,
          url,
        });
      } catch {
        /* user cancelled */
      }
      return;
    }

    await navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  const handleFollowSeller = async () => {
    if (!user) {
      toast.error("Please sign in to follow sellers");
      router.push(`/signin?redirect=/marketplace/${id}`);
      return;
    }
    if (!product?.seller_id || user.id === product.seller_id) return;

    setFollowLoading(true);
    try {
      if (isFollowing) {
        const ok = await unfollowUser(user.id, product.seller_id);
        if (ok) {
          setIsFollowing(false);
          toast.success("Unfollowed seller");
        } else {
          toast.error("Failed to unfollow");
        }
      } else {
        const ok = await followUser(user.id, product.seller_id);
        if (ok) {
          setIsFollowing(true);
          toast.success("Following seller");
        } else {
          toast.error("Failed to follow");
        }
      }
    } finally {
      setFollowLoading(false);
    }
  };

  const handleContactSeller = async () => {
    if (!user) {
      toast.error("Please sign in to message the seller");
      router.push(`/signin?redirect=/marketplace/${id}`);
      return;
    }

    if (product && user?.id === product.seller_id) {
      toast.error("This is your own listing");
      return;
    }

    if (!product?.seller?.id) {
      toast.error("Seller information not available");
      return;
    }

    try {
      setContactingSeller(true);
      const result = await startMarketplaceConversation(product.id);

      const buyerName =
        (user.user_metadata?.full_name as string | undefined)?.trim() ||
        user.email?.split("@")[0] ||
        "Buyer";
      const buyerAvatar = user.user_metadata?.avatar_url as string | undefined;

      const seedThread = buildMarketplaceSeedThread({
        threadId: result.thread_id,
        productId: result.product_id,
        productTitle: result.product_title,
        productImage: result.product_image,
        sellerId: result.seller_id,
        sellerName: result.seller?.full_name || product.seller.full_name,
        sellerAvatarUrl: result.seller?.avatar_url || product.seller.avatar_url,
        buyerId: user.id,
        buyerName,
        buyerAvatarUrl: buyerAvatar,
      });

      openThread(result.thread_id, seedThread);
      router.push(`/chat/${encodeURIComponent(result.thread_id)}`);
    } catch (error) {
      console.error("Error starting marketplace chat:", error);
      toast.error("Failed to start marketplace chat");
    } finally {
      setContactingSeller(false);
    }
  };

  const goToImage = (index: number) => {
    const count = product?.images?.length || 0;
    if (count === 0) return;
    const next = ((index % count) + count) % count;
    setSelectedImage(next);
  };

  const onGalleryTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const onGalleryTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null || touchStartY.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) goToImage(selectedImage + 1);
    else goToImage(selectedImage - 1);
  };

  if (loading) {
    return <ProductDetailPageShimmer />;
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <ShoppingBag className="w-14 h-14 text-content-tertiary mx-auto mb-4" />
          <h2 className="text-xl font-bold text-content mb-2">Product not found</h2>
          <p className="text-sm text-content-secondary mb-6">
            This listing may have been removed or is no longer available.
          </p>
          <button
            type="button"
            onClick={() => router.push("/marketplace")}
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-semibold text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to TradeHub
          </button>
        </div>
      </div>
    );
  }

  const images = product.images?.length ? product.images : [FALLBACK_IMAGE];
  const hasMultipleImages = images.length > 1;
  const isOutOfStock = product.stock_quantity === 0;
  const isUnavailable = !product.is_available;
  const isOwnProduct = user?.id === product.seller_id;
  const location = formatProductLocation(product);
  const canPurchase = !isOutOfStock && !isUnavailable && !isOwnProduct;
  const subcategory = resolveSubcategory(product.subcategory, product.tags);
  const conditionLabel =
    PRODUCT_CONDITIONS.find((c) => c.value === product.condition)?.label ||
    product.condition;
  const displayTags = stripReservedListingTags(product.tags || []);
  const hasPickup = hasTag(product.tags, PICKUP_TAG) || !product.shipping_available;
  const hasDelivery =
    hasTag(product.tags, DELIVERY_TAG) || !!product.shipping_available;
  const hasCoords =
    typeof product.latitude === "number" &&
    typeof product.longitude === "number" &&
    Number.isFinite(product.latitude) &&
    Number.isFinite(product.longitude);

  const description = product.description || "";
  const needsCollapse = description.length > DESC_COLLAPSE_CHARS;
  const shownDescription =
    needsCollapse && !descExpanded
      ? `${description.slice(0, DESC_COLLAPSE_CHARS).trimEnd()}…`
      : description;

  const specRows: { label: string; value: string }[] = [
    { label: "Category", value: getCategoryLabel(product.category) },
  ];
  if (subcategory) {
    specRows.push({
      label: "Subcategory",
      value: getSubcategoryLabel(product.category, subcategory),
    });
  }
  specRows.push({ label: "Condition", value: conditionLabel });
  if (product.stock_quantity > 0) {
    specRows.push({
      label: "Quantity",
      value: String(product.stock_quantity),
    });
  }
  if (hasDelivery) {
    specRows.push({ label: "Delivery", value: "Available" });
  }
  if (hasPickup) {
    specRows.push({ label: "Pickup", value: "Available" });
  }
  displayTags.slice(0, 6).forEach((tag) => {
    specRows.push({ label: "Tag", value: tag });
  });

  const handleBuyNow = () => {
    if (!user) {
      toast.error("Please sign in to purchase");
      router.push(`/signin?redirect=/marketplace/${id}`);
      return;
    }
    if (isOwnProduct) {
      toast.error("This is your own product");
      return;
    }
    if (isOutOfStock || isUnavailable) return;
    router.push(`/marketplace/${id}/checkout`);
  };

  const openSellerProfile = () => {
    if (product.seller?.username) {
      router.push(`/user/${encodeURIComponent(product.seller.username)}`);
    }
  };

  return (
    <div
      className={`min-h-screen bg-surface pb-28 lg:pb-12 transition-opacity duration-500 ${
        fadeIn ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Mobile top chrome */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-3 h-12 bg-surface/90 backdrop-blur-md border-b border-border-subtle">
        <button
          type="button"
          onClick={() => router.push("/marketplace")}
          className="p-2 -ml-1 rounded-full hover:bg-surface-hover transition-colors active:scale-95"
          aria-label="Back to TradeHub"
        >
          <ArrowLeft className="w-5 h-5 text-content" />
        </button>
        <span className="text-sm font-semibold text-content truncate px-2">
          TradeHub
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleShare}
            className="p-2 rounded-full hover:bg-surface-hover transition-colors active:scale-95"
            aria-label="Share"
          >
            <Share2 className="w-5 h-5 text-content" />
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="p-2 rounded-full hover:bg-surface-hover transition-colors active:scale-95"
            aria-label={isSaved ? "Unsave" : "Save"}
          >
            <Heart
              className={`w-5 h-5 transition-colors ${
                isSaved ? "fill-primary-600 text-primary-600" : "text-content"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full min-w-0">
        {/* Desktop back */}
        <div className="hidden lg:flex items-center px-4 pt-4 pb-2">
          <button
            type="button"
            onClick={() => router.push("/marketplace")}
            className="flex items-center gap-2 text-content-secondary hover:text-content text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            TradeHub
          </button>
        </div>

        <div className="lg:grid lg:grid-cols-12 lg:gap-0 lg:items-start">
          {/* ── Gallery + primary content ── */}
          <div className="lg:col-span-7 min-w-0">
            {/* Full-width image gallery */}
            <section
              ref={galleryRef}
              className="relative bg-surface-secondary lg:mx-4 lg:rounded-2xl lg:overflow-hidden"
              onTouchStart={onGalleryTouchStart}
              onTouchEnd={onGalleryTouchEnd}
            >
              <div className="relative aspect-square sm:aspect-[4/3] lg:aspect-square overflow-hidden">
                <img
                  key={selectedImage}
                  src={images[selectedImage]}
                  alt={`${product.title} — image ${selectedImage + 1}`}
                  className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
                  loading={selectedImage === 0 ? "eager" : "lazy"}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
                  }}
                  onClick={() => {
                    setLightboxOpen(true);
                    setLightboxZoom(1);
                  }}
                />

                {(isOutOfStock || isUnavailable) && (
                  <div className="absolute inset-0 bg-black/45 flex items-center justify-center pointer-events-none">
                    <span className="bg-surface text-content text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wide">
                      {isOutOfStock ? "Sold out" : "Unavailable"}
                    </span>
                  </div>
                )}

                {/* Overlay actions (desktop / always on gallery) */}
                <div className="absolute top-3 right-3 hidden lg:flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleShare}
                    className="p-2.5 rounded-full bg-surface/90 backdrop-blur-sm text-content hover:bg-surface shadow-sm transition-all active:scale-95"
                    aria-label="Share"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className={`p-2.5 rounded-full backdrop-blur-sm shadow-sm transition-all active:scale-95 ${
                      isSaved
                        ? "bg-primary-600 text-white"
                        : "bg-surface/90 text-content hover:bg-surface"
                    }`}
                    aria-label={isSaved ? "Unsave" : "Save"}
                  >
                    <Heart className={`w-4 h-4 ${isSaved ? "fill-current" : ""}`} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setLightboxOpen(true);
                    setLightboxZoom(1);
                  }}
                  className="absolute bottom-3 right-3 p-2.5 rounded-full bg-surface/90 backdrop-blur-sm text-content shadow-sm hover:bg-surface transition-all active:scale-95"
                  aria-label="Open fullscreen gallery"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                {hasMultipleImages && (
                  <>
                    <button
                      type="button"
                      onClick={() => goToImage(selectedImage - 1)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-surface/85 backdrop-blur-sm text-content shadow-sm hover:bg-surface transition-all active:scale-95 hidden sm:flex"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => goToImage(selectedImage + 1)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-surface/85 backdrop-blur-sm text-content shadow-sm hover:bg-surface transition-all active:scale-95 hidden sm:flex"
                      aria-label="Next image"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-black/55 text-white text-xs font-medium tabular-nums backdrop-blur-sm">
                      {selectedImage + 1}/{images.length}
                    </div>
                  </>
                )}
              </div>

              {hasMultipleImages && (
                <div className="hidden lg:flex gap-2 p-3 overflow-x-auto scrollbar-hover">
                  {images.map((image, index) => (
                    <button
                      key={`${image}-${index}`}
                      type="button"
                      onClick={() => setSelectedImage(index)}
                      className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden ring-2 transition-all duration-200 ${
                        selectedImage === index
                          ? "ring-primary-600 opacity-100"
                          : "ring-transparent opacity-70 hover:opacity-100"
                      }`}
                      aria-label={`View image ${index + 1}`}
                      aria-current={selectedImage === index}
                    >
                      <img
                        src={image}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Mobile swipe dots */}
              {hasMultipleImages && (
                <div className="lg:hidden flex justify-center gap-1.5 py-3">
                  {images.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedImage(index)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        selectedImage === index
                          ? "w-5 bg-primary-600"
                          : "w-1.5 bg-border hover:bg-content-tertiary"
                      }`}
                      aria-label={`Go to image ${index + 1}`}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Product information */}
            <section className="px-4 pt-5 pb-2 lg:px-6">
              <p className="text-3xl sm:text-4xl font-bold tracking-tight text-content mb-2">
                {formatProductPrice(product)}
              </p>
              <h1 className="text-xl sm:text-2xl font-semibold text-content leading-snug mb-3">
                {product.title}
              </h1>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-content-secondary">
                <span className="inline-flex items-center font-medium text-content">
                  {conditionLabel}
                </span>
                <span className="text-border" aria-hidden>
                  ·
                </span>
                <span>{getCategoryLabel(product.category)}</span>
                {subcategory && (
                  <>
                    <span className="text-border" aria-hidden>
                      ·
                    </span>
                    <span>
                      {getSubcategoryLabel(product.category, subcategory)}
                    </span>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-sm text-content-secondary">
                {location && (
                  <span className="inline-flex items-center gap-1 min-w-0">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{location}</span>
                  </span>
                )}
                <span>
                  Listed{" "}
                  {formatDistanceToNow(new Date(product.created_at), {
                    addSuffix: true,
                  })}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" />
                  {(product.views_count || 0).toLocaleString()} views
                </span>
              </div>

              {(hasDelivery || product.is_featured) && (
                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 text-sm text-content-secondary">
                  {hasDelivery && (
                    <span className="inline-flex items-center gap-1.5 text-content">
                      <Truck className="w-4 h-4 text-primary-600" />
                      Delivery available
                    </span>
                  )}
                  {product.is_featured && (
                    <span className="text-primary-600 font-medium">Featured</span>
                  )}
                </div>
              )}
            </section>

            {/* Seller */}
            <section className="mx-4 lg:mx-6 border-t border-border py-6">
              <h2 className="text-lg font-bold text-content mb-4">Seller</h2>
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={openSellerProfile}
                  className="shrink-0 rounded-full overflow-hidden ring-1 ring-border-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  aria-label="View seller profile"
                >
                  <img
                    src={
                      product.seller?.avatar_url ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        product.seller?.full_name || "User"
                      )}&background=random`
                    }
                    alt=""
                    className="w-14 h-14 object-cover"
                  />
                </button>
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={openSellerProfile}
                    className="text-left group"
                  >
                    <p className="font-semibold text-content group-hover:text-primary-600 transition-colors truncate">
                      {product.seller?.full_name || "Unknown"}
                    </p>
                    <p className="text-sm text-content-secondary truncate">
                      @{product.seller?.username || "unknown"}
                    </p>
                  </button>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-content-secondary">
                    {(product.average_rating || 0) > 0 && (
                      <span>
                        ★ {(product.average_rating || 0).toFixed(1)}
                        {product.reviews_count
                          ? ` · ${product.reviews_count} reviews`
                          : ""}
                      </span>
                    )}
                    {sellerListingCount != null && (
                      <span>
                        {sellerListingCount} active listing
                        {sellerListingCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {product.seller?.bio && (
                <p className="mt-3 text-sm text-content-secondary leading-relaxed line-clamp-3">
                  {product.seller.bio}
                </p>
              )}

              {!isOwnProduct && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {product.contact_phone && (
                    <a
                      href={`tel:${product.contact_phone}`}
                      className="px-4 py-2.5 rounded-xl text-sm font-semibold text-content bg-surface-secondary hover:bg-surface-hover transition-colors active:scale-[0.98] inline-flex items-center gap-1.5"
                    >
                      <Phone className="w-4 h-4" />
                      Call
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={handleFollowSeller}
                    disabled={followLoading}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors active:scale-[0.98] inline-flex items-center gap-1.5 disabled:opacity-50 ${
                      isFollowing
                        ? "text-content bg-surface-secondary hover:bg-surface-hover"
                        : "text-primary-700 bg-primary-50 hover:bg-primary-100"
                    }`}
                  >
                    <UserPlus className="w-4 h-4" />
                    {isFollowing ? "Following" : "Follow"}
                  </button>
                </div>
              )}
            </section>

            {/* Description */}
            <section className="mx-4 lg:mx-6 border-t border-border py-6">
              <h2 className="text-lg font-bold text-content mb-3">Description</h2>
              <div className="text-[15px] text-content-secondary leading-relaxed whitespace-pre-wrap break-words">
                {shownDescription || "No description provided."}
              </div>
              {needsCollapse && (
                <button
                  type="button"
                  onClick={() => setDescExpanded((v) => !v)}
                  className="mt-2 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors"
                >
                  {descExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </section>

            {/* Product details / specs */}
            <section className="mx-4 lg:mx-6 border-t border-border py-6">
              <h2 className="text-lg font-bold text-content mb-4">Details</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                {specRows.map((row, i) => (
                  <div
                    key={`${row.label}-${i}`}
                    className="flex items-baseline justify-between gap-4 py-2.5 border-b border-border-subtle"
                  >
                    <dt className="text-sm text-content-secondary shrink-0">
                      {row.label}
                    </dt>
                    <dd className="text-sm font-medium text-content text-right capitalize">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* Location */}
            <section className="mx-4 lg:mx-6 border-t border-border py-6">
              <h2 className="text-lg font-bold text-content mb-4">Location</h2>
              <div className="flex flex-col gap-3">
                {location ? (
                  <p className="inline-flex items-center gap-2 text-[15px] font-medium text-content">
                    <MapPin className="w-4 h-4 text-primary-600 shrink-0" />
                    <span>{location}</span>
                  </p>
                ) : (
                  <p className="text-sm text-content-secondary">
                    Location not specified
                  </p>
                )}

                <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-content-secondary">
                  <span>
                    Pickup{" "}
                    <span className="text-content font-medium">
                      · {hasPickup ? "Available" : "Not listed"}
                    </span>
                  </span>
                  <span>
                    Delivery{" "}
                    <span className="text-content font-medium">
                      · {hasDelivery ? "Available" : "Not listed"}
                    </span>
                  </span>
                </div>
              </div>

              {hasCoords && (
                <div className="relative w-full overflow-hidden rounded-2xl aspect-[16/9] bg-surface-secondary mt-4">
                  <iframe
                    title="Listing location map"
                    className="absolute inset-0 w-full h-full border-0 grayscale-[20%]"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                      product.longitude! - 0.02
                    }%2C${product.latitude! - 0.015}%2C${
                      product.longitude! + 0.02
                    }%2C${product.latitude! + 0.015}&layer=mapnik&marker=${
                      product.latitude
                    }%2C${product.longitude}`}
                  />
                </div>
              )}
            </section>

            {/* Safety */}
            <section className="mx-4 lg:mx-6 border-t border-border py-6">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-primary-600 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-content mb-1.5">Stay safe</h3>
                  <ul className="text-sm text-content-secondary space-y-1 leading-relaxed">
                    <li>Meet in a safe, public location</li>
                    <li>Inspect items before purchasing</li>
                    <li>Don&apos;t send money in advance</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Reviews */}
            <section className="mx-4 lg:mx-6 border-t border-border py-6">
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
            </section>
          </div>

          {/* ── Desktop sticky purchase panel ── */}
          <aside className="hidden lg:block lg:col-span-5 lg:sticky lg:top-20 self-start px-4 pt-0 pb-8">
            <div className="pl-2">
              <p className="text-4xl font-bold tracking-tight text-content">
                {formatProductPrice(product)}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-content leading-snug">
                {product.title}
              </h2>
              <p className="mt-2 text-sm text-content-secondary">
                {conditionLabel}
                {location ? ` · ${location}` : ""}
              </p>

              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={handleContactSeller}
                  disabled={contactingSeller || isOwnProduct}
                  className={`w-full py-3.5 px-4 rounded-xl font-semibold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.99] ${
                    contactingSeller || isOwnProduct
                      ? "bg-surface-secondary text-content-tertiary cursor-not-allowed"
                      : "bg-primary-600 text-white hover:bg-primary-700 shadow-sm"
                  }`}
                >
                  <MessageCircle className="w-5 h-5" />
                  {contactingSeller
                    ? "Opening chat…"
                    : isOwnProduct
                      ? "Your listing"
                      : "Message seller"}
                </button>

                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={!canPurchase}
                  className={`w-full py-3.5 px-4 rounded-xl font-semibold text-[15px] flex items-center justify-center gap-2 border-2 transition-all active:scale-[0.99] ${
                    canPurchase
                      ? "border-primary-600 text-primary-600 hover:bg-primary-50"
                      : "border-border text-content-tertiary cursor-not-allowed"
                  }`}
                >
                  <ShoppingCart className="w-5 h-5" />
                  {isOwnProduct
                    ? "Your product"
                    : isOutOfStock
                      ? "Out of stock"
                      : isUnavailable
                        ? "Unavailable"
                        : "Buy now"}
                </button>

                {product.contact_phone && !isOwnProduct && (
                  <a
                    href={`tel:${product.contact_phone}`}
                    className="w-full py-3.5 px-4 rounded-xl border border-border text-content hover:bg-surface-hover transition-all active:scale-[0.99] flex items-center justify-center gap-2 font-semibold text-[15px]"
                  >
                    <Phone className="w-5 h-5" />
                    Call seller
                  </a>
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* Similar listings */}
        {similar.length > 0 && (
          <section className="border-t border-border mt-2 pt-8 pb-4">
            <div className="px-4 lg:px-6 flex items-end justify-between mb-4">
              <h2 className="text-lg font-bold text-content">Similar listings</h2>
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/marketplace?category=${encodeURIComponent(product.category)}`
                  )
                }
                className="text-sm font-semibold text-primary-600 hover:text-primary-700"
              >
                See all
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto px-4 lg:px-6 pb-2 snap-x snap-mandatory scrollbar-hover">
              {similar.map((item) => {
                const thumb = item.images?.[0] || FALLBACK_IMAGE;
                const itemLoc = formatProductLocation(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => router.push(`/marketplace/${item.id}`)}
                    className="shrink-0 w-[160px] sm:w-[180px] snap-start text-left group"
                  >
                    <div className="aspect-square rounded-xl overflow-hidden bg-surface-secondary mb-2">
                      <img
                        src={thumb}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            FALLBACK_IMAGE;
                        }}
                      />
                    </div>
                    <p className="text-[15px] font-bold text-content truncate">
                      {formatProductPrice(item)}
                    </p>
                    <p className="text-sm text-content line-clamp-2 leading-snug mt-0.5">
                      {item.title}
                    </p>
                    {itemLoc && (
                      <p className="text-xs text-content-secondary truncate mt-1">
                        {itemLoc}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Sticky mobile action bar */}
      {!isOwnProduct && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border-subtle bg-surface/95 backdrop-blur-md px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2 max-w-lg mx-auto">
            <button
              type="button"
              onClick={handleContactSeller}
              disabled={contactingSeller}
              className="flex-1 h-12 rounded-xl font-semibold text-[15px] bg-surface-secondary text-content hover:bg-surface-hover disabled:opacity-50 transition-all active:scale-[0.98] inline-flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              {contactingSeller ? "…" : "Message"}
            </button>
            {product.contact_phone && (
              <a
                href={`tel:${product.contact_phone}`}
                className="shrink-0 h-12 w-12 rounded-xl border border-border flex items-center justify-center text-content hover:bg-surface-hover transition-colors active:scale-95"
                aria-label="Call seller"
              >
                <Phone className="w-5 h-5" />
              </a>
            )}
            <button
              type="button"
              onClick={handleBuyNow}
              disabled={!canPurchase}
              className={`flex-1 h-12 rounded-xl font-semibold text-[15px] inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                canPurchase
                  ? "bg-primary-600 text-white hover:bg-primary-700"
                  : "bg-surface-secondary text-content-tertiary cursor-not-allowed"
              }`}
            >
              <ShoppingCart className="w-5 h-5" />
              {isOutOfStock || isUnavailable ? "Unavailable" : "Buy now"}
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Image gallery"
        >
          <div className="flex items-center justify-between px-3 h-14 shrink-0">
            <span className="text-white/80 text-sm tabular-nums px-2">
              {selectedImage + 1}/{images.length}
            </span>
            <button
              type="button"
              onClick={() => {
                setLightboxOpen(false);
                setLightboxZoom(1);
              }}
              className="p-2 rounded-full text-white hover:bg-white/10 transition-colors"
              aria-label="Close gallery"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div
            className="flex-1 relative flex items-center justify-center overflow-hidden touch-pan-y"
            onTouchStart={onGalleryTouchStart}
            onTouchEnd={onGalleryTouchEnd}
            onDoubleClick={() =>
              setLightboxZoom((z) => (z > 1 ? 1 : 2.5))
            }
          >
            <img
              src={images[selectedImage]}
              alt={`${product.title} — fullscreen ${selectedImage + 1}`}
              className="max-w-full max-h-full object-contain select-none transition-transform duration-200"
              style={{
                transform: `scale(${lightboxZoom})`,
                cursor: lightboxZoom > 1 ? "zoom-out" : "zoom-in",
              }}
              draggable={false}
              onClick={() => setLightboxZoom((z) => (z > 1 ? 1 : 2.5))}
            />

            {hasMultipleImages && (
              <>
                <button
                  type="button"
                  onClick={() => goToImage(selectedImage - 1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={() => goToImage(selectedImage + 1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {hasMultipleImages && (
            <div className="flex gap-2 justify-center px-4 py-4 overflow-x-auto shrink-0">
              {images.map((image, index) => (
                <button
                  key={`lb-${index}`}
                  type="button"
                  onClick={() => {
                    setSelectedImage(index);
                    setLightboxZoom(1);
                  }}
                  className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden ring-2 transition-all ${
                    selectedImage === index
                      ? "ring-white opacity-100"
                      : "ring-transparent opacity-50"
                  }`}
                >
                  <img
                    src={image}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default ProductDetailPage;
