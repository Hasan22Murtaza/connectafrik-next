"use client";

import EmojiPicker from "@/shared/components/ui/EmojiPicker";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import ChatFormattingToolbar from "./ChatFormattingToolbar";
import {
  type FormatCommand,
  htmlToMarkdown,
  markdownToHtml,
  pastedHtmlToMarkdown,
  richTextIsEmpty,
} from "./markdown";

export interface MentionCandidate {
  id: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
}

export interface ChatRichTextEditorHandle {
  focus: () => void;
  clear: () => void;
  getMarkdown: () => string;
  setMarkdown: (md: string) => void;
}

interface ChatRichTextEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  onTyping?: () => void;
  /** Ctrl/Cmd+Enter to send */
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  mentionCandidates?: MentionCandidate[];
  className?: string;
  minRows?: number;
  showToolbar?: boolean;
  toolbarAlwaysVisible?: boolean;
}

function saveSelection(root: HTMLElement): Range | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;
  return range.cloneRange();
}

function restoreSelection(range: Range | null) {
  if (!range) return;
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

function insertTextAtCursor(text: string) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.setEndAfter(node);
  sel.removeAllRanges();
  sel.addRange(range);
}

function surroundWithMarkers(before: string, after: string, placeholder = "text") {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  const selected = range.toString() || placeholder;
  range.deleteContents();
  const text = document.createTextNode(before + selected + after);
  range.insertNode(text);

  // Select the inner placeholder/text
  const next = document.createRange();
  next.setStart(text, before.length);
  next.setEnd(text, before.length + selected.length);
  sel.removeAllRanges();
  sel.addRange(next);
}

function prefixLines(root: HTMLElement, prefixFn: (i: number) => string) {
  const md = htmlToMarkdown(root);
  const lines = md.length ? md.split("\n") : [""];
  const next = lines.map((line, i) => {
    const trimmed = line.replace(/^([-*]|\d+\.)\s+/, "").replace(/^>\s?/, "");
    return prefixFn(i) + trimmed;
  });
  root.innerHTML = markdownToHtml(next.join("\n"));
}

