import { Product } from "@/shared/types";
import React from "react";
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

  return (
    <article
      className="group cursor-pointer rounded-md overflow-hidden bg-surface hover:bg-surface-hover transition-colors"
      onClick={() => onView(product.id)}
      aria-label={`${product.title} - ${formatProductPrice(product)}`}
    >
      <div className="relative aspect-square overflow-hidden bg-surface-secondary rounded-md">
        <img
          src={mainImage}
          alt={product.title}
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
          }}
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
        />

        {justListed && !isOutOfStock && !isUnavailable && (
          <span className="absolute top-1.5 left-1.5 bg-surface/90 backdrop-blur-sm text-content text-[10px] font-semibold px-1.5 py-0.5 rounded shadow-sm">
            Just listed
          </span>
        )}

        {product.is_featured && !justListed && (
          <span className="absolute top-1.5 left-1.5 bg-primary-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
            Featured
          </span>
        )}

        {(isOutOfStock || isUnavailable) && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-surface text-content text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wide">
              {isOutOfStock ? "Sold out" : "Unavailable"}
            </span>
          </div>
        )}
      </div>

      <div className="pt-1 px-0 pb-0 min-w-0">
        <p className="text-sm font-bold text-content truncate leading-tight">
          {formatProductPrice(product)}
        </p>
        <h3 className="text-xs text-content line-clamp-2 leading-snug mt-0.5">
          {product.title}
        </h3>
        {location && (
          <p className="text-[11px] text-content-secondary truncate mt-0.5">{location}</p>
        )}
      </div>
    </article>
  );
};

export default ProductBrowseCard;
