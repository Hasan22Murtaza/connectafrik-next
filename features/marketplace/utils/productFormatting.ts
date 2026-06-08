import { Product } from "@/shared/types";
import { MarketplaceSort } from "../constants/marketplaceConstants";

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  GHS: "₵",
  NGN: "₦",
  KES: "KSh",
  ZAR: "R",
  XOF: "CFA",
  XAF: "FCFA",
};

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}

export function formatProductPrice(product: Product): string {
  if (product.price === 0) return "FREE";
  return `${getCurrencySymbol(product.currency)}${product.price.toLocaleString()}`;
}

export function formatProductLocation(product: Product): string | null {
  if (product.location && product.country) {
    return `${product.location}, ${product.country}`;
  }
  return product.location || product.country || null;
}

const JUST_LISTED_MS = 48 * 60 * 60 * 1000;

export function isJustListed(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < JUST_LISTED_MS;
}

export function sortProducts(products: Product[], sort: MarketplaceSort): Product[] {
  const sorted = [...products];

  switch (sort) {
    case "price-asc":
      return sorted.sort((a, b) => a.price - b.price);
    case "price-desc":
      return sorted.sort((a, b) => b.price - a.price);
    case "featured":
      return sorted.sort((a, b) => {
        if (a.is_featured !== b.is_featured) {
          return a.is_featured ? -1 : 1;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    case "newest":
    default:
      return sorted.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  }
}
