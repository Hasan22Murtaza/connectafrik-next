import React from "react";
import type { FileUploadResult } from "@/shared/services/fileUploadService";
import { FileText, X } from "lucide-react";

interface FilePreviewProps {
  files: FileUploadResult[];
  onRemove: (index: number) => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ files, onRemove }) => {
  if (!files.length) return null;

  return (
    <div className="mt-2 flex gap-2 overflow-x-auto pb-1 pt-1 scrollbar-thin">
      {files.map((file, index) => {
        const previewSrc = file.previewUrl || file.url;

        if (file.type === "image" && previewSrc) {
          return (
            <div key={file.id} className="relative shrink-0 animate-[chatFadeIn_180ms_ease-out]">
              <img
                src={previewSrc}
                alt={file.name}
                className="h-[72px] w-[72px] rounded-xl object-cover ring-1 ring-border"
              />
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-content text-surface shadow-sm transition hover:scale-105"
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        }

        if (file.type === "video" && previewSrc) {
          return (
            <div key={file.id} className="relative shrink-0 animate-[chatFadeIn_180ms_ease-out]">
              <video
                src={previewSrc}
                className="h-[72px] w-[72px] rounded-xl object-cover ring-1 ring-border"
                muted
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55">
                  <svg className="ml-0.5 h-3.5 w-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-content text-surface shadow-sm transition hover:scale-105"
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        }

        return (
          <div
            key={file.id}
            className="relative flex shrink-0 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 animate-[chatFadeIn_180ms_ease-out]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600">
              <FileText className="h-4 w-4" />
            </span>
            <div className="min-w-0 max-w-[min(40vw,110px)] sm:max-w-[110px]">
              <p className="truncate text-xs font-medium text-content">{file.name}</p>
              <p className="text-[10px] text-content-secondary">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-content-tertiary hover:bg-surface-hover hover:text-content"
              aria-label={`Remove ${file.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default FilePreview;
