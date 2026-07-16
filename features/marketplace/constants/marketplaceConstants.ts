import {
  FiGrid,
  FiShoppingBag,
  FiFeather,
  FiSmartphone,
  FiCoffee,
  FiHeart,
  FiHome,
  FiBookOpen,
  FiImage,
  FiGift,
  FiTool,
  FiPackage,
} from "react-icons/fi";
import {
  Home,
  Bookmark,
  Clock,
  ChevronRight,
  ShoppingBag,
  Tag as TagIcon,
  Inbox,
} from "lucide-react";

export type MarketplaceSort = "newest" | "price-asc" | "price-desc" | "featured";
export type MarketplaceHub = "browse" | "inbox" | "buying" | "selling";
export type BuyingTab = "activity" | "saved" | "orders";
export {
  MARKETPLACE_INBOX_LABELS,
  type MarketplaceInboxLabel,
  type MarketplaceInboxRole,
} from "@/lib/marketplace/orderStatus";

export const MARKETPLACE_HUB_LINKS = [
  { hub: "browse" as const, label: "Browse all", icon: Home, path: "/marketplace" },
  {
    hub: "inbox" as const,
    label: "Inbox",
    icon: Inbox,
    path: "/marketplace/inbox",
    requiresAuth: true,
  },
  {
    hub: "buying" as const,
    label: "Buying",
    icon: ShoppingBag,
    path: "/marketplace/buying",
    requiresAuth: true,
  },
  {
    hub: "selling" as const,
    label: "Selling",
    icon: TagIcon,
    path: "/marketplace/selling",
    requiresAuth: true,
  },
];

export const BUYING_TABS: { value: BuyingTab; label: string; icon: typeof Clock }[] = [
  { value: "activity", label: "Recent activity", icon: Clock },
  { value: "saved", label: "Saved", icon: Bookmark },
  { value: "orders", label: "Purchase history", icon: ShoppingBag },
];

export const MARKETPLACE_SORT_OPTIONS: { value: MarketplaceSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

export const MARKETPLACE_CATEGORIES = [
  { value: "", label: "All Categories", icon: FiGrid },
  { value: "fashion", label: "Fashion", icon: FiShoppingBag },
  { value: "crafts", label: "Crafts", icon: FiFeather },
  { value: "electronics", label: "Electronics", icon: FiSmartphone },
  { value: "food", label: "Food & Beverages", icon: FiCoffee },
  { value: "beauty", label: "Beauty & Care", icon: FiHeart },
  { value: "home", label: "Home & Living", icon: FiHome },
  { value: "books", label: "Books", icon: FiBookOpen },
  { value: "art", label: "Art", icon: FiImage },
  { value: "jewelry", label: "Jewelry", icon: FiGift },
  { value: "services", label: "Services", icon: FiTool },
  { value: "other", label: "Other", icon: FiPackage },
];

export const MARKETPLACE_CURRENCIES = [
  { value: "", label: "All Currencies" },
  { value: "USD", label: "USD ($)" },
  { value: "GHS", label: "GHS (₵)" },
  { value: "NGN", label: "NGN (₦)" },
  { value: "KES", label: "KES (KSh)" },
  { value: "ZAR", label: "ZAR (R)" },
  { value: "XOF", label: "XOF (CFA)" },
  { value: "XAF", label: "XAF (FCFA)" },
];

export const MARKETPLACE_COUNTRIES = [
  { value: "", label: "All locations" },
  { value: "Ghana", label: "Ghana" },
  { value: "Nigeria", label: "Nigeria" },
  { value: "Kenya", label: "Kenya" },
  { value: "South Africa", label: "South Africa" },
  { value: "Senegal", label: "Senegal" },
  { value: "Ivory Coast", label: "Ivory Coast" },
  { value: "Cameroon", label: "Cameroon" },
  { value: "Ethiopia", label: "Ethiopia" },
  { value: "Tanzania", label: "Tanzania" },
  { value: "Uganda", label: "Uganda" },
  { value: "Rwanda", label: "Rwanda" },
  { value: "Egypt", label: "Egypt" },
  { value: "Morocco", label: "Morocco" },
  { value: "United States", label: "United States" },
  { value: "United Kingdom", label: "United Kingdom" },
  { value: "Canada", label: "Canada" },
  { value: "France", label: "France" },
  { value: "Germany", label: "Germany" },
];

export const CREATE_LISTING_PATH = "/marketplace/selling/create";

export const PRODUCT_CATEGORIES = [
  { value: "fashion", label: "Fashion" },
  { value: "crafts", label: "Crafts" },
  { value: "electronics", label: "Electronics" },
  { value: "food", label: "Food & Beverages" },
  { value: "beauty", label: "Beauty & Care" },
  { value: "home", label: "Home & Living" },
  { value: "books", label: "Books" },
  { value: "art", label: "Art" },
  { value: "jewelry", label: "Jewelry" },
  { value: "services", label: "Services" },
  { value: "other", label: "Other" },
];

export const PRODUCT_CURRENCIES = [
  { value: "USD", label: "USD ($)" },
  { value: "GHS", label: "GHS (₵)" },
  { value: "NGN", label: "NGN (₦)" },
  { value: "KES", label: "KES (KSh)" },
  { value: "ZAR", label: "ZAR (R)" },
  { value: "XOF", label: "XOF (CFA)" },
  { value: "XAF", label: "XAF (FCFA)" },
];

export const PRODUCT_CONDITIONS = [
  { value: "new", label: "New" },
  { value: "like-new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
];

export const LISTING_COUNTRIES = MARKETPLACE_COUNTRIES.filter((c) => c.value !== "");

export { ChevronRight };
