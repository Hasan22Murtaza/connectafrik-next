"use client";

import React, { useMemo } from "react";
import { markdownToPreviewHtml } from "./markdown";

interface ChatRichTextPreviewProps {
  content: string;
  className?: string;
}

const ChatRichTextPreview: React.FC<ChatRichTextPreviewProps> = ({
  content,
  className = "",
}) => {
  const html = useMemo(() => markdownToPreviewHtml(content || ""), [content]);

  if (!content?.trim()) return null;

  return (
    <span
      className={`chat-rt-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default ChatRichTextPreview;
