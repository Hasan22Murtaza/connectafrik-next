"use client";

import React, { useMemo, useState } from "react";
import {
  DATE_POSTED_OPTIONS,
  getCategoryLabel,
  getSubcategoriesForCategory,
  MARKETPLACE_SORT_OPTIONS,
  PRODUCT_CONDITIONS,
  TRADEHUB_CATEGORIES,
  type MarketplaceSort,
  type TradeHubCategory,
} from "@/features/marketplace/constants/marketplaceConstants";
import MarketplaceLocationPicker from "@/features/marketplace/components/MarketplaceLocationPicker";
import type { ProfileLocationValue } from "@/shared/types/location";
import { ChevronDown, ChevronRight } from "@/shared/icons";

const CATEGORY_PREVIEW_COUNT = 8;

export type TradeHubFilterValues = {
  category: string;
  subcategory: string;
  condition: string;
  minPrice: string;
  maxPrice: string;
  postedWithinDays: string;
  pickupOnly: boolean;
  deliveryAvailable: boolean;
  urgentSale: boolean;
  featuredOnly: boolean;
};

type SidebarPanel = "main" | "category";

interface TradeHubFilterSidebarProps {
  filters: TradeHubFilterValues;
  onChange: (patch: Partial<TradeHubFilterValues>) => void;
  sortBy?: MarketplaceSort;
  onSortChange?: (sort: MarketplaceSort) => void;
  location?: ProfileLocationValue;
  radiusKm?: number;
  onLocationChange?: (location: ProfileLocationValue) => void;
  onLocationFilterApply?: (location: ProfileLocationValue, radiusKm: number) => void;
  onClear?: () => void;
  hasActiveFilters?: boolean;
  onCloseMobile?: () => void;
  header?: React.ReactNode;
}

const menuRowClass =
  "w-full flex items-center justify-between gap-3 px-4 py-3 text-left text-[15px] text-content hover:bg-primary-50 transition-colors";

const menuRowActiveClass = "bg-primary-50 text-primary-700";

const sectionTitleClass = "px-4 pt-4 pb-2 text-[17px] font-bold text-primary-700";

const dividerClass = "border-t border-primary-100 my-1";

const fieldClass =
  "w-full appearance-none px-3 py-2 bg-surface border border-border rounded-lg text-sm text-content focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200";

