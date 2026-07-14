"use client";

import { apiClient } from "@/lib/api-client";
import type { ProfileLocationValue } from "@/shared/types/location";
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Navigation,
  Search,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

export type ChatLocationSelection = {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
};

type Prediction = { label: string; placeId: string };

interface ChatLocationPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (place: ChatLocationSelection) => void;
}

const ChatLocationPicker: React.FC<ChatLocationPickerProps> = ({
  open,
  onClose,
  onSelect,
}) => {
  const sessionTokenRef = useRef(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}`
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentLoading, setCurrentLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Prediction[]>([]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSuggestions([]);
      setLoading(false);
      setCurrentLoading(false);
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 180);
    return () => window.clearTimeout(t);
  }, [open]);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.get<{ results: Prediction[] }>("/api/location-search", {
        q: q.trim(),
        sessionToken: sessionTokenRef.current,
      });
      setSuggestions(Array.isArray(res.results) ? res.results : []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void runSearch(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, runSearch]);

  const pickPrediction = async (p: Prediction) => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ details: ProfileLocationValue }>(
        "/api/location-search",
        {
          placeId: p.placeId,
          sessionToken: sessionTokenRef.current,
        }
      );
      const d = res.details;
      const name =
        d?.city?.trim() ||
        d?.formattedAddress?.split(",")[0]?.trim() ||
        p.label.split(",")[0]?.trim() ||
        p.label;
      onSelect({
        name,
        address: d?.formattedAddress || d?.address || p.label,
        lat: d?.latitude ?? undefined,
        lng: d?.longitude ?? undefined,
      });
      sessionTokenRef.current =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}`;
      onClose();
    } catch {
      onSelect({
        name: p.label.split(",")[0]?.trim() || p.label,
        address: p.label,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setCurrentLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          const res = await apiClient.get<{ details: ProfileLocationValue }>(
            "/api/location-search",
            { lat: String(lat), lng: String(lng) }
          );
          const d = res.details;
          onSelect({
            name:
              d?.city?.trim() ||
              d?.formattedAddress?.split(",")[0]?.trim() ||
              "Current location",
            address: d?.formattedAddress || d?.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            lat,
            lng,
          });
          onClose();
        } catch {
          onSelect({
            name: "Current location",
            address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            lat,
            lng,
          });
          onClose();
        } finally {
          setCurrentLoading(false);
        }
      },
      () => {
        setCurrentLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[11000] flex items-stretch justify-center bg-black/50 p-0 animate-[chatFadeIn_160ms_ease-out] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Share location"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-full flex-col bg-surface pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:h-[min(640px,90dvh)] sm:max-w-md sm:rounded-2xl sm:pt-0 sm:pb-0 sm:shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-content-secondary hover:bg-surface-hover"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-base font-semibold text-content">Send location</h2>
        </div>

        <div className="shrink-0 border-b border-border-subtle px-3 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search places or address"
              className="w-full rounded-full border border-border bg-surface-secondary py-2.5 pl-9 pr-10 text-sm text-content placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-[#00a884]/25"
              autoComplete="off"
            />
            {loading ? (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-content-tertiary" />
            ) : query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSuggestions([]);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-content-tertiary hover:text-content"
                aria-label="Clear"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={currentLoading}
            className="flex w-full items-center gap-3 border-b border-border-subtle px-4 py-3.5 text-left transition hover:bg-surface-hover disabled:opacity-60"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#00a884]/15 text-[#00a884]">
              {currentLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Navigation className="h-5 w-5" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-content">
                Send your current location
              </span>
              <span className="block text-xs text-content-tertiary">
                Uses GPS — location access required
              </span>
            </span>
          </button>

          {query.trim() && suggestions.length > 0 ? (
            <div>
              <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-content-tertiary">
                Places
              </p>
              {suggestions.map((p) => (
                <button
                  key={p.placeId}
                  type="button"
                  onClick={() => void pickPrediction(p)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-hover"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                    <MapPin className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-content">
                      {p.label.split(",")[0]}
                    </span>
                    <span className="block truncate text-xs text-content-tertiary">
                      {p.label}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {query.trim().length >= 2 && !loading && suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-content-tertiary">
              <MapPin className="h-8 w-8 opacity-40" />
              <p className="text-sm">No places found</p>
            </div>
          ) : null}

          {!query.trim() ? (
            <div className="px-4 py-8 text-center text-xs text-content-tertiary">
              Search for a place, or send your current GPS location
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ChatLocationPicker;
