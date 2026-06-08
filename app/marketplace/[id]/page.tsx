"use client";



import React, { useEffect, useState } from "react";

import { useParams, useRouter } from "next/navigation";

import { formatDistanceToNow } from "date-fns";

import {
  ArrowLeft,
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
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";

import { useProductionChat } from "@/contexts/ProductionChatContext";

import { apiClient } from "@/lib/api-client";

import { Product } from "@/shared/types";

import toast from "react-hot-toast";

import ProductReviews from "@/features/marketplace/components/ProductReviews";

import SmartCheckout from "@/features/marketplace/components/SmartCheckout";

import { startMarketplaceConversation } from "@/features/marketplace/services/marketplaceInboxService";

import { buildMarketplaceSeedThread } from "@/features/marketplace/utils/marketplaceChatThread";

import {
  formatProductLocation,

  formatProductPrice,
} from "@/features/marketplace/utils/productFormatting";

import { ProductDetailPageShimmer } from "@/shared/components/ui/ShimmerLoaders";



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

  const [showCheckout, setShowCheckout] = useState(false);

  const [contactingSeller, setContactingSeller] = useState(false);



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



  if (loading) {

    return <ProductDetailPageShimmer />;

  }



  if (!product) {

    return (

      <div className="min-h-screen px-1 sm:px-2 py-2">

        <div className="max-w-5xl mx-auto text-center">

          <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />

          <h2 className="text-xl font-bold text-gray-900 mb-2">Product not found</h2>

          <button

            onClick={() => router.push("/marketplace")}

            className="text-primary-600 hover:text-primary-700 font-medium text-sm"

          >

            Back to Marketplace

          </button>

        </div>

      </div>

    );

  }



  const images = product.images || [];

  const hasMultipleImages = images.length > 1;

  const isOutOfStock = product.stock_quantity === 0;

  const isUnavailable = !product.is_available;

  const isOwnProduct = user?.id === product.seller_id;

  const location = formatProductLocation(product);

  const canPurchase = !isOutOfStock && !isUnavailable && !isOwnProduct;



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

    setShowCheckout(true);

  };



  return (

    <div className="min-h-screen px-1 sm:px-2 py-1">

      <div className="max-w-5xl mx-auto w-full min-w-0">

        <button

          type="button"

          onClick={() => router.push("/marketplace")}

          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-1 text-sm"

        >

          <ArrowLeft className="w-4 h-4 shrink-0" />

          Marketplace

        </button>



        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">

          <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x md:divide-gray-100">

            {/* Image gallery */}

            <div className="min-w-0">

              <div className="relative aspect-square bg-gray-100">

                <img

                  src={

                    images[selectedImage] ||

                    "https://via.placeholder.com/600x600?text=No+Image"

                  }

                  alt={product.title}

                  className="absolute inset-0 w-full h-full object-cover"

                />

                {(isOutOfStock || isUnavailable) && (

                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">

                    <span className="bg-white text-gray-900 text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wide">

                      {isOutOfStock ? "Sold out" : "Unavailable"}

                    </span>

                  </div>

                )}

              </div>



              {hasMultipleImages && (

                <div className="flex gap-1.5 p-1.5 overflow-x-auto scrollbar-hover">

                  {images.map((image, index) => (

                    <button

                      key={index}

                      type="button"

                      onClick={() => setSelectedImage(index)}

                      className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${

                        selectedImage === index

                          ? "border-primary-600"

                          : "border-transparent hover:border-gray-300"

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



            {/* Listing info */}

            <div className="p-2.5 sm:p-3 flex flex-col min-w-0">

              <div className="flex items-start justify-between gap-3 mb-1">

                <p className="text-2xl font-bold text-gray-900">

                  {formatProductPrice(product)}

                </p>

                <div className="flex items-center gap-1 shrink-0">

                  <button

                    type="button"

                    onClick={handleShare}

                    className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"

                    aria-label="Share"

                  >

                    <Share2 className="w-4 h-4" />

                  </button>

                  <button

                    type="button"

                    onClick={handleSave}

                    className={`p-2 rounded-full transition-colors ${

                      isSaved

                        ? "text-white bg-primary-600"

                        : "text-gray-500 hover:text-primary-600 hover:bg-gray-100"

                    }`}

                    aria-label={isSaved ? "Unsave" : "Save"}

                  >

                    <Heart className={`w-4 h-4 ${isSaved ? "fill-current" : ""}`} />

                  </button>

                </div>

              </div>



              <h1 className="text-base sm:text-lg font-semibold text-gray-900 leading-snug mb-1.5">

                {product.title}

              </h1>



              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mb-2">

                <span>

                  Listed {formatDistanceToNow(new Date(product.created_at), { addSuffix: true })}

                </span>

                {location && (

                  <span className="flex items-center min-w-0">

                    <MapPin className="w-3 h-3 mr-1 shrink-0" />

                    <span className="truncate">{location}</span>

                  </span>

                )}

                <span className="flex items-center shrink-0">

                  <Eye className="w-3 h-3 mr-1" />

                  {product.views_count || 0} views

                </span>

              </div>



              <div className="flex flex-wrap gap-1.5 text-xs mb-2.5">

                <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full capitalize">

                  {product.category}

                </span>

                <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full capitalize">

                  {product.condition}

                </span>

                {product.shipping_available && (

                  <span className="px-2.5 py-1 bg-green-50 text-green-700 rounded-full flex items-center gap-1">

                    <Truck className="w-3 h-3" />

                    Shipping

                  </span>

                )}

              </div>



              <div className="mt-auto space-y-2">

                <button

                  type="button"

                  onClick={handleContactSeller}

                  disabled={contactingSeller || isOwnProduct}

                  className={`w-full py-2 px-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${

                    contactingSeller || isOwnProduct

                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"

                      : "bg-primary-600 text-white hover:bg-primary-700"

                  }`}

                >

                  <MessageCircle className="w-4 h-4" />

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

                  className={`w-full py-2 px-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 border transition-colors ${

                    canPurchase

                      ? "border-primary-600 text-primary-600 hover:bg-primary-50"

                      : "border-gray-200 text-gray-400 cursor-not-allowed"

                  }`}

                >

                  <ShoppingCart className="w-4 h-4" />

                  {isOwnProduct

                    ? "Your product"

                    : isOutOfStock

                    ? "Out of stock"

                    : isUnavailable

                    ? "Unavailable"

                    : "Buy now"}

                </button>



                {product.contact_phone && (

                  <a

                    href={`tel:${product.contact_phone}`}

                    className="w-full py-2 px-3 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 font-medium text-sm"

                  >

                    <Phone className="w-4 h-4" />

                    Call seller

                  </a>

                )}

              </div>

            </div>

          </div>

        </div>



        {/* Description */}

        <section className="mt-1.5 bg-white rounded-xl border border-gray-100 p-2.5 sm:p-3 shadow-sm">

          <h2 className="text-sm font-semibold text-gray-900 mb-2">Description</h2>

          <p className="text-sm text-gray-600 whitespace-pre-wrap break-words leading-relaxed">

            {product.description}

          </p>

          {product.stock_quantity > 0 && (

            <p className="text-xs text-gray-500 mt-1.5">

              {product.stock_quantity} available

            </p>

          )}

        </section>



        {/* Seller */}

        <section className="mt-1.5 bg-white rounded-xl border border-gray-100 p-2.5 sm:p-3 shadow-sm">

          <h2 className="text-sm font-semibold text-gray-900 mb-2">Seller information</h2>

          <div className="flex items-center gap-3 min-w-0">

            <img

              src={

                product.seller?.avatar_url ||

                `https://ui-avatars.com/api/?name=${

                  product.seller?.full_name || "User"

                }&background=random`

              }

              alt={product.seller?.full_name || "Seller"}

              className="w-10 h-10 rounded-full object-cover shrink-0"

            />

            <div className="flex-1 min-w-0">

              <p className="font-medium text-gray-900 text-sm truncate">

                {product.seller?.full_name || "Unknown"}

              </p>

              <p className="text-xs text-gray-500 truncate">

                @{product.seller?.username || "unknown"}

              </p>

            </div>

          </div>

          {product.seller?.bio && (

            <p className="text-sm text-gray-600 mt-2 line-clamp-3">{product.seller.bio}</p>

          )}

        </section>



        {/* Safety */}

        <section className="mt-1.5 bg-blue-50 border border-blue-100 rounded-xl p-2.5 shadow-sm">

          <div className="flex items-start gap-3">

            <Shield className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />

            <div className="text-xs sm:text-sm min-w-0">

              <h3 className="font-semibold text-blue-900 mb-1">Stay safe</h3>

              <ul className="text-blue-700 space-y-0.5">

                <li>Meet in a safe, public location</li>

                <li>Inspect items before purchasing</li>

                <li>Don&apos;t send money in advance</li>

              </ul>

            </div>

          </div>

        </section>



        {/* Reviews */}

        <section className="mt-1.5 w-full min-w-0">

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



      <SmartCheckout

        product={product}

        isOpen={showCheckout}

        onClose={() => setShowCheckout(false)}

        onSuccess={() => {

          setShowCheckout(false);

          toast.success("Order placed successfully!");

          router.push("/my-orders");

        }}

      />

    </div>

  );

};



export default ProductDetailPage;