const TradeHubFilterSidebar: React.FC<TradeHubFilterSidebarProps> = ({
  filters,
  onChange,
  sortBy,
  onSortChange,
  location,
  radiusKm,
  onLocationChange,
  onLocationFilterApply,
  onClear,
  hasActiveFilters,
  onCloseMobile,
  header,
}) => {
  const [panel, setPanel] = useState<SidebarPanel>("main");
  const [drillCategory, setDrillCategory] = useState<TradeHubCategory | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const visibleCategories = useMemo(
    () =>
      showAllCategories
        ? TRADEHUB_CATEGORIES
        : TRADEHUB_CATEGORIES.slice(0, CATEGORY_PREVIEW_COUNT),
    [showAllCategories]
  );

  const drillSubs = useMemo(
    () => (drillCategory ? getSubcategoriesForCategory(drillCategory.value) : []),
    [drillCategory]
  );

  const openCategoryPanel = (category: TradeHubCategory) => {
    setDrillCategory(category);
    setPanel("category");
  };

  const backToMain = () => {
    setPanel("main");
    setDrillCategory(null);
  };

  const selectAllInCategory = (categoryValue: string) => {
    onChange({ category: categoryValue, subcategory: "" });
    setPanel("main");
    onCloseMobile?.();
  };

  const selectSubcategory = (categoryValue: string, subcategoryValue: string) => {
    onChange({ category: categoryValue, subcategory: subcategoryValue });
    setPanel("main");
    onCloseMobile?.();
  };

  const selectAllCategories = () => {
    onChange({ category: "", subcategory: "" });
    setPanel("main");
    onCloseMobile?.();
  };

  return (
    <div className="relative overflow-hidden min-h-0 flex-1 flex flex-col bg-surface">
      {header}

      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div
          className={`flex h-full w-[200%] transition-transform duration-300 ease-out ${
            panel === "category" ? "-translate-x-1/2" : "translate-x-0"
          }`}
        >
          {/* —— Main menu —— */}
          <div className="w-1/2 h-full shrink-0 overflow-y-auto scrollbar-hover pb-6">
            <div className={sectionTitleClass}>Shop by Category</div>

          <button
            type="button"
            onClick={selectAllCategories}
            className={`${menuRowClass} ${
              !filters.category ? menuRowActiveClass : ""
            }`}
          >
            <span className={!filters.category ? "font-semibold text-primary-700" : ""}>
              All Categories
            </span>
          </button>

          <ul>
            {visibleCategories.map((category) => {
              const isActive = filters.category === category.value;
              return (
                <li key={category.value}>
                  <button
                    type="button"
                    onClick={() => openCategoryPanel(category)}
                    className={`${menuRowClass} ${isActive ? menuRowActiveClass : ""}`}
                  >
                    <span className={isActive ? "font-semibold text-primary-700" : ""}>
                      {category.label}
                      {isActive && filters.subcategory ? (
                        <span className="block text-xs font-normal text-primary-600/80 mt-0.5">
                          {getSubcategoriesForCategory(category.value).find(
                            (s) => s.value === filters.subcategory
                          )?.label || filters.subcategory}
                        </span>
                      ) : null}
                    </span>
                    <ChevronRight className="w-4 h-4 text-primary-500 shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>

          {TRADEHUB_CATEGORIES.length > CATEGORY_PREVIEW_COUNT && (
            <button
              type="button"
              onClick={() => setShowAllCategories((v) => !v)}
              className={`${menuRowClass} font-medium text-primary-600`}
            >
              <span>{showAllCategories ? "See less" : "See all"}</span>
              <ChevronDown
                className={`w-4 h-4 text-primary-500 transition-transform ${
                  showAllCategories ? "rotate-180" : ""
                }`}
              />
            </button>
          )}

          <div className={dividerClass} />

          <div className={sectionTitleClass}>Filters</div>

          <div className="px-4 pb-3 space-y-3">
            {location && onLocationChange && (
              <div>
                <label className="block text-xs font-semibold text-primary-700 mb-1.5">
                  Location
                </label>
                <MarketplaceLocationPicker
                  location={location}
                  radiusKm={radiusKm}
                  onLocationChange={onLocationChange}
                  onFilterApply={onLocationFilterApply}
                  triggerVariant="field"
                  className="!rounded-lg !border !border-border !bg-surface !px-3 !py-2"
                />
              </div>
            )}

            {sortBy != null && onSortChange && (
              <div>
                <label className="block text-xs font-semibold text-primary-700 mb-1.5">
                  Sort by
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => onSortChange(e.target.value as MarketplaceSort)}
                  className={fieldClass}
                  aria-label="Sort listings"
                >
                  {MARKETPLACE_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-primary-700 mb-1.5">
                Condition
              </label>
              <select
                value={filters.condition}
                onChange={(e) => onChange({ condition: e.target.value })}
                className={fieldClass}
              >
                <option value="">Any condition</option>
                {PRODUCT_CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-primary-700 mb-1.5">
                Price range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder="Min"
                  value={filters.minPrice}
                  onChange={(e) => onChange({ minPrice: e.target.value })}
                  className={fieldClass}
                />
                <span className="text-primary-400 text-xs">–</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Max"
                  value={filters.maxPrice}
                  onChange={(e) => onChange({ maxPrice: e.target.value })}
                  className={fieldClass}
                />
              </div>
            </div>

            {(showMoreFilters ||
              filters.postedWithinDays ||
              filters.pickupOnly ||
              filters.deliveryAvailable ||
              filters.urgentSale ||
              filters.featuredOnly) && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-primary-700 mb-1.5">
                    Date posted
                  </label>
                  <select
                    value={filters.postedWithinDays}
                    onChange={(e) => onChange({ postedWithinDays: e.target.value })}
                    className={fieldClass}
                  >
                    {DATE_POSTED_OPTIONS.map((opt) => (
                      <option key={opt.value || "any"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2.5 text-sm text-content cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={filters.pickupOnly}
                    onChange={(e) => onChange({ pickupOnly: e.target.checked })}
                    className="rounded border-border text-primary-600 focus:ring-primary-500"
                  />
                  Pickup only
                </label>
                <label className="flex items-center gap-2.5 text-sm text-content cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={filters.deliveryAvailable}
                    onChange={(e) => onChange({ deliveryAvailable: e.target.checked })}
                    className="rounded border-border text-primary-600 focus:ring-primary-500"
                  />
                  Delivery available
                </label>
                <label className="flex items-center gap-2.5 text-sm text-content cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={filters.urgentSale}
                    onChange={(e) => onChange({ urgentSale: e.target.checked })}
                    className="rounded border-border text-primary-600 focus:ring-primary-500"
                  />
                  Urgent sale
                </label>
                <label className="flex items-center gap-2.5 text-sm text-content cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={filters.featuredOnly}
                    onChange={(e) => onChange({ featuredOnly: e.target.checked })}
                    className="rounded border-border text-primary-600 focus:ring-primary-500"
                  />
                  Featured listing
                </label>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowMoreFilters((v) => !v)}
            className={`${menuRowClass} font-medium text-primary-600`}
          >
            <span>{showMoreFilters ? "See less" : "See all"}</span>
            <ChevronDown
              className={`w-4 h-4 text-primary-500 transition-transform ${
                showMoreFilters ? "rotate-180" : ""
              }`}
            />
          </button>

          {hasActiveFilters && onClear && (
            <>
              <div className={dividerClass} />
              <button
                type="button"
                onClick={() => {
                  onClear();
                  backToMain();
                }}
                className={`${menuRowClass} text-primary-600 font-semibold`}
              >
                Clear all filters
              </button>
            </>
          )}
        </div>

        {/* —— Category submenu —— */}
        <div className="w-1/2 h-full shrink-0 overflow-y-auto scrollbar-hover pb-6">
          <button
            type="button"
            onClick={backToMain}
            className="w-full flex items-center gap-2 px-4 py-3.5 text-left border-b border-primary-100 hover:bg-primary-50 transition-colors sticky top-0 bg-surface z-10"
          >
            <ChevronRight className="w-4 h-4 text-primary-600 rotate-180 shrink-0" />
            <span className="text-[13px] font-bold uppercase tracking-wide text-primary-700">
              Main Menu
            </span>
          </button>

          <h3 className="px-4 pt-4 pb-2 text-[20px] font-bold text-primary-700 leading-tight">
            {drillCategory?.label || getCategoryLabel(filters.category)}
          </h3>

          <button
            type="button"
            onClick={() =>
              drillCategory && selectAllInCategory(drillCategory.value)
            }
            className={`${menuRowClass} ${
              drillCategory &&
              filters.category === drillCategory.value &&
              !filters.subcategory
                ? menuRowActiveClass
                : ""
            }`}
          >
            <span
              className={
                drillCategory &&
                filters.category === drillCategory.value &&
                !filters.subcategory
                  ? "font-semibold text-primary-700"
                  : ""
              }
            >
              All {drillCategory?.label || "items"}
            </span>
          </button>

          <ul>
            {drillSubs.map((sub) => {
              const isActive =
                filters.category === drillCategory?.value &&
                filters.subcategory === sub.value;
              return (
                <li key={sub.value}>
                  <button
                    type="button"
                    onClick={() =>
                      drillCategory &&
                      selectSubcategory(drillCategory.value, sub.value)
                    }
                    className={`${menuRowClass} ${isActive ? menuRowActiveClass : ""}`}
                  >
                    <span className={isActive ? "font-semibold text-primary-700" : ""}>
                      {sub.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        </div>
      </div>
    </div>
  );
};

export default TradeHubFilterSidebar;
