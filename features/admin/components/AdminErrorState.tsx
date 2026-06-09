"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { AP } from "../constants/adminLayout";

interface AdminErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function AdminErrorState({
  title = "Something went wrong",
  message = "We couldn't load this data. Please try again.",
  onRetry,
}: AdminErrorStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
      role="alert"
    >
      <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
        <AlertCircle className="w-7 h-7 text-red-500" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={AP.btnSecondary}>
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  );
}
