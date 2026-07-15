"use client";

import { apiClient } from "@/lib/api-client";
import { Copy, Loader2, RefreshCw, X } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";

export type ChatTranscriptData = {
  id: string;
  content: string;
  cached: boolean;
  source_message_count: number;
  source_last_message_at: string | null;
  model: string | null;
  created_at: string;
  updated_at: string;
};

type ChatTranscriptModalProps = {
  threadId: string;
  threadName: string;
  open: boolean;
  onClose: () => void;
};

export default function ChatTranscriptModal({
  threadId,
  threadName,
  open,
  onClose,
}: ChatTranscriptModalProps) {
  const [transcript, setTranscript] = useState<ChatTranscriptData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTranscript = useCallback(
    async (refresh: boolean) => {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setTranscript(null);
      }
      setError(null);
      try {
        const data = await apiClient.post<ChatTranscriptData>(
          `/api/chat/threads/${threadId}/transcript`,
          { refresh }
        );
        setTranscript(data);
        if (refresh) {
          toast.success("Transcript refreshed");
        }
      } catch (e: unknown) {
        const msg =
          e && typeof e === "object" && "message" in e
            ? String((e as { message: string }).message)
            : "Failed to generate transcript";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [threadId]
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    void loadTranscript(false);
  }, [open, threadId, loadTranscript]);

  const handleCopy = async () => {
    if (!transcript?.content) return;
    try {
      await navigator.clipboard.writeText(transcript.content);
      toast.success("Transcript copied");
    } catch {
      toast.error("Could not copy transcript");
    }
  };

  if (!open) return null;

  const updatedLabel = transcript?.updated_at
    ? new Date(transcript.updated_at).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/45 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Chat transcript"
      onClick={onClose}
    >
      <div
        className="flex h-[min(88vh,640px)] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-surface-canvas shadow-2xl sm:h-[min(560px,85vh)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border/80 bg-surface-canvas px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-content">
              Transcript
            </h2>
            <p className="truncate text-xs text-content-secondary">
              {threadName}
              {updatedLabel ? ` · ${updatedLabel}` : ""}
              {transcript?.cached ? " · saved" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadTranscript(true)}
            disabled={loading || refreshing}
            className="flex h-9 w-9 items-center justify-center rounded-full text-content-secondary transition hover:bg-surface-hover hover:text-content disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Refresh transcript"
            title="Refresh transcript"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => void handleCopy()}
            disabled={!transcript?.content || loading}
            className="flex h-9 w-9 items-center justify-center rounded-full text-content-secondary transition hover:bg-surface-hover hover:text-content disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Copy transcript"
            title="Copy"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-content-secondary transition hover:bg-surface-hover hover:text-content"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-surface px-4 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-content-secondary">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
              <p className="text-sm">Generating transcript…</p>
            </div>
          ) : error && !transcript ? (
            <div className="px-2 py-12 text-center">
              <p className="text-sm text-content-secondary">{error}</p>
              <button
                type="button"
                onClick={() => void loadTranscript(false)}
                className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="relative">
              {refreshing ? (
                <div className="absolute inset-0 z-[1] flex items-start justify-center bg-surface/60 pt-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
                </div>
              ) : null}
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-content">
                {transcript?.content || ""}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
