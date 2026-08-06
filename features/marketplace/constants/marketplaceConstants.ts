import {
  FiGrid,
  FiHome,
  FiSmartphone,
  FiCpu,
  FiShoppingBag,
  FiHeart,
  FiActivity,
  FiSun,
  FiTool,
  FiBookOpen,
  FiAward,
  FiTruck,
  FiGift,
  FiPackage,
  FiFeather,
  FiBriefcase,
  FiUsers,
  FiBox,
} from "react-icons/fi";
import {
  Home,
  Bookmark,
  Clock,
  ChevronRight,
  ShoppingBag,
  Tag as TagIcon,
  Inbox,
} from "@/shared/icons";

export type MarketplaceSort =
  | "newest"
  | "oldest"
  | "price-asc"
  | "price-desc"
  | "featured"
  | "nearest"
  | "popular";

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
    label: "My Listings",
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
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "price-asc", label: "Lowest Price" },
  { value: "price-desc", label: "Highest Price" },
  { value: "nearest", label: "Nearest" },
  { value: "popular", label: "Most Popular" },
  { value: "featured", label: "Featured" },
];

export type TradeHubSubcategory = {
  value: string;
  label: string;
};

export type TradeHubCategory = {
  value: string;
  label: string;
  description?: string;
  icon: typeof FiGrid;
  subcategories: TradeHubSubcategory[];
};

/** Full TradeHub category tree with subcategories (create + filter). */
export const TRADEHUB_CATEGORIES: TradeHubCategory[] = [
  {
    value: "furniture",
    label: "Furniture",
    description: "Household furnishings and décor.",
    icon: FiHome,
    subcategories: [
      { value: "sofas", label: "Sofas" },
      { value: "chairs", label: "Chairs" },
      { value: "tables", label: "Tables" },
      { value: "dining-sets", label: "Dining Sets" },
      { value: "beds", label: "Beds" },
      { value: "dressers", label: "Dressers" },
      { value: "bookshelves", label: "Bookshelves" },
      { value: "office-furniture", label: "Office Furniture" },
    ],
  },
  {
    value: "electronics",
    label: "Electronics",
    description: "Consumer and home electronic devices.",
    icon: FiSmartphone,
    subcategories: [
      { value: "tvs", label: "TVs" },
      { value: "computers", label: "Computers" },
      { value: "laptops", label: "Laptops" },
      { value: "tablets", label: "Tablets" },
      { value: "printers", label: "Printers" },
      { value: "speakers", label: "Speakers" },
      { value: "cameras", label: "Cameras" },
      { value: "gaming-consoles", label: "Gaming Consoles" },
    ],
  },
  {
    value: "appliances",
    label: "Appliances",
    description: "Large and small household appliances.",
    icon: FiCpu,
    subcategories: [
      { value: "refrigerators", label: "Refrigerators" },
      { value: "stoves", label: "Stoves" },
      { value: "microwaves", label: "Microwaves" },
      { value: "washers", label: "Washers" },
      { value: "dryers", label: "Dryers" },
      { value: "coffee-makers", label: "Coffee Makers" },
      { value: "blenders", label: "Blenders" },
      { value: "vacuum-cleaners", label: "Vacuum Cleaners" },
    ],
  },
  {
    value: "clothing-accessories",
    label: "Clothing & Accessories",
    icon: FiShoppingBag,
    subcategories: [
      { value: "mens-clothing", label: "Men's Clothing" },
      { value: "womens-clothing", label: "Women's Clothing" },
      { value: "childrens-clothing", label: "Children's Clothing" },
      { value: "shoes", label: "Shoes" },
      { value: "handbags", label: "Handbags" },
      { value: "jewelry", label: "Jewelry" },
      { value: "watches", label: "Watches" },
    ],
  },
  {
    value: "baby-kids",
    label: "Baby & Kids",
    icon: FiHeart,
    subcategories: [
      { value: "strollers", label: "Strollers" },
      { value: "cribs", label: "Cribs" },
      { value: "toys", label: "Toys" },
      { value: "childrens-books", label: "Children's Books" },
      { value: "car-seats", label: "Car Seats" },
      { value: "baby-clothing", label: "Baby Clothing" },
      { value: "playpens", label: "Playpens" },
    ],
  },
  {
    value: "sports-recreation",
    label: "Sports & Recreation",
    icon: FiActivity,
    subcategories: [
      { value: "bicycles", label: "Bicycles" },
      { value: "treadmills", label: "Treadmills" },
      { value: "weights", label: "Weights" },
      { value: "skates", label: "Skates" },
      { value: "camping-gear", label: "Camping Gear" },
      { value: "golf-clubs", label: "Golf Clubs" },
      { value: "fishing-equipment", label: "Fishing Equipment" },
    ],
  },
  {
    value: "home-garden",
    label: "Home & Garden",
    icon: FiSun,
    subcategories: [
      { value: "plants", label: "Plants" },
      { value: "gardening-tools", label: "Gardening Tools" },
      { value: "lawn-equipment", label: "Lawn Equipment" },
      { value: "patio-furniture", label: "Patio Furniture" },
      { value: "decorative-items", label: "Decorative Items" },
      { value: "lighting-fixtures", label: "Lighting Fixtures" },
    ],
  },
  {
    value: "tools-hardware",
    label: "Tools & Hardware",
    icon: FiTool,
    subcategories: [
      { value: "power-tools", label: "Power Tools" },
      { value: "hand-tools", label: "Hand Tools" },
      { value: "toolboxes", label: "Toolboxes" },
      { value: "ladders", label: "Ladders" },
      { value: "generators", label: "Generators" },
      { value: "workshop-equipment", label: "Workshop Equipment" },
    ],
  },
  {
    value: "books-movies-music",
    label: "Books, Movies & Music",
    icon: FiBookOpen,
    subcategories: [
      { value: "books", label: "Books" },
      { value: "magazines", label: "Magazines" },
      { value: "dvds", label: "DVDs" },
      { value: "cds", label: "CDs" },
      { value: "vinyl-records", label: "Vinyl Records" },
      { value: "musical-instruments", label: "Musical Instruments" },
    ],
  },
  {
    value: "collectibles-antiques",
    label: "Collectibles & Antiques",
    icon: FiAward,
    subcategories: [
      { value: "coins", label: "Coins" },
      { value: "stamps", label: "Stamps" },
      { value: "antiques", label: "Antiques" },
      { value: "artwork", label: "Artwork" },
      { value: "memorabilia", label: "Memorabilia" },
      { value: "trading-cards", label: "Trading Cards" },
    ],
  },
  {
    value: "vehicles-parts",
    label: "Vehicles & Parts",
    icon: FiTruck,
    subcategories: [
      { value: "cars", label: "Cars" },
      { value: "trucks", label: "Trucks" },
      { value: "motorcycles", label: "Motorcycles" },
      { value: "bicycles", label: "Bicycles" },
      { value: "tires", label: "Tires" },
      { value: "auto-parts", label: "Auto Parts" },
      { value: "accessories", label: "Accessories" },
    ],
  },
  {
    value: "pet-supplies",
    label: "Pet Supplies",
    icon: FiGift,
    subcategories: [
      { value: "pet-beds", label: "Pet Beds" },
      { value: "aquariums", label: "Aquariums" },
      { value: "cages", label: "Cages" },
      { value: "food-containers", label: "Food Containers" },
      { value: "leashes", label: "Leashes" },
      { value: "toys", label: "Toys" },
    ],
  },
  {
    value: "free-items",
    label: "Free Items",
    icon: FiPackage,
    subcategories: [
      { value: "used-furniture", label: "Used Furniture" },
      { value: "building-materials", label: "Building Materials" },
      { value: "household-items", label: "Household Items" },
      { value: "garden-supplies", label: "Garden Supplies" },
    ],
  },
  {
    value: "handmade-crafts",
    label: "Handmade & Crafts",
    icon: FiFeather,
    subcategories: [
      { value: "artwork", label: "Artwork" },
      { value: "crafts", label: "Crafts" },
      { value: "knitted-items", label: "Knitted Items" },
      { value: "custom-decor", label: "Custom Décor" },
      { value: "handmade-jewelry", label: "Handmade Jewelry" },
    ],
  },
  {
    value: "business-office",
    label: "Business & Office Supplies",
    icon: FiBriefcase,
    subcategories: [
      { value: "office-desks", label: "Office Desks" },
      { value: "filing-cabinets", label: "Filing Cabinets" },
      { value: "office-chairs", label: "Office Chairs" },
      { value: "computers", label: "Computers" },
      { value: "printers", label: "Printers" },
      { value: "storage-units", label: "Storage Units" },
    ],
  },
  {
    value: "community-giveaways",
    label: "Community Giveaways & Donations",
    icon: FiUsers,
    subcategories: [
      { value: "clothing-donations", label: "Clothing Donations" },
      { value: "household-essentials", label: "Household Essentials" },
      { value: "school-supplies", label: "School Supplies" },
      { value: "community-support", label: "Community Support Items" },
    ],
  },
  {
    value: "miscellaneous",
    label: "Miscellaneous",
    icon: FiBox,
    subcategories: [
      { value: "seasonal-decorations", label: "Seasonal Decorations" },
      { value: "hobby-items", label: "Hobby Items" },
      { value: "novelty-products", label: "Novelty Products" },
      { value: "mixed-lots", label: "Mixed Lots" },
    ],
  },
];

