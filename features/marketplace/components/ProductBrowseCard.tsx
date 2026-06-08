import React from "react";
import { Product } from "@/shared/types";
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
      className="group cursor-pointer rounded-lg overflow-hidden bg-white hover:bg-gray-50 transition-colors"
      onClick={() => onView(product.id)}
      aria-label={`${product.title} - ${formatProductPrice(product)}`}
    >
      <div className="relative aspect-square overflow-hidden bg-gray-100 rounded-lg">
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
          <span className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-gray-800 text-xs font-semibold px-2 py-1 rounded shadow-sm">
            Just listed
          </span>
        )}

        {product.is_featured && !justListed && (
          <span className="absolute top-2 left-2 bg-primary-600 text-white text-xs font-semibold px-2 py-1 rounded">
            Featured
          </span>
        )}

        {(isOutOfStock || isUnavailable) && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white text-gray-900 text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wide">
              {isOutOfStock ? "Sold out" : "Unavailable"}
            </span>
          </div>
        )}
      </div>

      <div className="pt-2 px-0.5 pb-1 min-w-0">
        <p className="text-base font-bold text-gray-900 truncate">
          {formatProductPrice(product)}
        </p>
        <h3 className="text-sm text-gray-800 line-clamp-2 leading-snug mt-0.5">
          {product.title}
        </h3>
        {location && (
          <p className="text-xs text-gray-500 truncate mt-1">{location}</p>
        )}
      </div>
    </article>
  );
};

export default ProductBrowseCard;
