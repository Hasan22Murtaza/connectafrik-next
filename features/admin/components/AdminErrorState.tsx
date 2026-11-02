"use client";

import { AlertCircle, RefreshCw } from "@/shared/icons";
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
      className="flex flex-col items-center justify-center px-6 py-14 text-center"
      role="alert"
    >
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-red-200 bg-red-50">
        <AlertCircle className="h-5 w-5 text-red-600" aria-hidden="true" />
      </div>
      <h3 className="mb-1 text-sm font-medium text-gray-900">{title}</h3>
      <p className="mb-4 max-w-sm text-sm text-gray-500">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={AP.btnSecondary}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  );
}
