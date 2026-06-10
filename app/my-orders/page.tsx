import { Suspense } from "react";
import { MyOrdersGridShimmer } from "@/shared/components/ui/ShimmerLoaders";
import { MyOrdersContent } from "./MyOrdersContent";

function MyOrdersFallback() {
  return (
    <div className="min-h-screen max-w-full bg-surface-canvas px-3 sm:px-4 py-4">
      <MyOrdersGridShimmer count={6} />
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
