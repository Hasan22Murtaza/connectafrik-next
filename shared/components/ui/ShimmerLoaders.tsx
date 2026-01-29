"use client";

import React, { useEffect, useState } from "react";

// ============== Hooks ==============

/** Shimmer count by breakpoint: mobile 2, sm 4, lg 6. Use for grids (groups, marketplace). */
export function useShimmerCount() {
  const [count, setCount] = useState(2);
  useEffect(() => {
    const mqSm = window.matchMedia("(min-width: 640px)");
    const mqLg = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      if (mqLg.matches) setCount(6);
      else if (mqSm.matches) setCount(4);
      else setCount(2);
    };
    update();
    mqSm.addEventListener("change", update);
    mqLg.addEventListener("change", update);
    return () => {
      mqSm.removeEventListener("change", update);
      mqLg.removeEventListener("change", update);
    };
  }, []);
  return count;
}

/** Shimmer count by breakpoint: mobile 2, md 4, lg 6. Use for my-orders grid. */
export function useShimmerCountMd() {
  const [count, setCount] = useState(2);
  useEffect(() => {
    const mqMd = window.matchMedia("(min-width: 768px)");
    const mqLg = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      if (mqLg.matches) setCount(6);
      else if (mqMd.matches) setCount(4);
      else setCount(2);
    };
    update();
    mqMd.addEventListener("change", update);
    mqLg.addEventListener("change", update);
    return () => {
      mqMd.removeEventListener("change", update);
      mqLg.removeEventListener("change", update);
    };
  }, []);
  return count;
}

/** Feed post count: mobile 2, sm 3, lg 4. Use for feed/post lists. */
export function useFeedShimmerCount() {
  const [count, setCount] = useState(2);
  useEffect(() => {
    const mqSm = window.matchMedia("(min-width: 640px)");
    const mqLg = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      if (mqLg.matches) setCount(4);
      else if (mqSm.matches) setCount(3);
      else setCount(2);
    };
    update();
    mqSm.addEventListener("change", update);
    mqLg.addEventListener("change", update);
    return () => {
      mqSm.removeEventListener("change", update);
      mqLg.removeEventListener("change", update);
    };
  }, []);
  return count;
}

// ============== Building blocks ==============

/** Single post card shimmer (group feed / group detail posts). */
export function PostCardShimmer() {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden w-full min-w-0">
      <div className="p-2 sm:p-3 border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full animate-shimmer shrink-0 flex-shrink-0" />
          <div className="h-3 sm:h-4 w-20 sm:w-28 max-w-full animate-shimmer rounded flex-1 min-w-0" />
        </div>
      </div>
      <div className="p-3 sm:p-4 space-y-2 min-w-0">
        <div className="h-4 w-3/4 max-w-[14rem] sm:max-w-xs animate-shimmer rounded" />
        <div className="h-3 w-full max-w-full animate-shimmer rounded" />
        <div className="h-3 w-full max-w-full animate-shimmer rounded" />
        <div className="h-3 w-2/3 max-w-full animate-shimmer rounded" />
        <div className="flex gap-2 sm:gap-4 pt-2 flex-wrap">
          <div className="h-4 w-10 sm:w-12 animate-shimmer rounded shrink-0" />
          <div className="h-4 w-10 sm:w-12 animate-shimmer rounded shrink-0" />
          <div className="h-4 w-10 sm:w-12 animate-shimmer rounded shrink-0" />
        </div>
      </div>
    </div>
  );
}

// ============== Groups ==============

