"use client";

import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  ChevronDown,
  Crosshair,
  Info,
  Loader2,
  MapPin,
  X,
} from "lucide-react";
import LocationSearch from "@/shared/components/ui/LocationSearch";
import { apiClient } from "@/lib/api-client";
import type { ProfileLocationValue } from "@/shared/types/location";
import {
  DEFAULT_MAP_CENTER,
  getLocationDisplayLabel,
  getLocationFilterChipLabel,
  getMarketplaceStaticMapUrlFromCoords,
  hasValidCoordinates,
  MARKETPLACE_RADIUS_OPTIONS,
} from "@/features/marketplace/utils/marketplaceLocation";

const modalFieldClass =
  "w-full px-4 pt-5 pb-2.5 bg-surface-input border border-transparent rounded-xl text-sm text-content placeholder:text-content-tertiary focus:outline-none focus:bg-surface focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all";

export type MarketplaceLocationPickerProps = {
  location: ProfileLocationValue;
  onLocationChange: (next: ProfileLocationValue) => void;
  radiusKm?: number;
  onRadiusChange?: (km: number) => void;
  /** Preferred when updating location + radius together (avoids stale state overwrites). */
  onFilterApply?: (location: ProfileLocationValue, radiusKm: number) => void;
  showRadius?: boolean;
  triggerVariant?: "chip" | "field";
  disabled?: boolean;
  className?: string;
};

