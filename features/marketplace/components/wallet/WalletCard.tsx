"use client";

import { format } from "date-fns";
import { CreditCard, Trash2 } from "lucide-react";
import React, { useState } from "react";
import toast from "react-hot-toast";
import type { SavedCard } from "@/features/marketplace/services/walletService";

function CardBrandIcon({ brand, className = "" }: { brand?: string; className?: string }) {
  const brandLower = brand?.toLowerCase() || "";

  if (brandLower === "visa") {
    return (
      <span
        className={`inline-flex items-center justify-center rounded bg-[#1434CB] px-2 py-0.5 text-[10px] font-bold text-white ${className}`}
      >
        VISA
      </span>
    );
  }

  if (brandLower === "mastercard" || brandLower === "master") {
    return (
      <span
        className={`inline-flex h-5 w-8 items-center justify-center rounded bg-[#EB001B] text-[8px] font-bold text-white ${className}`}
      >
        MC
      </span>
    );
  }

  return <CreditCard className={`w-5 h-5 text-content-secondary ${className}`} />;
}

interface WalletCardProps {
  card: SavedCard;
  selectedId: string | null;
  cards: SavedCard[];
  onSelect: (card: SavedCard) => void;
  onDelete: (card: SavedCard) => void;
}

const WalletCard: React.FC<WalletCardProps> = ({
  card,
  selectedId,
  cards,
  onSelect,
  onDelete,
}) => {
  const [confirming, setConfirming] = useState(false);

  const handleDelete = () => {
    if (cards.length === 1) {
      toast.error("You must have at least one payment card saved.");
      return;
    }

    if (card.is_default || selectedId === card.id) {
      toast.error("You can't delete the default card. Set a different one as default first.");
      return;
    }

    setConfirming(true);
  };

  const confirmDelete = () => {
    setConfirming(false);
    onDelete(card);
  };

  return (
    <>
      <div className="rounded-lg border border-border bg-surface p-4 mb-3 hover:shadow-sm transition-shadow">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <input
              type="radio"
              className="text-primary-600 cursor-pointer shrink-0"
              checked={selectedId === card.id}
              onChange={() => onSelect(card)}
              aria-label={`Select card ending ${card.last_four}`}
            />
            <div className="flex items-center gap-2 min-w-0">
              <CardBrandIcon brand={card.card_brand} />
              <span className="text-sm font-medium text-content truncate">
                •••• {card.last_four}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 pl-7 sm:pl-0">
            <span className="text-xs text-content-secondary">
              {format(new Date(card.created_at), "MMM d, yyyy")}
            </span>
            {card.is_default && (
              <span className="text-xs font-semibold text-green-600">Default</span>
            )}
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 border border-red-200 rounded-md hover:bg-red-50"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-content mb-2">Delete card?</h3>
            <p className="text-sm text-content-secondary mb-6">
              Are you sure you want to delete this card ending in {card.last_four}?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WalletCard;