const ChatRichTextEditor = forwardRef<ChatRichTextEditorHandle, ChatRichTextEditorProps>(
  function ChatRichTextEditor(
    {
      value,
      onChange,
      onTyping,
      onSubmit,
      placeholder = "Type a message",
      disabled = false,
      mentionCandidates = [],
      className = "",
      minRows = 1,
      showToolbar = true,
      toolbarAlwaysVisible = false,
    },
    ref
  ) {
    const editorRef = useRef<HTMLDivElement>(null);
    const lastExternalValue = useRef(value);
    const historyRef = useRef<string[]>([value || ""]);
    const historyIndexRef = useRef(0);
    const applyingHistory = useRef(false);
    const savedRangeRef = useRef<Range | null>(null);

    const [focused, setFocused] = useState(false);
    const [emojiOpen, setEmojiOpen] = useState(false);
    const [mentionOpen, setMentionOpen] = useState(false);
    const [mentionQuery, setMentionQuery] = useState("");
    const [linkOpen, setLinkOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState("https://");
    const [colorOpen, setColorOpen] = useState(false);
    const [showToolbarState, setShowToolbarState] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const blurHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const hideToolbar = useCallback(() => {
      setShowToolbarState(false);
      setEmojiOpen(false);
      setLinkOpen(false);
      setColorOpen(false);
      setMentionOpen(false);
    }, []);

    const syncFromEditor = useCallback(() => {
      const el = editorRef.current;
      if (!el) return;
      const md = htmlToMarkdown(el);
      if (!applyingHistory.current) {
        const hist = historyRef.current;
        const idx = historyIndexRef.current;
        if (hist[idx] !== md) {
          historyRef.current = [...hist.slice(0, idx + 1), md].slice(-80);
          historyIndexRef.current = historyRef.current.length - 1;
        }
      }
      onChange(md);
      onTyping?.();
    }, [onChange, onTyping]);

    const setEditorMarkdown = useCallback((md: string) => {
      const el = editorRef.current;
      if (!el) return;
      const html = md ? markdownToHtml(md) : "";
      el.innerHTML = html || "";
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => editorRef.current?.focus(),
        clear: () => {
          if (editorRef.current) editorRef.current.innerHTML = "";
          onChange("");
          hideToolbar();
        },
        getMarkdown: () =>
          editorRef.current ? htmlToMarkdown(editorRef.current) : value,
        setMarkdown: (md: string) => {
          setEditorMarkdown(md);
          lastExternalValue.current = md;
          onChange(md);
        },
      }),
      [onChange, setEditorMarkdown, value, hideToolbar]
    );

    // Sync external value (e.g. edit message / cancel edit)
    useEffect(() => {
      if (value === lastExternalValue.current) return;
      lastExternalValue.current = value;
      const el = editorRef.current;
      if (!el) return;
      const current = htmlToMarkdown(el);
      if (current !== value) {
        setEditorMarkdown(value);
      }
    }, [value, setEditorMarkdown]);

    useEffect(() => {
      return () => {
        if (blurHideTimer.current) clearTimeout(blurHideTimer.current);
      };
    }, []);

    const pushHistoryAndApply = (md: string) => {
      applyingHistory.current = true;
      setEditorMarkdown(md);
      lastExternalValue.current = md;
      onChange(md);
      applyingHistory.current = false;
    };

    const applyCommand = useCallback(
      (cmd: FormatCommand) => {
        const el = editorRef.current;
        if (!el || disabled) return;
        el.focus();
        restoreSelection(savedRangeRef.current);

        switch (cmd) {
          case "bold":
            surroundWithMarkers("**", "**");
            break;
          case "italic":
            surroundWithMarkers("*", "*");
            break;
          case "underline":
            surroundWithMarkers("++", "++");
            break;
          case "strike":
            surroundWithMarkers("~~", "~~");
            break;
          case "code":
            surroundWithMarkers("`", "`", "code");
            break;
          case "codeblock":
            surroundWithMarkers("```\n", "\n```", "code");
            break;
          case "highlight":
            surroundWithMarkers("==", "==");
            break;
          case "color":
            setColorOpen(true);
            return;
          case "link":
            setLinkOpen(true);
            setLinkUrl("https://");
            return;
          case "ul":
            prefixLines(el, () => "- ");
            break;
          case "ol":
            prefixLines(el, (i) => `${i + 1}. `);
            break;
          case "quote":
            prefixLines(el, () => "> ");
            break;
          case "mention":
            insertTextAtCursor("@");
            setMentionOpen(true);
            setMentionQuery("");
            break;
          case "undo": {
            if (historyIndexRef.current > 0) {
              historyIndexRef.current -= 1;
              pushHistoryAndApply(historyRef.current[historyIndexRef.current]);
            }
            return;
          }
          case "redo": {
            if (historyIndexRef.current < historyRef.current.length - 1) {
              historyIndexRef.current += 1;
              pushHistoryAndApply(historyRef.current[historyIndexRef.current]);
            }
            return;
          }
          default:
            break;
        }
        syncFromEditor();
        // Re-render markers as rich HTML
        const md = htmlToMarkdown(el);
        setEditorMarkdown(md);
        lastExternalValue.current = md;
        onChange(md);
      },
      [disabled, onChange, setEditorMarkdown, syncFromEditor]
    );

    const insertMention = (m: MentionCandidate) => {
      const label = m.username || m.name.replace(/\s+/g, "");
      // Remove trailing partial @query if present is handled by inserting full token
      insertTextAtCursor(`${label} `);
      setMentionOpen(false);
      setMentionQuery("");
      syncFromEditor();
      editorRef.current?.focus();
    };

    const applyLink = () => {
      const url = linkUrl.trim();
      if (!url) {
        setLinkOpen(false);
        return;
      }
      const el = editorRef.current;
      el?.focus();
      restoreSelection(savedRangeRef.current);
      const sel = window.getSelection();
      const label = (sel?.toString() || "link").trim() || "link";
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const text = document.createTextNode(`[${label}](${url})`);
        range.insertNode(text);
        range.setStartAfter(text);
        range.setEndAfter(text);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      setLinkOpen(false);
      if (el) {
        const md = htmlToMarkdown(el);
        setEditorMarkdown(md);
        lastExternalValue.current = md;
        onChange(md);
        onTyping?.();
      }
    };

    const applyColor = (color: string) => {
      const el = editorRef.current;
      el?.focus();
      restoreSelection(savedRangeRef.current);
      surroundWithMarkers(`{{color:${color}}}`, "{{/color}}");
      setColorOpen(false);
      syncFromEditor();
      if (el) {
        const md = htmlToMarkdown(el);
        setEditorMarkdown(md);
        lastExternalValue.current = md;
        onChange(md);
      }
    };

    const filteredMentions = mentionCandidates
      .filter((m) => {
        const q = mentionQuery.toLowerCase();
        if (!q) return true;
        return (
          m.name.toLowerCase().includes(q) ||
          (m.username || "").toLowerCase().includes(q)
        );
      })
      .slice(0, 6);

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        applyCommand("bold");
        return;
      }
      if (mod && e.key.toLowerCase() === "i") {
        e.preventDefault();
        applyCommand("italic");
        return;
      }
      if (mod && e.key.toLowerCase() === "u") {
        e.preventDefault();
        applyCommand("underline");
        return;
      }
      if (mod && e.key.toLowerCase() === "e") {
        e.preventDefault();
        applyCommand("code");
        return;
      }
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        applyCommand("link");
        return;
      }
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        applyCommand("undo");
        return;
      }
      if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        applyCommand("redo");
        return;
      }
      if (mod && e.key === "Enter") {
        e.preventDefault();
        onSubmit?.();
        return;
      }

      // Detect @ mention trigger
      if (e.key === "@") {
        setMentionOpen(true);
        setMentionQuery("");
      }

      if (mentionOpen) {
        if (e.key === "Escape") {
          setMentionOpen(false);
          return;
        }
        if (e.key === "Backspace" && mentionQuery === "") {
          setMentionOpen(false);
        }
      }
    };

    const handleEditorInput = () => {
      const el = editorRef.current;
      if (!el) return;

      if (document.activeElement === el) {
        setFocused(true);
        setShowToolbarState(true);
      }

      // Track mention query from text before caret
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const preRange = sel.getRangeAt(0).cloneRange();
        preRange.selectNodeContents(el);
        preRange.setEnd(sel.anchorNode || el, sel.anchorOffset);
        const preText = preRange.toString();
        const atMatch = preText.match(/@([\w.-]*)$/);
        if (atMatch) {
          setMentionOpen(true);
          setMentionQuery(atMatch[1]);
        } else if (mentionOpen && !preText.endsWith("@")) {
          if (!/@[\w.-]*$/.test(preText)) setMentionOpen(false);
        }
      }

      syncFromEditor();
      lastExternalValue.current = htmlToMarkdown(el);
    };

    const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const html = e.clipboardData.getData("text/html");
      const text = e.clipboardData.getData("text/plain");
      let md = "";
      if (html) {
        md = pastedHtmlToMarkdown(html);
      } else {
        md = text;
      }
      insertTextAtCursor(md);
      const el = editorRef.current;
      if (el) {
        const full = htmlToMarkdown(el);
        setEditorMarkdown(full);
        lastExternalValue.current = full;
        onChange(full);
        onTyping?.();
      }
    };

    const empty = richTextIsEmpty(value);
    // Visible while typing in the field; hidden on blur / after send (clear).
    const toolbarVisible = showToolbar && (toolbarAlwaysVisible || showToolbarState);

    return (
      <div ref={rootRef} className={`relative flex min-w-0 flex-1 flex-col ${className}`}>
        {toolbarVisible ? (
          <div
            className="mb-1.5 animate-[chatFadeIn_140ms_ease-out]"
            onMouseDown={(e) => {
              // Keep editor focus when interacting with toolbar
              e.preventDefault();
            }}
          >
            <ChatFormattingToolbar
              disabled={disabled}
              compact
              showHighlight
              showColor
              onEmoji={() => {
                savedRangeRef.current = editorRef.current
                  ? saveSelection(editorRef.current)
                  : null;
                setEmojiOpen((o) => !o);
              }}
              onCommand={(cmd) => {
                savedRangeRef.current = editorRef.current
                  ? saveSelection(editorRef.current)
                  : null;
                applyCommand(cmd);
              }}
            />
          </div>
        ) : null}

        <div className="relative flex min-w-0 items-end gap-0.5 rounded-2xl border-0 bg-surface-secondary pl-2 pr-2 py-1 transition focus-within:bg-surface-tertiary/35">
          <div className="relative min-w-0 flex-1">
            {empty && !focused ? (
              <div className="pointer-events-none absolute left-1 top-2 text-[15px] text-content-tertiary">
                {placeholder}
              </div>
            ) : null}
            <div
              ref={editorRef}
              role="textbox"
              aria-multiline="true"
              aria-label={placeholder}
              aria-disabled={disabled}
              contentEditable={!disabled}
              suppressContentEditableWarning
              spellCheck
              className="chat-rt-editor max-h-32 min-h-[40px] w-full overflow-y-auto overflow-x-hidden bg-transparent px-1 py-2 text-[15px] leading-snug text-content outline-none focus:outline-none empty:before:content-[''] sm:max-h-40"
              style={{ minHeight: `${Math.max(1, minRows) * 24 + 16}px` }}
              onFocus={() => {
                if (blurHideTimer.current) {
                  clearTimeout(blurHideTimer.current);
                  blurHideTimer.current = null;
                }
                setFocused(true);
                setShowToolbarState(true);
              }}
              onBlur={() => {
                setFocused(false);
                savedRangeRef.current = editorRef.current
                  ? saveSelection(editorRef.current)
                  : null;
                if (blurHideTimer.current) clearTimeout(blurHideTimer.current);
                blurHideTimer.current = setTimeout(() => {
                  const active = document.activeElement;
                  if (rootRef.current?.contains(active)) {
                    setFocused(true);
                    return;
                  }
                  const el = editorRef.current;
                  if (el) {
                    const md = htmlToMarkdown(el);
                    setEditorMarkdown(md);
                    lastExternalValue.current = md;
                  }
                  hideToolbar();
                }, 120);
              }}
              onKeyDown={onKeyDown}
              onInput={handleEditorInput}
              onPaste={onPaste}
              onMouseUp={() => {
                if (editorRef.current) {
                  savedRangeRef.current = saveSelection(editorRef.current);
                }
              }}
              onKeyUp={() => {
                if (editorRef.current) {
                  savedRangeRef.current = saveSelection(editorRef.current);
                }
              }}
            />
          </div>

          <button
            type="button"
            disabled={disabled}
            className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-content-secondary transition hover:text-content disabled:opacity-40 sm:hidden"
            aria-label="Toggle formatting toolbar"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowToolbarState((v) => !v)}
          >
            <span className="text-xs font-bold tracking-tight">Aa</span>
          </button>
        </div>

        {emojiOpen ? (
          <div className="absolute bottom-full left-0 z-[80] mb-2 w-[min(100%,20rem)] max-w-[calc(100vw-1rem)]">
            <EmojiPicker
              isOpen={emojiOpen}
              variant="compact"
              onClose={() => setEmojiOpen(false)}
              onEmojiSelect={(emoji) => {
                editorRef.current?.focus();
                restoreSelection(savedRangeRef.current);
                insertTextAtCursor(emoji);
                setEmojiOpen(false);
                syncFromEditor();
              }}
            />
          </div>
        ) : null}

        {mentionOpen && filteredMentions.length > 0 ? (
          <div
            className="absolute bottom-full left-0 z-[75] mb-2 max-h-48 w-[min(100%,16rem)] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border border-border bg-surface py-1 shadow-xl animate-[chatFadeIn_140ms_ease-out]"
            role="listbox"
            aria-label="Mentions"
          >
            {filteredMentions.map((m) => (
              <button
                key={m.id}
                type="button"
                role="option"
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertMention(m)}
              >
                {m.avatarUrl ? (
                  <img src={m.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-secondary text-xs font-semibold text-content-secondary">
                    {m.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-content">{m.name}</span>
                  {m.username ? (
                    <span className="block truncate text-[11px] text-content-tertiary">
                      @{m.username}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {linkOpen ? (
          <div className="absolute bottom-full left-0 z-[80] mb-2 flex w-[min(100%,280px)] max-w-[calc(100vw-1.5rem)] items-center gap-1 rounded-xl border border-border bg-surface p-2 shadow-xl animate-[chatFadeIn_140ms_ease-out]">
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://"
              className="min-w-0 flex-1 rounded-lg bg-surface-secondary px-2 py-1.5 text-sm text-content outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                }
                if (e.key === "Escape") setLinkOpen(false);
              }}
            />
            <button
              type="button"
              className="rounded-lg bg-[#00a884] px-2.5 py-1.5 text-xs font-semibold text-white"
              onClick={applyLink}
            >
              Add
            </button>
          </div>
        ) : null}

        {colorOpen ? (
          <div className="absolute bottom-full left-0 z-[80] mb-2 flex gap-1.5 rounded-xl border border-border bg-surface p-2 shadow-xl animate-[chatFadeIn_140ms_ease-out]">
            {["#e11d48", "#ea580c", "#ca8a04", "#16a34a", "#2563eb", "#7c3aed", "#0f172a"].map(
              (c) => (
                <button
                  key={c}
                  type="button"
                  className="h-7 w-7 rounded-full ring-1 ring-black/10 transition hover:scale-110"
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyColor(c)}
                />
              )
            )}
          </div>
        ) : null}
      </div>
    );
  }
);

export default ChatRichTextEditor;
