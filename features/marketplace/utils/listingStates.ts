import { getListingState, getListingTip } from "@/features/marketplace/components/SellerListingActions";
import { DRAFT_TAG, hasTag } from "@/features/marketplace/utils/listingTags";
import { Product } from "@/shared/types";

const RENEW_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

export type SellerListingFilter =
  | "all"
  | "active"
  | "sold"
  | "draft"
  | "pending"
  | "needs-attention"
  | "active-pending"
  | "renew";

export function isDraftListing(product: Product) {
  return hasTag(product.tags, DRAFT_TAG);
}

export function listingNeedsAttention(product: Product) {
  if (isDraftListing(product)) return false;
  const { isPending } = getListingState(product);
  const noImages = !product.images?.length;
  return isPending || noImages || Boolean(getListingTip(product.title));
}

export function listingNeedsRenew(product: Product) {
  if (isDraftListing(product)) return false;
  const { isActive } = getListingState(product);
  if (!isActive) return false;
  return Date.now() - new Date(product.created_at).getTime() > RENEW_AFTER_MS;
}

export function matchesSellerListingFilter(product: Product, filter: SellerListingFilter) {
  const { isActive, isPending, isSold } = getListingState(product);
  const draft = isDraftListing(product);

  switch (filter) {
    case "active":
      return isActive && !draft;
    case "sold":
      return isSold && !draft;
    case "draft":
      return draft;
    case "pending":
      return isPending && !draft;
    case "needs-attention":
      return listingNeedsAttention(product);
    case "active-pending":
      return (isActive || isPending) && !draft;
    case "renew":
      return listingNeedsRenew(product);
    default:
      return true;
  }
}

export function classifySellerListings(listings: Product[]) {
  const published = listings.filter((item) => !isDraftListing(item));
  return {
    needsAttention: published.filter(listingNeedsAttention).length,
    activePending: published.filter((item) => {
      const { isActive, isPending } = getListingState(item);
      return isActive || isPending;
    }).length,
    soldOut: published.filter((item) => getListingState(item).isSold).length,
    drafts: listings.filter(isDraftListing).length,
    toRenew: published.filter(listingNeedsRenew).length,
    active: published.filter((item) => getListingState(item).isActive).length,
    totalViews: listings.reduce((sum, item) => sum + (item.views_count || 0), 0),
    total: listings.length,
  };
}