/** Feed post shimmer: mimics group header + post card. Count by screen: 2 / 3 / 4 */
export function GroupsFeedShimmer() {
  const count = useFeedShimmerCount();
  return (
    <div className="space-y-3 sm:space-y-4 w-full min-w-0">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-lg shadow-sm overflow-hidden w-full min-w-0"
        >
          <div className="p-2 sm:p-3 border-b border-gray-100">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full animate-shimmer shrink-0 flex-shrink-0" />
              <div className="h-3 sm:h-4 w-20 sm:w-28 max-w-full animate-shimmer rounded flex-1 min-w-0" />
            </div>
          </div>
          <div className="p-3 sm:p-4 space-y-2 min-w-0">
            <div className="h-4 w-3/4 max-w-[14rem] sm:max-w-xs animate-shimmer rounded" />
            <div className="h-3 w-full max-w-full animate-shimmer rounded" />
            <div className="h-3 w-full max-w-full animate-shimmer rounded" />
            <div className="h-3 w-2/3 max-w-full animate-shimmer rounded" />
            <div className="flex gap-2 sm:gap-4 pt-2 flex-wrap">
              <div className="h-4 w-10 sm:w-12 animate-shimmer rounded shrink-0" />
              <div className="h-4 w-10 sm:w-12 animate-shimmer rounded shrink-0" />
              <div className="h-4 w-10 sm:w-12 animate-shimmer rounded shrink-0" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Group card grid shimmer. Pass count from useShimmerCount(). */
export function GroupsGridShimmer({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-6 w-full min-w-0">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl shadow-sm overflow-hidden w-full min-w-0 flex flex-col">
          <div className="h-28 sm:h-40 w-full animate-shimmer rounded-t-xl flex-shrink-0" />
          <div className="p-3 sm:p-4 space-y-2 min-w-0">
            <div className="h-5 w-3/4 max-w-full animate-shimmer rounded" />
            <div className="h-3 w-full max-w-full animate-shimmer rounded" />
            <div className="h-3 w-4/5 max-w-full animate-shimmer rounded" />
            <div className="flex gap-2 pt-2 flex-wrap">
              <div className="h-6 w-12 sm:w-14 animate-shimmer rounded-full shrink-0" />
              <div className="h-6 w-12 sm:w-14 animate-shimmer rounded-full shrink-0" />
            </div>
            <div className="h-8 sm:h-9 w-full max-w-full animate-shimmer rounded-lg mt-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Feed of post shimmers for group detail. Pass count from useFeedShimmerCount(). */
export function GroupPostsFeedShimmer({ count }: { count: number }) {
  return (
    <div className="space-y-3 sm:space-y-4 w-full min-w-0">
      {Array.from({ length: count }).map((_, i) => (
        <PostCardShimmer key={i} />
      ))}
    </div>
  );
}

/** Full-page shimmer for group detail initial load. */
export function GroupDetailPageShimmer() {
  const feedCount = useFeedShimmerCount();
  return (
    <div className="min-h-screen bg-gray-100 max-w-full 2xl:max-w-screen-2xl mx-auto w-full min-w-0 overflow-x-hidden">
      <div className="relative w-full">
        <div className="w-full h-40 sm:h-80 animate-shimmer" />
      </div>
      <div className="bg-white border-b border-gray-200 w-full min-w-0">
        <div className="px-3 sm:px-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="h-5 sm:h-6 w-32 sm:w-48 max-w-full animate-shimmer rounded min-w-0 flex-shrink" />
              <div className="h-3 sm:h-4 w-20 sm:w-24 animate-shimmer rounded hidden sm:block shrink-0" />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              <div className="h-9 w-16 sm:w-20 animate-shimmer rounded-lg shrink-0" />
              <div className="h-9 w-20 sm:w-24 animate-shimmer rounded-lg shrink-0" />
            </div>
          </div>
          <div className="flex border-t border-gray-200 overflow-x-auto gap-2 py-2 scrollbar-hide min-w-0">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 w-14 sm:w-20 animate-shimmer rounded shrink-0 flex-shrink-0" />
            ))}
          </div>
        </div>
      </div>
      <div className="px-3 sm:px-4 py-4 sm:py-6 w-full min-w-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          <div className="lg:col-span-7 space-y-4 min-w-0 w-full">
            <GroupPostsFeedShimmer count={feedCount} />
          </div>
          <div className="lg:col-span-5 space-y-4 min-w-0 w-full">
            <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 lg:sticky lg:top-24">
              <div className="h-5 w-24 sm:w-28 max-w-full animate-shimmer rounded mb-3 sm:mb-4" />
              <div className="space-y-3">
                <div className="h-4 w-full max-w-full animate-shimmer rounded" />
                <div className="h-4 w-full max-w-full animate-shimmer rounded" />
                <div className="h-4 w-3/4 max-w-full animate-shimmer rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============== Marketplace ==============

/** Product card grid shimmer. Pass count from useShimmerCount(). */
export function MarketplaceGridShimmer({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3 sm:gap-4 w-full min-w-0">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-lg shadow-md overflow-hidden w-full min-w-0 flex flex-col"
        >
          <div className="h-40 sm:h-48 w-full animate-shimmer flex-shrink-0" />
          <div className="p-3 sm:p-4 space-y-2 min-w-0">
            <div className="h-4 w-3/4 max-w-full animate-shimmer rounded" />
            <div className="h-4 w-1/2 max-w-full animate-shimmer rounded" />
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="h-6 w-20 sm:w-24 animate-shimmer rounded flex-shrink-0" />
              <div className="h-3 w-14 animate-shimmer rounded shrink-0" />
            </div>
            <div className="flex gap-2 pt-1">
              <div className="h-3 w-16 max-w-full animate-shimmer rounded shrink-0" />
              <div className="h-3 w-12 animate-shimmer rounded shrink-0" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Full-page shimmer for marketplace Suspense fallback. */
export function MarketplacePageShimmer() {
  const count = useShimmerCount();
  return (
    <div className="min-h-screen bg-gray-50 max-w-full 2xl:max-w-screen-2xl mx-auto w-full min-w-0 overflow-x-hidden">
      <div className="flex gap-4">
        <aside className="hidden md:block w-[280px] shrink-0 bg-white px-4 py-6">
          <div className="h-8 w-32 animate-shimmer rounded mb-6" />
          <div className="h-10 w-full animate-shimmer rounded mb-6" />
          <div className="h-5 w-24 animate-shimmer rounded mb-3" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 w-full animate-shimmer rounded" />
            ))}
          </div>
        </aside>
        <main className="flex-1 px-3 sm:px-4 py-6 min-w-0 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="h-8 w-48 animate-shimmer rounded" />
            <div className="h-9 w-24 animate-shimmer rounded shrink-0" />
          </div>
          <MarketplaceGridShimmer count={count} />
        </main>
      </div>
    </div>
  );
}

/** Friend/request/suggestion card grid shimmer. Pass count (e.g. useShimmerCount() * 2 for 4/8/12). */
export function FriendsGridShimmer({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4 w-full min-w-0">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-lg shadow-sm overflow-hidden w-full min-w-0 flex flex-col"
        >
          <div className="w-full aspect-square animate-shimmer flex-shrink-0" />
          <div className="p-3 sm:p-4 space-y-2 min-w-0">
            <div className="h-4 w-3/4 max-w-full animate-shimmer rounded" />
            <div className="h-3 w-1/2 max-w-full animate-shimmer rounded" />
            <div className="flex gap-2 pt-2">
              <div className="h-8 w-full max-w-full animate-shimmer rounded flex-shrink-0" />
              <div className="h-8 w-full max-w-full animate-shimmer rounded flex-shrink-0" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Full-page shimmer for marketplace product detail loading. */
export function ProductDetailPageShimmer() {
  return (
    <div className="min-h-screen bg-gray-50 max-w-full 2xl:max-w-screen-2xl mx-auto w-full min-w-0 overflow-x-hidden">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-3 sm:px-4">
          <div className="flex items-center justify-between h-14 sm:h-16 min-w-0">
            <div className="h-5 w-32 sm:w-40 animate-shimmer rounded min-w-0" />
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <div className="h-9 w-9 rounded-full animate-shimmer" />
              <div className="h-9 w-9 rounded-full animate-shimmer" />
            </div>
          </div>
        </div>
      </div>
      <div className="px-3 sm:px-4 py-6 sm:py-12 w-full min-w-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          <div className="space-y-3 sm:space-y-4 min-w-0">
            <div className="relative w-full max-w-xl mx-auto lg:mx-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-100 pt-[50%]">
              <div className="absolute inset-0 w-full h-full animate-shimmer" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-square rounded-lg animate-shimmer max-h-20" />
              ))}
            </div>
          </div>
          <div className="space-y-4 sm:space-y-6 min-w-0">
            <div>
              <div className="h-7 sm:h-8 w-3/4 max-w-full animate-shimmer rounded mb-2" />
              <div className="h-4 w-1/2 max-w-full animate-shimmer rounded" />
            </div>
            <div className="bg-gray-50 rounded-lg p-3 sm:p-4 space-y-3">
              <div className="h-5 w-28 animate-shimmer rounded" />
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="h-4 w-full animate-shimmer rounded" />
                <div className="h-4 w-full animate-shimmer rounded" />
                <div className="h-4 w-full animate-shimmer rounded" />
                <div className="h-4 w-full animate-shimmer rounded" />
              </div>
            </div>
            <div>
              <div className="h-5 w-24 animate-shimmer rounded mb-2" />
              <div className="h-3 w-full animate-shimmer rounded" />
              <div className="h-3 w-full animate-shimmer rounded mt-2" />
              <div className="h-3 w-2/3 max-w-full animate-shimmer rounded mt-2" />
            </div>
            <div className="h-8 sm:h-10 w-32 animate-shimmer rounded" />
            <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
              <div className="flex justify-between items-center mb-3">
                <div className="h-5 w-36 animate-shimmer rounded" />
                <div className="h-8 w-24 animate-shimmer rounded" />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full animate-shimmer shrink-0" />
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="h-4 w-24 animate-shimmer rounded" />
                  <div className="h-3 w-16 animate-shimmer rounded" />
                </div>
              </div>
            </div>
            <div className="h-12 w-full animate-shimmer rounded-lg" />
            <div className="bg-blue-50 rounded-lg p-3 sm:p-4 flex gap-3">
              <div className="w-5 h-5 rounded animate-shimmer shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1 min-w-0">
                <div className="h-4 w-20 animate-shimmer rounded" />
                <div className="h-3 w-full animate-shimmer rounded" />
                <div className="h-3 w-full animate-shimmer rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============== My Orders ==============

/** Order card grid shimmer. Pass count from useShimmerCountMd(). */
export function MyOrdersGridShimmer({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full min-w-0">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-lg border border-gray-200 overflow-hidden w-full min-w-0 flex flex-col"
        >
          <div className="relative">
            <div className="w-full h-40 sm:h-48 animate-shimmer rounded-t-lg flex-shrink-0" />
            <div className="absolute top-2 right-2">
              <div className="h-5 w-16 animate-shimmer rounded-full" />
            </div>
          </div>
          <div className="px-3 sm:px-4 pt-2 min-w-0">
            <div className="h-4 w-3/4 max-w-full animate-shimmer rounded mb-2" />
            <div className="h-3 w-1/2 max-w-full animate-shimmer rounded" />
          </div>
          <div className="p-3 sm:p-4 min-w-0">
            <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-3">
              <div className="h-3 w-full animate-shimmer rounded" />
              <div className="h-3 w-full animate-shimmer rounded" />
              <div className="h-3 w-full animate-shimmer rounded" />
              <div className="h-3 w-full animate-shimmer rounded" />
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full animate-shimmer shrink-0" />
                <div className="h-3 w-16 max-w-full animate-shimmer rounded" />
              </div>
              <div className="h-3 w-20 animate-shimmer rounded shrink-0" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Full-page shimmer for order detail loading. */
export function OrderDetailPageShimmer() {
  return (
    <div className="min-h-screen bg-gray-50 w-full min-w-0 overflow-x-hidden">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-full 2xl:max-w-screen-2xl mx-auto px-3 sm:px-4 py-6 w-full min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="h-7 sm:h-8 w-40 sm:w-52 animate-shimmer rounded mb-2" />
              <div className="h-4 w-28 animate-shimmer rounded" />
            </div>
            <div className="h-9 w-24 animate-shimmer rounded-full shrink-0" />
          </div>
        </div>
      </div>
      <div className="max-w-full 2xl:max-w-screen-2xl mx-auto px-3 sm:px-4 py-6 w-full min-w-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="md:col-span-2 space-y-4 sm:space-y-6 min-w-0">
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="h-5 w-40 animate-shimmer rounded mb-4" />
              <div className="flex gap-3 sm:gap-4 min-w-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg animate-shimmer shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-4 w-3/4 max-w-full animate-shimmer rounded" />
                  <div className="h-3 w-full max-w-full animate-shimmer rounded" />
                  <div className="h-3 w-2/3 max-w-full animate-shimmer rounded" />
                  <div className="h-3 w-1/2 max-w-full animate-shimmer rounded mt-2" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="h-5 w-36 animate-shimmer rounded mb-4" />
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex justify-between py-2 border-b border-gray-100">
                    <div className="h-4 w-24 animate-shimmer rounded" />
                    <div className="h-4 w-16 animate-shimmer rounded" />
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="h-5 w-40 animate-shimmer rounded mb-4" />
              <div className="space-y-3">
                <div className="h-4 w-full max-w-full animate-shimmer rounded" />
                <div className="h-4 w-full max-w-full animate-shimmer rounded" />
                <div className="h-16 w-full max-w-full animate-shimmer rounded mt-2" />
              </div>
            </div>
          </div>
          <div className="space-y-4 sm:space-y-6 min-w-0">
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="h-5 w-32 animate-shimmer rounded mb-4" />
              <div className="space-y-3">
                <div className="h-4 w-full max-w-full animate-shimmer rounded" />
                <div className="h-4 w-full max-w-full animate-shimmer rounded" />
                <div className="h-5 w-3/4 max-w-full animate-shimmer rounded pt-2" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="h-5 w-24 animate-shimmer rounded mb-4" />
              <div className="space-y-3">
                <div className="h-3 w-full animate-shimmer rounded" />
                <div className="h-3 w-full animate-shimmer rounded" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="h-5 w-36 animate-shimmer rounded mb-4" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full animate-shimmer shrink-0" />
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="h-4 w-24 animate-shimmer rounded" />
                  <div className="h-3 w-16 animate-shimmer rounded" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
