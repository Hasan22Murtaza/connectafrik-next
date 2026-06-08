"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { User } from "@supabase/supabase-js";
import {
  MARKETPLACE_HUB_LINKS,
  MarketplaceHub,
  ChevronRight,
} from "../constants/marketplaceConstants";
import toast from "react-hot-toast";

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
      className={`group relative w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 ${
        isActive
          ? "bg-orange-50 text-primary-600"
          : "text-gray-500 hover:bg-gray-100 hover:text-primary-600"
      }`}
    >
      <span
        className={`absolute left-0 top-0 h-full w-[3px] rounded-r transition-all duration-200 ${
          isActive
            ? "bg-primary-600 opacity-100 scale-y-100"
            : "bg-primary-600 opacity-0 scale-y-0 group-hover:opacity-100 group-hover:scale-y-100"
        }`}
      />
      <Icon
        className={`w-[18px] h-[18px] shrink-0 transition-transform ${
          isActive ? "scale-110" : "group-hover:scale-110"
        }`}
      />
      <span className="text-sm font-medium flex-1 text-left">{label}</span>
      {showChevron && (
        <ChevronRight className="w-4 h-4 shrink-0 text-gray-400 group-hover:text-primary-600" />
      )}
    </button>
  );

  return (
    <div className={compact ? "mb-4" : "mb-5"}>
      {!compact && (
        <h2 className="hidden md:block text-xl font-bold text-gray-900 mb-4 px-2">
          Marketplace
        </h2>
      )}

      <nav>
        <ul className="space-y-1">
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
              onClick={onCreateListing}
              className="w-full mt-5 mb-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-primary-50 text-primary-600 font-semibold text-sm hover:bg-primary-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create new listing
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/signin?redirect=/marketplace")}
              className="w-full mt-5 mb-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-primary-50 text-primary-600 font-semibold text-sm hover:bg-primary-100 transition-colors"
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