/** Browse filter list including “All”. */
export const MARKETPLACE_CATEGORIES = [
  { value: "", label: "All Categories", icon: FiGrid },
  ...TRADEHUB_CATEGORIES.map(({ value, label, icon }) => ({ value, label, icon })),
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

/** Create-listing category options (no “All”). */
export const PRODUCT_CATEGORIES = TRADEHUB_CATEGORIES.map(({ value, label }) => ({
  value,
  label,
}));

export function getSubcategoriesForCategory(categoryValue: string): TradeHubSubcategory[] {
  return (
    TRADEHUB_CATEGORIES.find((c) => c.value === categoryValue)?.subcategories ?? []
  );
}

export function getCategoryLabel(categoryValue: string): string {
  if (!categoryValue) return "All Categories";
  return (
    TRADEHUB_CATEGORIES.find((c) => c.value === categoryValue)?.label ||
    categoryValue
  );
}

export function getSubcategoryLabel(
  categoryValue: string,
  subcategoryValue: string
): string {
  const sub = getSubcategoriesForCategory(categoryValue).find(
    (s) => s.value === subcategoryValue
  );
  return sub?.label || subcategoryValue;
}

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
  { value: "for-parts", label: "For Parts" },
];

export const DATE_POSTED_OPTIONS = [
  { value: "", label: "Any time" },
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

export const LISTING_COUNTRIES = MARKETPLACE_COUNTRIES.filter((c) => c.value !== "");

export { ChevronRight };
