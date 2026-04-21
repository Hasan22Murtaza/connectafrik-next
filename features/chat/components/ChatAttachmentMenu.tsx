"use client";

import React, { useRef } from "react";
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
  onFilesSelected: (files: FileUploadResult[]) => void;
  onClose: () => void;
  /** Opens live webcam (getUserMedia); use on laptop/desktop instead of file input capture. */
  onOpenCamera?: () => void;
}

const ChatAttachmentMenu: React.FC<ChatAttachmentMenuProps> = ({
  onFilesSelected,
  onClose,
  onOpenCamera,
}) => {
  const docRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraFallbackRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target;
    e.target.value = "";
    if (!files?.length) return;
    const results = await fileUploadService.fromFiles(files);
    if (results.length) {
      onFilesSelected(results);
      onClose();
    }
  };

  const items: {
    key: string;
    label: string;
    icon: React.ReactNode;
    className: string;
    onClick: () => void;
  }[] = [
    {
      key: "doc",
      label: "Document",
      icon: <FileText className="h-5 w-5" />,
      className: "text-violet-600",
      onClick: () => docRef.current?.click(),
    },
    {
      key: "gallery",
      label: "Photos & videos",
      icon: <ImageIcon className="h-5 w-5" />,
      className: "text-sky-600",
      onClick: () => galleryRef.current?.click(),
    },
    {
      key: "camera",
      label: "Camera",
      icon: <Camera className="h-5 w-5" />,
      className: "text-pink-600",
      onClick: () => {
        onClose();
        if (onOpenCamera) {
          onOpenCamera();
        } else {
          cameraFallbackRef.current?.click();
        }
      },
    },
    {
      key: "audio",
      label: "Audio",
      icon: <Headphones className="h-5 w-5" />,
      className: "text-orange-600",
      onClick: () => audioRef.current?.click(),
    },
  ];

  return (
    <>
      <div
        className="absolute bottom-full left-0 z-[60] mb-1 w-[220px] overflow-hidden rounded-2xl border border-gray-200 bg-white py-1.5 shadow-xl p-1"
        role="menu"
        aria-label="Attach"
      >
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-2 py-1 text-left text-sm text-gray-800 transition-colors hover:bg-gray-100 rounded-2xl"
            onClick={() => item.onClick()}
          >
            <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 ${item.className}`}>
              {item.icon}
            </span>
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </div>

      <input
        ref={docRef}
        type="file"
        className="hidden"
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,application/*"
        onChange={handleChange}
      />
      <input
        ref={galleryRef}
        type="file"
        className="hidden"
        multiple
        accept="image/*,video/*"
        onChange={handleChange}
      />
      {/* Fallback when onOpenCamera is not provided (e.g. mobile file picker) */}
      <input
        ref={cameraFallbackRef}
        type="file"
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
      />
      <input
        ref={audioRef}
        type="file"
        className="hidden"
        accept="audio/*"
        onChange={handleChange}
      />
    </>
  );
};

export default ChatAttachmentMenu;
