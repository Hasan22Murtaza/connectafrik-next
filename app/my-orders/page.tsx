import { Suspense } from "react";
import { MyOrdersListShimmer } from "@/shared/components/ui/ShimmerLoaders";
import { MyOrdersContent } from "./MyOrdersContent";

function MyOrdersFallback() {
  return (
    <div className="min-h-screen bg-surface-canvas">
      <div className="w-full max-w-full 2xl:max-w-screen-2xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="mb-8 space-y-2">
          <div className="h-8 w-40 animate-shimmer rounded" />
          <div className="h-4 w-72 max-w-full animate-shimmer rounded" />
        </div>
        <MyOrdersListShimmer count={4} />
      </div>
    </div>
  );
}

export default function MyOrdersPage() {
  return (
    <Suspense fallback={<MyOrdersFallback />}>
      <MyOrdersContent />
    </Suspense>
  );
}
