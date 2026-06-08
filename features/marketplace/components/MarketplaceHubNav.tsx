"use client";

import { User } from "@supabase/supabase-js";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";
import toast from "react-hot-toast";
import {
  CREATE_LISTING_PATH,
  ChevronRight,
  MARKETPLACE_HUB_LINKS,
  MarketplaceHub,
} from "../constants/marketplaceConstants";
import { MP } from "../constants/marketplaceLayout";

interface MarketplaceHubNavProps {
  activeHub: MarketplaceHub;
  user: User | null;
  onCreateListing?: () => void;
  compact?: boolean;
}

const MarketplaceHubNav: React.FC<MarketplaceHubNavProps> = ({
  activeHub,
  user,
  onCreateListing,
  compact = false,
}) => {
  const router = useRouter();

  const handleHubClick = (hub: (typeof MARKETPLACE_HUB_LINKS)[number]) => {
    if (hub.requiresAuth && !user) {
      toast.error(`Please sign in to access ${hub.label}`);
      router.push(`/signin?redirect=${hub.path}`);
      return;
    }
    router.push(hub.path);
  };

  const renderItem = (
    isActive: boolean,
    onClick: () => void,
    label: string,
    Icon: React.ComponentType<{ className?: string }>,
    showChevron = false
  ) => (
    <button
      type="button"
      onClick={onClick}
      className={`${MP.navItem} ${isActive ? MP.navItemActive : MP.navItemInactive
        }`}
    >
      <span
        className={`${MP.navIndicator} ${isActive
            ? "opacity-100 scale-y-100"
            : "opacity-0 scale-y-0 group-hover:opacity-100 group-hover:scale-y-100"
          }`}
      />
      <Icon
        className={`${MP.navIcon} ${isActive ? MP.navIconActive : ""}`}
      />
      <span className="flex-1 text-left">{label}</span>
      {showChevron && (
        <ChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-400 group-hover:text-primary-600" />
      )}
    </button>
  );

  return (
    <div className={compact ? "mb-3" : MP.section}>
      {!compact && (
        <h2 className={`hidden md:block ${MP.pageTitle} mb-3 px-2`}>
          Marketplace
        </h2>
      )}

      <nav>
        <ul className={MP.navList}>
          {MARKETPLACE_HUB_LINKS.map((hub) =>
            hub.hub === "browse" ? (
              <li key={hub.hub}>
                {renderItem(
                  activeHub === hub.hub,
                  () => handleHubClick(hub),
                  hub.label,
                  hub.icon
                )}
              </li>
            ) : (
              <li key={hub.hub}>
                {renderItem(
                  activeHub === hub.hub,
                  () => handleHubClick(hub),
                  hub.label,
                  hub.icon,
                  true
                )}
              </li>
            )
          )}
        </ul>
      </nav>

      {!compact && (
        <>
          {user ? (
            <button
              type="button"
              onClick={() => {
                if (onCreateListing) {
                  onCreateListing();
                } else {
                  router.push(CREATE_LISTING_PATH);
                }
              }}
              className={MP.createListingBtn}
            >
              <Plus className="w-4 h-4" />
              Create new listing
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/signin?redirect=/marketplace")}
              className={MP.createListingBtn}
            >
              Sign in to sell
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default MarketplaceHubNav;