const MarketplaceLocationPicker: React.FC<MarketplaceLocationPickerProps> = ({
  location,
  onLocationChange,
  radiusKm = 500,
  onRadiusChange,
  onFilterApply,
  showRadius = true,
  triggerVariant = "chip",
  disabled = false,
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const [draftLocation, setDraftLocation] = useState(location);
  const [draftRadius, setDraftRadius] = useState(radiusKm);
  const [previewCoords, setPreviewCoords] = useState(DEFAULT_MAP_CENTER);
  const [locating, setLocating] = useState(false);
  const radiusId = useId();

  useEffect(() => {
    if (!open) return;
    setDraftLocation(location);
    setDraftRadius(radiusKm);
    if (hasValidCoordinates(location)) {
      setPreviewCoords({
        lat: location.latitude!,
        lng: location.longitude!,
      });
    } else {
      setPreviewCoords(DEFAULT_MAP_CENTER);
    }
  }, [open, location, radiusKm]);

  const chipLabel = getLocationFilterChipLabel(location, radiusKm, showRadius);
  const fieldLabel = getLocationDisplayLabel(location);

  const mapCoords = useMemo(() => {
    if (hasValidCoordinates(draftLocation)) {
      return {
        lat: draftLocation.latitude!,
        lng: draftLocation.longitude!,
      };
    }
    return previewCoords;
  }, [draftLocation, previewCoords]);

  const mapUrl = getMarketplaceStaticMapUrlFromCoords(
    mapCoords.lat,
    mapCoords.lng,
    {
      radiusKm: draftRadius,
      showRadiusCircle: showRadius,
    }
  );

  const resolveLocationFromCoords = useCallback(
    async (lat: number, lng: number, updateDraft = true) => {
      setPreviewCoords({ lat, lng });
      if (!updateDraft) return;

      try {
        const res = await apiClient.get<{ details: ProfileLocationValue }>(
          "/api/location-search",
          { lat, lng }
        );
        if (res.details) {
          setDraftLocation(res.details);
          return;
        }
      } catch {
        // fall through to coords-only draft
      }

      setDraftLocation((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lng,
        formattedAddress: prev.formattedAddress || "Current location",
      }));
    },
    []
  );

  const handleLocateMe = useCallback(
    (updateDraft = true) => {
      if (!navigator.geolocation) return;
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            await resolveLocationFromCoords(
              pos.coords.latitude,
              pos.coords.longitude,
              updateDraft
            );
          } finally {
            setLocating(false);
          }
        },
        () => setLocating(false),
        { enableHighAccuracy: false, timeout: 10000 }
      );
    },
    [resolveLocationFromCoords]
  );

  useEffect(() => {
    if (!open || hasValidCoordinates(location)) return;
    handleLocateMe(true);
  }, [open, location, handleLocateMe]);

  const applyChanges = () => {
    const nextLocation = hasValidCoordinates(draftLocation)
      ? draftLocation
      : {
          ...draftLocation,
          latitude: mapCoords.lat,
          longitude: mapCoords.lng,
        };

    if (onFilterApply) {
      onFilterApply(nextLocation, draftRadius);
    } else {
      onLocationChange(nextLocation);
      if (showRadius && onRadiusChange) {
        onRadiusChange(draftRadius);
      }
    }
    setOpen(false);
  };

  return (
    <>
      {triggerVariant === "chip" ? (
        <button
          type="button"
          onClick={() => !disabled && setOpen(true)}
          disabled={disabled}
          className={`inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors disabled:opacity-50 ${className}`}
        >
          <MapPin className="w-4 h-4 shrink-0" />
          <span className="truncate max-w-[200px] sm:max-w-none">{chipLabel}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => !disabled && setOpen(true)}
          disabled={disabled}
          className={`w-full text-left px-4 py-3 bg-surface-input border border-transparent rounded-xl text-sm text-content hover:bg-surface focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all disabled:opacity-50 ${className}`}
        >
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-primary-600 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-content-secondary leading-none mb-1">
                Location
              </p>
              <p className="truncate font-medium">
                {fieldLabel || "Search by city, neighborhood or ZIP code"}
              </p>
            </div>
            <ChevronDown className="w-4 h-4 text-content-tertiary shrink-0" />
          </div>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[10200] flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="marketplace-location-modal-title"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />

          <div className="relative w-full sm:max-w-lg bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-center px-4 py-4 border-b border-border shrink-0 relative">
              <h2
                id="marketplace-location-modal-title"
                className="text-base font-bold text-content"
              >
                Change location
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-surface-hover transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-content-secondary" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
              <p className="text-sm text-content-secondary text-center">
                Search by city, neighborhood or ZIP code.
              </p>

              <div className="relative">
                <MapPin className="absolute left-3.5 top-[1.65rem] w-4 h-4 text-content-tertiary z-10 pointer-events-none" />
                <LocationSearch
                  value={draftLocation}
                  onChange={setDraftLocation}
                  label="Location"
                  fieldClassName={`${modalFieldClass} pl-10`}
                />
              </div>

              {showRadius && (
                <div>
                  <label
                    htmlFor={radiusId}
                    className="block text-[11px] text-content-secondary mb-1 px-1"
                  >
                    Radius
                  </label>
                  <div className="relative">
                    <select
                      id={radiusId}
                      value={draftRadius}
                      onChange={(e) => setDraftRadius(Number(e.target.value))}
                      className={`${modalFieldClass} appearance-none pr-10 cursor-pointer`}
                    >
                      {MARKETPLACE_RADIUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary pointer-events-none" />
                  </div>
                </div>
              )}

              <div className="relative rounded-xl overflow-hidden border border-border bg-surface-secondary aspect-[16/9]">
                <img
                  src={mapUrl}
                  alt="Map preview of selected area"
                  className="w-full h-full object-cover"
                />
                {locating && (
                  <div className="absolute inset-0 bg-surface/40 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleLocateMe(true)}
                  disabled={locating}
                  className="absolute top-3 right-3 p-2.5 bg-surface rounded-lg shadow-md border border-border hover:bg-surface-hover transition-colors disabled:opacity-60"
                  aria-label="Locate me"
                  title="Locate me"
                >
                  {locating ? (
                    <Loader2 className="w-4 h-4 animate-spin text-content-secondary" />
                  ) : (
                    <Crosshair className="w-4 h-4 text-content-secondary" />
                  )}
                </button>
                <div className="absolute bottom-2 right-2 p-1.5 bg-surface/90 rounded-full">
                  <Info className="w-3.5 h-3.5 text-content-tertiary" />
                </div>
              </div>
            </div>

            <div className="px-4 py-4 border-t border-border shrink-0">
              <button
                type="button"
                onClick={applyChanges}
                className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold text-sm hover:bg-primary-700 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MarketplaceLocationPicker;
