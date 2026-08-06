import { Product } from "@/shared/types";
import React from "react";
import { hasTag, URGENT_TAG } from "../utils/listingTags";
import {
  formatProductLocation,
  formatProductPrice,
  isJustListed,
} from "../utils/productFormatting";

interface ProductBrowseCardProps {
  product: Product;
  onView: (productId: string) => void;
}

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400";

const ProductBrowseCard: React.FC<ProductBrowseCardProps> = ({
  product,
  onView,
}) => {
  const mainImage = product.images?.[0] || FALLBACK_IMAGE;
  const location = formatProductLocation(product);
  const isOutOfStock = product.stock_quantity === 0;
  const isUnavailable = !product.is_available;
  const justListed = isJustListed(product.created_at);
  const isUrgent = hasTag(product.tags, URGENT_TAG);
  const showStatusOverlay = isOutOfStock || isUnavailable;

  return (
    <article
      className="group cursor-pointer rounded-xl overflow-hidden bg-surface border border-border-subtle shadow-sm hover:bg-surface-hover hover:shadow-md transition-all duration-200"
      onClick={() => onView(product.id)}
      aria-label={`${product.title} - ${formatProductPrice(product)}`}
    >
      <div className="relative aspect-square overflow-hidden bg-surface-secondary">
        <img
          src={mainImage}
          alt={product.title}
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
          }}
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
        />

        {!showStatusOverlay && (
          <div className="absolute top-2 left-2 flex flex-col items-start gap-1 z-10">
            {justListed && (
              <span className="bg-surface/95 backdrop-blur-sm text-content text-[10px] font-semibold px-1.5 py-0.5 rounded shadow-sm">
                Just listed
              </span>
            )}
            {product.is_featured && (
              <span className="bg-primary-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded shadow-sm">
                Featured
              </span>
            )}
            {isUrgent && (
              <span className="bg-red-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded shadow-sm">
                Urgent
              </span>
            )}
          </div>
        )}

        {showStatusOverlay && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-surface text-content text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wide">
              {isOutOfStock ? "Sold out" : "Unavailable"}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1 px-3 pt-2.5 pb-3 min-w-0">
        <p className="text-base font-bold text-content truncate leading-none">
          {formatProductPrice(product)}
        </p>
        <h3 className="text-sm text-content line-clamp-2 leading-snug">
          {product.title}
        </h3>
        {location && (
          <p className="text-xs text-content-secondary truncate">{location}</p>
        )}
      </div>
    </article>
  );
};

export default ProductBrowseCard;
