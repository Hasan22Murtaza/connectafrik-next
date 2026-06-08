"use client";

import { User } from "@supabase/supabase-js";
import { Plus, Settings } from "lucide-react";
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
  children?: React.ReactNode;
}

const MarketplaceHubNav: React.FC<MarketplaceHubNavProps> = ({
  activeHub,
  user,
  onCreateListing,
  compact = false,
  children,
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
      className={`${MP.navItem} ${
        isActive ? MP.navItemActive : MP.navItemInactive
      }`}
    >
      <Icon
        className={`${MP.navIcon} ${
          isActive ? MP.navIconActive : MP.navIconInactive
        }`}
      />
      <span className="flex-1 text-left">{label}</span>
      {showChevron && (
        <ChevronRight className="w-4 h-4 shrink-0 text-gray-500" />
      )}
    </button>
  );

  return (
    <div className={compact ? "mb-3" : MP.section}>
      {!compact && (
        <div className={`hidden md:flex ${MP.sidebarHeader}`}>
          <h2 className={MP.pageTitleLg}>Marketplace</h2>
          <button
            type="button"
            className={MP.settingsBtn}
            aria-label="Marketplace settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      )}

      {children}

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
