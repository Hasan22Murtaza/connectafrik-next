"use client";

import React, { useMemo } from "react";
import { markdownToHtml, stripMarkdown } from "./markdown";

interface ChatRichTextRendererProps {
  content: string;
  isOwnMessage?: boolean;
  className?: string;
  /** Truncate long messages for preview */
  maxChars?: number;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

const ChatRichTextRenderer: React.FC<ChatRichTextRendererProps> = ({
  content,
  isOwnMessage = false,
  className = "",
  maxChars,
  expanded = true,
  onToggleExpand,
}) => {
  const plain = stripMarkdown(content || "");
  const shouldTruncate = Boolean(maxChars && plain.length > maxChars && !expanded);

  const displayMd = useMemo(() => {
    if (!shouldTruncate || !maxChars) return content || "";
    // Soft truncate on raw md (display-side only)
    let cut = content.slice(0, maxChars);
    const lastBreak = Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf(" "));
    if (lastBreak > maxChars * 0.5) cut = cut.slice(0, lastBreak);
    return cut + "…";
  }, [content, shouldTruncate, maxChars]);

  const html = useMemo(() => markdownToHtml(displayMd), [displayMd]);

  if (!content?.trim()) return null;

  return (
    <div className={`chat-rt-body ${isOwnMessage ? "chat-rt-own" : ""} ${className}`}>
      <div
        className="chat-rt-content break-words text-[14px] leading-[1.45] text-content sm:text-[14.5px]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {maxChars && plain.length > maxChars && onToggleExpand ? (
        <button
          type="button"
          onClick={onToggleExpand}
          className={`mt-1 text-[12px] font-medium hover:underline ${
            isOwnMessage
              ? "text-[#027eb5] hover:text-[#026aa1]"
              : "text-blue-600 hover:text-blue-800"
          }`}
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      ) : null}
    </div>
  );
};

export default ChatRichTextRenderer;
