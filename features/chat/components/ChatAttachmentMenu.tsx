"use client";

import React, { useId } from "react";
import {
  Camera,
  FileText,
  Headphones,
  Image as ImageIcon,
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
}

const stopMenuPointerBubble = (e: React.SyntheticEvent) => {
  e.stopPropagation();
};

const ChatAttachmentMenu: React.FC<ChatAttachmentMenuProps> = ({
  open,
  onFilesSelected,
  onClose,
  onOpenCamera,
}) => {
  const uid = useId();
  const docInputId = `${uid}-doc`;
  const galleryInputId = `${uid}-gallery`;
  const cameraInputId = `${uid}-camera`;
  const audioInputId = `${uid}-audio`;

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Snapshot before clearing — FileList is live and empties when value is reset.
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

  const menuRowClass =
    "flex w-full cursor-pointer items-center gap-2 rounded-2xl px-2 py-1 text-left text-sm text-content transition-colors hover:bg-surface-hover";

  return (
    <>
      {open ? (
        <div
          className="absolute bottom-full left-0 z-[60] mb-1 w-[220px] overflow-hidden rounded-2xl border border-border bg-surface p-1 py-1.5 shadow-xl"
          role="menu"
          aria-label="Attach"
          onMouseDown={stopMenuPointerBubble}
          onPointerDown={stopMenuPointerBubble}
        >
          <label htmlFor={docInputId} role="menuitem" className={menuRowClass}>
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-secondary text-violet-600">
              <FileText className="h-5 w-5" />
            </span>
            <span className="font-medium">Document</span>
          </label>

          <label htmlFor={galleryInputId} role="menuitem" className={menuRowClass}>
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-secondary text-sky-600">
              <ImageIcon className="h-5 w-5" />
            </span>
            <span className="font-medium">Photos &amp; videos</span>
          </label>

          <button
            type="button"
            role="menuitem"
            className={menuRowClass}
            onClick={handleCameraClick}
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-secondary text-pink-600">
              <Camera className="h-5 w-5" />
            </span>
            <span className="font-medium">Camera</span>
          </button>

          <label htmlFor={audioInputId} role="menuitem" className={menuRowClass}>
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-secondary text-orange-600">
              <Headphones className="h-5 w-5" />
            </span>
            <span className="font-medium">Audio</span>
          </label>
        </div>
      ) : null}

      {/* Keep inputs mounted so file picker + onChange still work after the menu closes */}
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
        accept="image/*,video/*"
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
      <input
        id={audioInputId}
        type="file"
        form=""
        className="hidden"
        tabIndex={-1}
        multiple
        accept="audio/*"
        onChange={handleChange}
      />
    </>
  );
};

export default ChatAttachmentMenu;
