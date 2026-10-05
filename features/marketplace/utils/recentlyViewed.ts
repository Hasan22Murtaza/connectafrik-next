import { Product } from "@/shared/types";
import { formatProductLocation } from "./productFormatting";

const STORAGE_KEY = "cribshub.marketplace.recentlyViewed";
const MAX_ITEMS = 24;

export interface RecentListing {
  id: string;
  title: string;
  price: number;
  currency: string;
  image: string | null;
  location: string | null;
  condition: string;
  viewed_at: string;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readRecentlyViewed(): RecentListing[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is RecentListing =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as RecentListing).id === "string" &&
        typeof (item as RecentListing).title === "string"
    );
  } catch {
    return [];
  }
}

export function recordRecentlyViewed(product: Product): RecentListing[] {
  if (!canUseStorage() || !product?.id) return readRecentlyViewed();

  const next: RecentListing = {
    id: product.id,
    title: product.title,
    price: product.price,
    currency: product.currency,
    image: product.images?.[0] || null,
    location: formatProductLocation(product),
    condition: product.condition,
    viewed_at: new Date().toISOString(),
  };

  const existing = readRecentlyViewed().filter((item) => item.id !== product.id);
  const updated = [next, ...existing].slice(0, MAX_ITEMS);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore quota errors; browsing should still work.
  }

  return updated;
}
