"use client";

import {
  getStripeConnectStatus,
  startStripeConnectOnboarding,
} from "@/features/marketplace/services/adminService";
import {
  addSavedCard,
  deleteSavedCard,
  fetchSavedCards,
  setDefaultCard,
  type SavedCard,
} from "@/features/marketplace/services/walletService";
import { getStripe } from "@/features/marketplace/services/stripeService";
import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  Elements,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { CreditCard, Loader2, Shield } from "lucide-react";
import { useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import WalletCard from "./WalletCard";

const NAME_PATTERN = /^[a-zA-Z\s'-]{2,50}$/;

const stripeElementOptions = {
  style: {
    base: {
      fontSize: "16px",
      color: "#374151",
      letterSpacing: "0.025em",
      fontFamily: "system-ui, sans-serif",
      "::placeholder": {
        color: "#9ca3af",
      },
    },
    invalid: {
      color: "#dc2626",
    },
  },
};

type CardFormValues = {
  cardHolderName: string;
};

function StripePayoutSection() {
  const searchParams = useSearchParams();
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [statusDetails, setStatusDetails] = useState<Record<string, unknown> | null>(null);

  const loadBankAccountStatus = useCallback(async () => {
    try {
      const data = await getStripeConnectStatus();
      setStatusDetails(data);

      if (!data?.stripe_connect_account_id) {
        setAccountStatus(null);
        return;
      }

      if (data.stripe_connect_payouts_enabled) {
        setAccountStatus("active");
      } else if (data.stripe_connect_onboarded) {
        setAccountStatus("pending");
      } else {
        setAccountStatus("pending");
      }
    } catch (error) {
      console.error("Error fetching bank account status:", error);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    loadBankAccountStatus();
  }, [loadBankAccountStatus]);

  useEffect(() => {
    const stripeReturn =
      searchParams.get("stripe") === "return" || searchParams.get("payments") === "true";

    if (stripeReturn) {
      const timer = window.setTimeout(() => {
        loadBankAccountStatus();
      }, 1000);
      return () => window.clearTimeout(timer);
    }
  }, [searchParams, loadBankAccountStatus]);

  const handleAddBankAccount = async () => {
    setConnecting(true);
    try {
      const { url } = await startStripeConnectOnboarding();
      window.location.href = url;
    } catch {
      toast.error("Failed to set up bank account. Please try again.");
      setConnecting(false);
    }
  };

  const statusBadgeClass =
    accountStatus === "active"
      ? "bg-green-100 text-green-800"
      : accountStatus === "pending"
        ? "bg-amber-100 text-amber-800"
        : "bg-surface-secondary text-content-secondary";

  const reserveBalance = Number(statusDetails?.seller_reserve_balance ?? 0);

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-content mb-1">Bank Account for Payouts</h2>
      <p className="text-sm text-content-secondary mb-4">
        Add your bank account to receive payouts directly after delivery confirmation.
      </p>

      {loadingStatus ? (
        <div className="flex items-center gap-2 text-sm text-content-secondary py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading payout account status...
        </div>
      ) : (
        <>
          {accountStatus && (
            <div className="mb-4">
              <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${statusBadgeClass}`}>
                Status: {accountStatus}
              </span>
            </div>
          )}

          {reserveBalance !== 0 && (
            <p className="text-sm text-content-secondary mb-4">
              Seller reserve balance:{" "}
              <span className="font-medium text-content">${reserveBalance.toLocaleString()}</span>
            </p>
          )}

          <button
            type="button"
            onClick={handleAddBankAccount}
            disabled={connecting || !statusDetails?.enabled}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {connecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                Processing...
              </>
            ) : accountStatus ? (
              "Update Bank Account"
            ) : (
              "Add Bank Account"
            )}
          </button>

          {!statusDetails?.enabled && (
            <p className="text-xs text-amber-700 mt-3">
              Stripe Connect is not configured on this platform yet.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function WalletCardForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<SavedCard | null>(null);
  const [loadingCards, setLoadingCards] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CardFormValues>({ mode: "onChange" });

  const loadCards = useCallback(async () => {
    setLoadingCards(true);
    try {
      const savedCards = await fetchSavedCards();
      setCards(savedCards);
      const defaultCard = savedCards.find((card) => card.is_default) ?? savedCards[0] ?? null;
      setSelectedCard(defaultCard);
    } catch {
      toast.error("Failed to load cards");
    } finally {
      setLoadingCards(false);
    }
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const clearCardElements = () => {
    if (!elements) return;
    elements.getElement(CardNumberElement)?.clear();
    elements.getElement(CardExpiryElement)?.clear();
    elements.getElement(CardCvcElement)?.clear();
  };

  const onSubmit = async (data: CardFormValues) => {
    setIsLoading(true);

    if (!stripe || !elements) {
      toast.error("Stripe is not loaded yet. Please wait.");
      setIsLoading(false);
      return;
    }

    const cardElement = elements.getElement(CardNumberElement);
    if (!cardElement) {
      toast.error("Card element not found");
      setIsLoading(false);
      return;
    }

    const { error: tokenError, token } = await stripe.createToken(cardElement);
    if (tokenError || !token) {
      toast.error(tokenError?.message || "Failed to tokenize card");
      setIsLoading(false);
      return;
    }

    try {
      const saved = await addSavedCard({
        name: data.cardHolderName,
        token: token.id,
      });

      setCards((prev) => [...prev, saved]);
      if (cards.length === 0) {
        setSelectedCard(saved);
      }
      toast.success("Card added successfully");
      reset();
      clearCardElements();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Card save failed";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCard = async (card: SavedCard) => {
    try {
      await setDefaultCard(card.payment_method_id);
      setCards((prev) =>
        prev.map((item) => ({
          ...item,
          is_default: item.id === card.id,
        }))
      );
      setSelectedCard(card);
      toast.success("Default card updated successfully");
    } catch {
      toast.error("Failed to update default card");
    }
  };

  const handleDeleteCard = async (card: SavedCard) => {
    try {
      await deleteSavedCard(card.payment_method_id);
      setCards((prev) => {
        const remaining = prev.filter((item) => item.id !== card.id);
        if (selectedCard?.id === card.id) {
          const nextDefault = remaining.find((item) => item.is_default) ?? remaining[0] ?? null;
          setSelectedCard(nextDefault);
        }
        return remaining;
      });
      toast.success("Card deleted successfully");
    } catch {
      toast.error("Failed to delete card");
    }
  };

  return (
    <>
      <div className="card p-6 mb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-content mb-1">Add New Card</h2>
            <p className="text-sm text-content-secondary">
              Save a card once and use it at checkout for marketplace orders.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-secondary px-3 py-1 text-xs font-medium text-content">
            <Shield className="w-3 h-3" />
            Secure
          </span>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-content mb-2">Card Holder Name</label>
              <input
                type="text"
                placeholder="Card Holder Name"
                className={`input-field ${errors.cardHolderName ? "border-red-500" : ""}`}
                {...register("cardHolderName", {
                  required: "Card holder name is required",
                  minLength: { value: 2, message: "Name must be at least 2 characters" },
                  maxLength: { value: 50, message: "Name must be less than 50 characters" },
                  pattern: {
                    value: NAME_PATTERN,
                    message: "Card holder name is invalid",
                  },
                })}
              />
              {errors.cardHolderName && (
                <p className="text-xs text-red-600 mt-1">{errors.cardHolderName.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-content mb-2">Card Number</label>
              <div className="input-field py-3">
                <CardNumberElement options={stripeElementOptions} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-content mb-2">Expiration Date</label>
              <div className="input-field py-3">
                <CardExpiryElement options={stripeElementOptions} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-content mb-2">CVC</label>
              <div className="input-field py-3">
                <CardCvcElement options={stripeElementOptions} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-content-secondary">
            <CreditCard className="w-4 h-4" />
            Visa, Mastercard, and other major cards accepted
          </div>

          <button
            type="submit"
            className="btn-primary text-sm disabled:opacity-50"
            disabled={!stripe || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                Loading...
              </>
            ) : (
              "Add Card"
            )}
          </button>
        </form>
      </div>

      {loadingCards ? (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-content mb-3">Payment Methods</h2>
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
          </div>
        </div>
      ) : cards.length > 0 ? (
        <div className="card p-6 mb-4">
          <h2 className="text-lg font-semibold text-content mb-3">Payment Methods</h2>
          {cards.map((card) => (
            <WalletCard
              key={card.id}
              card={card}
              selectedId={selectedCard?.id ?? null}
              cards={cards}
              onSelect={handleSelectCard}
              onDelete={handleDeleteCard}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

export default function SellerWallet() {
  const stripePromise = useMemo(() => getStripe(), []);

  return (
    <div className="space-y-4">
      {stripePromise ? (
        <Elements stripe={stripePromise}>
          <WalletCardForm />
        </Elements>
      ) : (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-content mb-3">Add New Card</h2>
          <div className="flex flex-col items-center py-4 text-sm text-content-secondary">
            <Loader2 className="w-6 h-6 animate-spin text-primary-600 mb-2" />
            Initializing payment form...
          </div>
        </div>
      )}

      <StripePayoutSection />
    </div>
  );
}
