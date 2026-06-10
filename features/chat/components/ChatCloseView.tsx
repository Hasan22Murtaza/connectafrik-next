"use client";

import React, { useRef } from "react";
import { FileText, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

interface ChatCloseViewProps {
  onFocusSearch?: () => void;
}

function ActionTile({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
    >
      <span className="flex h-[104px] w-[104px] items-center justify-center rounded-2xl bg-surface shadow-card ring-1 ring-border-subtle transition group-hover:bg-surface-hover group-active:scale-[0.98]">
        {icon}
      </span>
      <span className="max-w-[7.5rem] text-center text-[13px] leading-snug text-content-secondary">
        {label}
      </span>
    </button>
  );
}

export default function ChatCloseView({ onFocusSearch }: ChatCloseViewProps) {
  const router = useRouter();
  const documentInputRef = useRef<HTMLInputElement>(null);

  const handleSendDocument = () => {
    documentInputRef.current?.click();
  };

  const handleDocumentSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = event.target;
    event.target.value = "";
    if (!files?.length) return;
    toast("Choose a chat from the list, then attach your file using the paperclip icon.");
    onFocusSearch?.();
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-surface-canvas px-6">
      <div className="flex flex-wrap items-start justify-center gap-10 sm:gap-14">
        <ActionTile
          icon={<FileText className="h-9 w-9 text-content-secondary" strokeWidth={1.5} />}
          label="Send document"
          onClick={handleSendDocument}
        />
        <ActionTile
          icon={<UserPlus className="h-9 w-9 text-content-secondary" strokeWidth={1.5} />}
          label="Add contact"
          onClick={() => router.push("/friends")}
        />
        <ActionTile
          icon={<Users className="h-9 w-9 text-content-secondary" strokeWidth={1.5} />}
          label="Find people"
          onClick={() => {
            onFocusSearch?.();
            toast("Search or pick a chat to start messaging.");
          }}
        />
      </div>

      <input
        ref={documentInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={handleDocumentSelected}
        aria-hidden
        tabIndex={-1}
      />
    </div>
  );
}
