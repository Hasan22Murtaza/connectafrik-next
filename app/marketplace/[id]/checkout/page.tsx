"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api-client";
import { Product } from "@/shared/types";
import SmartCheckout from "@/features/marketplace/components/SmartCheckout";
import { ProductDetailPageShimmer } from "@/shared/components/ui/ShimmerLoaders";
import toast from "react-hot-toast";

const CheckoutPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const id = params?.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace(`/signin?redirect=/marketplace/${id}/checkout`);
      return;
    }

    if (!id) return;

    const fetchProduct = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get<{ data: Product }>(`/api/marketplace/${id}`);
        setProduct(res.data);
      } catch (error) {
        console.error("Error fetching product for checkout:", error);
        toast.error("Unable to load this item");
        router.replace(`/marketplace/${id}`);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, user, authLoading, router]);

  useEffect(() => {
    if (authLoading || loading || !user || !product) return;

    const isOwnProduct = user.id === product.seller_id;
    const isOutOfStock =
      product.stock_quantity !== null &&
      product.stock_quantity !== undefined &&
      product.stock_quantity <= 0;
    const isUnavailable = !product.is_available;

    if (isOwnProduct || isOutOfStock || isUnavailable) {
      toast.error(
        isOwnProduct
          ? "You cannot purchase your own listing"
          : isOutOfStock
            ? "This item is out of stock"
            : "This item is unavailable"
      );
      router.replace(`/marketplace/${id}`);
    }
  }, [authLoading, loading, user, product, id, router]);

  if (authLoading || loading || !user) {
    return (
      <div className="min-h-screen px-4 py-6">
        <ProductDetailPageShimmer />
      </div>
    );
  }

  if (!product) {
    return null;
  }

  const isOwnProduct = user.id === product.seller_id;
  const isOutOfStock =
    product.stock_quantity !== null &&
    product.stock_quantity !== undefined &&
    product.stock_quantity <= 0;
  const isUnavailable = !product.is_available;

  if (isOwnProduct || isOutOfStock || isUnavailable) {
    return null;
  }

  return (
    <SmartCheckout
      product={product}
      onCancel={() => router.push(`/marketplace/${id}`)}
      onSuccess={() => {
        toast.success("Order placed successfully!");
        router.push("/my-orders");
      }}
    />
  );
};

export default CheckoutPage;
