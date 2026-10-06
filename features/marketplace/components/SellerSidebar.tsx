"use client";

import { CREATE_LISTING_PATH } from "@/features/marketplace/constants/marketplaceConstants";
import { MP } from "@/features/marketplace/constants/marketplaceLayout";
import { ArrowLeft, BarChart3, Plus, Tag } from "@/shared/icons";
import { usePathname, useRouter } from "next/navigation";
import React from "react";

type SellerNavId = "dashboard" | "listings";

const NAV_ITEMS: { id: SellerNavId; label: string; path: string; icon: typeof BarChart3 }[] = [
  { id: "dashboard", label: "Seller dashboard", path: "/marketplace/selling/dashboard", icon: BarChart3 },
  { id: "listings", label: "Your listings", path: "/marketplace/selling", icon: Tag },
];

export function SellerMobileNav() {
  const router = useRouter();
  const pathname = usePathname();
  const activeId: SellerNavId = pathname?.startsWith("/marketplace/selling/dashboard")
    ? "dashboard"
    : "listings";

  return (
    <div className="lg:hidden flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-hide">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => router.push(item.path)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium ${
            activeId === item.id
              ? "bg-primary-50 text-primary-600"
              : "bg-surface-secondary text-content-secondary"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

interface SellerSidebarProps {
  children?: React.ReactNode;
}

const SellerSidebar: React.FC<SellerSidebarProps> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const activeId: SellerNavId = pathname?.startsWith("/marketplace/selling/dashboard")
    ? "dashboard"
    : "listings";

  return (
    <aside className={`hidden lg:block ${MP.sidebarFull}`}>
      <button
        type="button"
        onClick={() => router.push("/marketplace")}
        className={`${MP.backLink} mb-2`}
      >
        <ArrowLeft className="w-4 h-4" />
        TradeHub
      </button>

      <div className={MP.sidebarTitleBlock}>
        <h2 className={MP.sidebarTitle}>Selling</h2>
      </div>

      <button
        type="button"
        onClick={() => router.push(CREATE_LISTING_PATH)}
        className={MP.createListingBtnTop}
      >
        <Plus className="w-4 h-4" />
        Create new listing
      </button>

      <nav className={MP.sidebarNav}>
        <ul className={MP.navList}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeId === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => router.push(item.path)}
                  className={`${MP.navItem} ${isActive ? MP.navItemActive : MP.navItemInactive}`}
                >
                  <Icon className={`${MP.navIcon} ${isActive ? MP.navIconActive : MP.navIconInactive}`} />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {children}
    </aside>
  );
};

export default SellerSidebar;
