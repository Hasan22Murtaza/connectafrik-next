"use client";

import { apiClient } from "@/lib/api-client";
import { X } from "@/shared/icons";
import React, { useState } from "react";
import toast from "react-hot-toast";

const REPORT_REASONS = [
  { value: "scam", label: "Scam or fraud" },
  { value: "prohibited", label: "Prohibited item" },
  { value: "misleading", label: "Misleading or false listing" },
  { value: "offensive", label: "Offensive content" },
  { value: "other", label: "Something else" },
] as const;

interface ReportListingModalProps {
  productId: string;
  title: string;
  onClose: () => void;
}

const ReportListingModal: React.FC<ReportListingModalProps> = ({
  productId,
  title,
  onClose,
}) => {
  const [reason, setReason] = useState<string>(REPORT_REASONS[0].value);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const reasonLabel =
      REPORT_REASONS.find((item) => item.value === reason)?.label || reason;
    const listingUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/marketplace/${productId}`
        : `/marketplace/${productId}`;

    const message = [
      `Reason: ${reasonLabel}`,
      `Listing: ${title}`,
      `Listing ID: ${productId}`,
      `URL: ${listingUrl}`,
      "",
      details.trim() || "No additional details provided.",
    ].join("\n");

    try {
      setSubmitting(true);
      await apiClient.post("/api/feedback", {
        feedback_type: "other",
        title: `Listing report: ${title}`.slice(0, 180),
        message,
      });
      toast.success("Thanks. We'll review this listing.");
      onClose();
    } catch {
      toast.error("Couldn't submit the report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close report dialog"
        onClick={onClose}
      />
      <form
        onSubmit={handleSubmit}
        className="relative w-full sm:max-w-md bg-surface rounded-t-2xl sm:rounded-2xl border border-border shadow-xl p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-listing-title"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 id="report-listing-title" className="text-lg font-bold text-content">
              Report listing
            </h2>
            <p className="text-sm text-content-secondary mt-1 line-clamp-2">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-hover"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-content mb-2">
            Why are you reporting this?
          </legend>
          {REPORT_REASONS.map((item) => (
            <label
              key={item.value}
              className="flex items-center gap-2.5 text-sm text-content cursor-pointer"
            >
              <input
                type="radio"
                name="report-reason"
                value={item.value}
                checked={reason === item.value}
                onChange={() => setReason(item.value)}
                className="text-primary-600"
              />
              {item.label}
            </label>
          ))}
        </fieldset>

        <label className="block mt-4 text-sm font-semibold text-content" htmlFor="report-details">
          Details <span className="font-normal text-content-secondary">(optional)</span>
        </label>
        <textarea
          id="report-details"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          maxLength={1000}
          className="input-field mt-2 resize-y min-h-[88px]"
          placeholder="Add anything that would help us review this listing."
        />

        <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-content hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit report"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReportListingModal;
