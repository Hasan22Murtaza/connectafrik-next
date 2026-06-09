import { Suspense } from "react";
import { PayoutSettingsContent } from "./PayoutSettingsContent";

function PayoutSettingsFallback() {
  return (
    <div className="min-h-screen px-4 py-6">
      <div className="max-w-2xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    </div>
  );
}

export default function PayoutSettingsPage() {
  return (
    <Suspense fallback={<PayoutSettingsFallback />}>
      <PayoutSettingsContent />
    </Suspense>
  );
}
