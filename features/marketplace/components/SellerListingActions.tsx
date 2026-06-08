"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Check,
  ExternalLink,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Pencil,
  RefreshCw,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import { Product } from "@/shared/types";

export type ListingActionMenuItem =
  | "renew"
  | "pending"
  | "view"
  | "list-elsewhere"
  | "edit"
  | "delete"
  | "messages";
interface SellerListingActionsProps {
  isActive: boolean;
  isPending: boolean;
  markingSold?: boolean;
  onMarkAsSold: () => void;
  onShare: () => void;
  onMenuAction: (action: ListingActionMenuItem) => void;
}

const SellerListingActions: React.FC<SellerListingActionsProps> = ({
  isActive,
  isPending,
  markingSold,
  onMarkAsSold,
  onShare,
  onMenuAction,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const menuItems: {
    action: ListingActionMenuItem;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    destructive?: boolean;
    hidden?: boolean;
  }[] = [
    { action: "renew", label: "Renew listing", icon: RefreshCw, hidden: isActive },
    {
      action: "pending",
      label: "Mark as pending",
      icon: Pause,
      hidden: !isActive,
    },
    { action: "view", label: "View listing", icon: ExternalLink },
    {
      action: "list-elsewhere",
      label: "List in more places",
      icon: Users,
    },
    { action: "edit", label: "Edit listing", icon: Pencil },
    { action: "delete", label: "Delete listing", icon: Trash2, destructive: true },
    { action: "messages", label: "View messages", icon: MessageCircle },
  ];

  const handleMenuClick = (action: ListingActionMenuItem) => {
    setMenuOpen(false);
    onMenuAction(action);
  };

  return (
    <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-100">
      {isActive && (
        <button
          type="button"
          onClick={onMarkAsSold}
          disabled={markingSold}
          className="flex-1 min-w-0 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          <Check className="w-4 h-4 shrink-0" />
          {markingSold ? "Updating..." : "Mark as sold"}
        </button>
      )}

      {isPending && (
        <span className="flex-1 py-2.5 px-3 rounded-lg bg-yellow-50 text-yellow-800 text-sm font-medium text-center">
          Pending
        </span>
      )}

      <button
        type="button"
        onClick={onShare}
        className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-900 text-sm font-semibold transition-colors shrink-0"
      >
        <Share2 className="w-4 h-4" />
        <span className="hidden sm:inline">Share</span>
      </button>

      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-900 transition-colors"
          aria-label="More listing options"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 bottom-full mb-2 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-30">
            {menuItems
              .filter((item) => !item.hidden)
              .map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.action}
                    type="button"
                    onClick={() => handleMenuClick(item.action)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors ${
                      item.destructive
                        ? "text-red-600 hover:bg-red-50"
                        : "text-gray-800 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0 text-gray-500" />
                    {item.label}
                  </button>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};

export function getListingState(product: Product) {
  const isPending = !product.is_available && product.stock_quantity > 0;
  const isActive = product.is_available && product.stock_quantity > 0;
  const isSold = !isActive && !isPending;

  let statusLabel = "Active";
  let statusClassName = "bg-green-100 text-green-700";

  if (isPending) {
    statusLabel = "Pending";
    statusClassName = "bg-yellow-100 text-yellow-800";
  } else if (isSold) {
    statusLabel = "Sold";
    statusClassName = "bg-gray-100 text-gray-700";
  }

  return { isActive, isPending, isSold, statusLabel, statusClassName };
}

export function getListingTip(title: string): string | null {
  if (title.trim().length < 20) {
    return "Tip: Add a longer title";
  }
  return null;
}

export default SellerListingActions;
