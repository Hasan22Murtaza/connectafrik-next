"use client";

import React, { useId } from "react";
import {
  Camera,
  FileText,
  Image as ImageIcon,
  MapPin,
  Video,
  X,
} from "lucide-react";
import {
  fileUploadService,
  type FileUploadResult,
} from "@/shared/services/fileUploadService";

interface ChatAttachmentMenuProps {
  open: boolean;
  onFilesSelected: (files: FileUploadResult[]) => void;
  onClose: () => void;
  /** Opens live webcam (getUserMedia); use on laptop/desktop instead of file input capture. */
  onOpenCamera?: () => void;
  /** Opens WhatsApp-style location picker (same Places API as post create). */
  onOpenLocation?: () => void;
}

const stopMenuPointerBubble = (e: React.SyntheticEvent) => {
  e.stopPropagation();
};

type SheetItem = {
  id: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  color: string;
  inputId?: string;
  onClick?: () => void;
};

const ChatAttachmentMenu: React.FC<ChatAttachmentMenuProps> = ({
  open,
  onFilesSelected,
  onClose,
  onOpenCamera,
  onOpenLocation,
}) => {
  const uid = useId();
  const docInputId = `${uid}-doc`;
  const galleryInputId = `${uid}-gallery`;
  const videoInputId = `${uid}-video`;
  const cameraInputId = `${uid}-camera`;

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!picked.length) return;

    const results = await fileUploadService.fromFiles(picked);
    if (results.length) {
      onFilesSelected(results);
      onClose();
    }
  };

  const handleCameraClick = () => {
    if (onOpenCamera) {
      onOpenCamera();
      onClose();
      return;
    }
    document.getElementById(cameraInputId)?.click();
  };

  const handleLocationClick = () => {
    onOpenLocation?.();
    onClose();
  };

  const sheetItems: SheetItem[] = [
    {
      id: "camera",
      label: "Camera",
      Icon: Camera,
      color: "bg-pink-500",
      onClick: handleCameraClick,
    },
    {
      id: "gallery",
      label: "Gallery",
      Icon: ImageIcon,
      color: "bg-violet-500",
      inputId: galleryInputId,
    },
    {
      id: "video",
      label: "Video",
      Icon: Video,
      color: "bg-rose-500",
      inputId: videoInputId,
    },
    {
      id: "document",
      label: "Document",
      Icon: FileText,
      color: "bg-sky-500",
      inputId: docInputId,
    },
    {
      id: "location",
      label: "Location",
      Icon: MapPin,
      color: "bg-emerald-500",
      onClick: handleLocationClick,
    },
  ];

  return (
    <>
      {open ? (
        <div
          className="absolute bottom-full left-0 right-0 z-[70] mb-2 max-w-full animate-[chatSheetIn_220ms_cubic-bezier(0.22,1,0.36,1)] sm:left-0 sm:right-auto sm:w-[min(20rem,calc(100vw-1.5rem))]"
          role="menu"
          aria-label="Attach"
          onMouseDown={stopMenuPointerBubble}
          onPointerDown={stopMenuPointerBubble}
        >
          <div className="mx-0 overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-[0_8px_28px_rgba(11,20,26,0.18)] dark:shadow-[0_8px_28px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
              <span className="text-sm font-semibold text-content">Share</span>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-content-secondary hover:bg-surface-hover"
                aria-label="Close attachments"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-5 gap-x-1 gap-y-3 px-2 py-3.5 sm:gap-x-2 sm:px-3">
              {sheetItems.map((item) => {
                const Icon = item.Icon;
                const inner = (
                  <>
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-white shadow-sm sm:h-11 sm:w-11 ${item.color} transition-transform duration-150 group-hover:scale-105 group-active:scale-95`}
                    >
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </span>
                    <span className="max-w-full truncate text-center text-[10px] font-medium text-content-secondary sm:text-[11px]">
                      {item.label}
                    </span>
                  </>
                );

                if (item.inputId) {
                  return (
                    <label
                      key={item.id}
                      htmlFor={item.inputId}
                      role="menuitem"
                      className="group flex min-w-0 cursor-pointer flex-col items-center gap-1.5"
                    >
                      {inner}
                    </label>
                  );
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    className="group flex min-w-0 flex-col items-center gap-1.5"
                    onClick={item.onClick}
                  >
                    {inner}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <input
        id={docInputId}
        type="file"
        form=""
        className="hidden"
        tabIndex={-1}
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,application/*"
        onChange={handleChange}
      />
      <input
        id={galleryInputId}
        type="file"
        form=""
        className="hidden"
        tabIndex={-1}
        multiple
        accept="image/*"
        onChange={handleChange}
      />
      <input
        id={videoInputId}
        type="file"
        form=""
        className="hidden"
        tabIndex={-1}
        multiple
        accept="video/*"
        onChange={handleChange}
      />
      <input
        id={cameraInputId}
        type="file"
        form=""
        className="hidden"
        tabIndex={-1}
        accept="image/*"
        capture="environment"
        onChange={handleChange}
      />
    </>
  );
};

export default ChatAttachmentMenu;
