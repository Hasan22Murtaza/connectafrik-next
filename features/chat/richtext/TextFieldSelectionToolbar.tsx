"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ChatFormattingToolbar from "./ChatFormattingToolbar";
import type { FormatCommand } from "./markdown";

type TextField = HTMLInputElement | HTMLTextAreaElement;

interface TextFieldSelectionToolbarProps {
  editorRef: React.RefObject<TextField | null>;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const TOOLBAR_WIDTH = 220;
const TOOLBAR_HEIGHT = 40;
const TOOLBAR_GAP = 8;
const FORMAT_MARKERS: Partial<Record<FormatCommand, [string, string]>> = {
  bold: ["**", "**"],
  italic: ["*", "*"],
  strike: ["~~", "~~"],
  code: ["`", "`"],
};

function isWrappedSelection(value: string, start: number, end: number, before: string, after: string) {
  const selected = value.slice(start, end);
  if (before === "*" && after === "*") {
    let openingStars = 0;
    let closingStars = 0;
    for (let index = start - 1; index >= 0 && value[index] === "*"; index -= 1) openingStars += 1;
    for (let index = end; index < value.length && value[index] === "*"; index += 1) closingStars += 1;
    if (openingStars > 0 || closingStars > 0) {
      return openingStars === closingStars && openingStars > 0 && openingStars !== 2;
    }

    let selectedOpeningStars = 0;
    let selectedClosingStars = 0;
    while (selected[selectedOpeningStars] === "*") selectedOpeningStars += 1;
    while (selected[selected.length - selectedClosingStars - 1] === "*") selectedClosingStars += 1;
    return selectedOpeningStars === selectedClosingStars &&
      selectedOpeningStars > 0 &&
      selectedOpeningStars !== 2;
  }

  return (
    (value.slice(start - before.length, start) === before &&
      value.slice(end, end + after.length) === after) ||
    (selected.startsWith(before) && selected.endsWith(after))
  );
}

const TextFieldSelectionToolbar: React.FC<TextFieldSelectionToolbarProps> = ({
  editorRef,
  onChange,
  disabled = false,
}) => {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [active, setActive] = useState<Partial<Record<FormatCommand, boolean>>>({});

  const updatePosition = useCallback(() => {
    const field = editorRef.current;
    if (!field || document.activeElement !== field || field.selectionStart === field.selectionEnd) {
      setPosition(null);
      setActive({});
      return;
    }

    const start = field.selectionStart;
    const end = field.selectionEnd;
    const value = field.value;
    const selectedLines = value
      .slice(value.lastIndexOf("\n", start - 1) + 1, value.indexOf("\n", Math.max(start, end - 1)) === -1
        ? value.length
        : value.indexOf("\n", Math.max(start, end - 1)))
      .split("\n");
    const everyLineStartsWith = (expression: RegExp) =>
      selectedLines.every((line) => expression.test(line));
    setActive({
      bold: isWrappedSelection(value, start, end, "**", "**"),
      italic: isWrappedSelection(value, start, end, "*", "*"),
      strike: isWrappedSelection(value, start, end, "~~", "~~"),
      code: isWrappedSelection(value, start, end, "`", "`"),
      ul: everyLineStartsWith(/^[-*]\s+/),
      ol: everyLineStartsWith(/^\d+\.\s+/),
      quote: everyLineStartsWith(/^>\s?/),
    });
    const fieldRect = field.getBoundingClientRect();
    const mirror = document.createElement("div");
    const computed = window.getComputedStyle(field);
    const copiedStyles = [
      "font",
      "letter-spacing",
      "word-spacing",
      "text-indent",
      "text-transform",
      "text-align",
      "line-height",
      "padding-top",
      "padding-right",
      "padding-bottom",
      "padding-left",
      "border-top-width",
      "border-right-width",
      "border-bottom-width",
      "border-left-width",
      "box-sizing",
      "tab-size",
    ];

    mirror.style.position = "fixed";
    mirror.style.left = `${fieldRect.left}px`;
    mirror.style.top = `${fieldRect.top}px`;
    mirror.style.width = `${fieldRect.width}px`;
    mirror.style.height = `${fieldRect.height}px`;
    mirror.style.visibility = "hidden";
    mirror.style.pointerEvents = "none";
    mirror.style.overflow = "hidden";
    mirror.style.whiteSpace = field instanceof HTMLTextAreaElement ? "pre-wrap" : "pre";
    mirror.style.overflowWrap = field instanceof HTMLTextAreaElement ? "break-word" : "normal";
    copiedStyles.forEach((style) => mirror.style.setProperty(style, computed.getPropertyValue(style)));

    const before = document.createTextNode(field.value.slice(0, start));
    const selected = document.createElement("span");
    selected.textContent = field.value.slice(start, end);
    const after = document.createTextNode(field.value.slice(end));
    mirror.append(before, selected, after);
    document.body.appendChild(mirror);
    mirror.scrollTop = field.scrollTop;
    mirror.scrollLeft = field.scrollLeft;

    const selectionRect = selected.getClientRects()[0] ?? fieldRect;
    const left = Math.max(
      8,
      Math.min(
        selectionRect.left + selectionRect.width / 2 - TOOLBAR_WIDTH / 2,
        window.innerWidth - TOOLBAR_WIDTH - 8
      )
    );
    const top = Math.max(8, selectionRect.top - TOOLBAR_HEIGHT - TOOLBAR_GAP);

    mirror.remove();
    setPosition({ left, top });
  }, [editorRef]);

  useEffect(() => {
    const field = editorRef.current;
    if (!field) return;

    const handleBlur = () => {
      window.setTimeout(() => {
        if (!field.contains(document.activeElement)) setPosition(null);
      }, 0);
    };

    field.addEventListener("select", updatePosition);
    field.addEventListener("mouseup", updatePosition);
    field.addEventListener("keyup", updatePosition);
    field.addEventListener("focus", updatePosition);
    field.addEventListener("blur", handleBlur);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      field.removeEventListener("select", updatePosition);
      field.removeEventListener("mouseup", updatePosition);
      field.removeEventListener("keyup", updatePosition);
      field.removeEventListener("focus", updatePosition);
      field.removeEventListener("blur", handleBlur);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [editorRef, updatePosition]);

  const applyCommand = (command: FormatCommand) => {
    const field = editorRef.current;
    if (!field || disabled) return;

    const start = field.selectionStart;
    const end = field.selectionEnd;
    if (start === end) return;

    const currentValue = field.value;
    const selected = currentValue.slice(start, end);
    let replacement = selected;
    let replaceStart = start;
    let replaceEnd = end;
    let selectedStart = start;
    let selectedEnd = end;

    const marker = FORMAT_MARKERS[command];

    if (marker) {
      if (isWrappedSelection(currentValue, start, end, marker[0], marker[1])) {
        if (
          currentValue.slice(start - marker[0].length, start) === marker[0] &&
          currentValue.slice(end, end + marker[1].length) === marker[1]
        ) {
          replaceStart = start - marker[0].length;
          replaceEnd = end + marker[1].length;
          selectedStart = replaceStart;
          selectedEnd = selectedStart + selected.length;
        } else {
          replacement = selected.slice(marker[0].length, -marker[1].length);
          selectedEnd = selectedStart + replacement.length;
        }
      } else {
        replacement = `${marker[0]}${selected}${marker[1]}`;
        selectedStart += marker[0].length;
        selectedEnd = selectedStart + selected.length;
      }
    } else {
      const prefix =
        command === "ul" ? "- " :
        command === "ol" ? "1. " :
        command === "quote" ? "> " :
        null;

      if (!prefix) return;
      replaceStart = currentValue.lastIndexOf("\n", start - 1) + 1;
      const lastSelectedCharacter = Math.max(start, end - 1);
      const followingNewline = currentValue.indexOf("\n", lastSelectedCharacter);
      replaceEnd = followingNewline === -1 ? currentValue.length : followingNewline;
      const selectedLines = currentValue.slice(replaceStart, replaceEnd)
        .split("\n")
        .map((line) => line.replace(/^([-*]|\d+\.)\s+/, "").replace(/^>\s?/, ""));
      const linePrefix = command === "ul" ? /^[-*]\s+/ : command === "ol" ? /^\d+\.\s+/ : /^>\s?/;
      const removePrefix = selectedLines.every((line) => linePrefix.test(line));
      replacement = selectedLines
        .map((line, index) => removePrefix
          ? line.replace(linePrefix, "")
          : `${command === "ol" ? `${index + 1}. ` : prefix}${line}`)
        .join("\n");
      selectedStart = replaceStart;
      selectedEnd = replaceStart + replacement.length;
    }

    const nextValue = `${currentValue.slice(0, replaceStart)}${replacement}${currentValue.slice(replaceEnd)}`;
    onChange(nextValue);
    setPosition(null);
    requestAnimationFrame(() => {
      if (field instanceof HTMLTextAreaElement) {
        field.style.height = "auto";
        field.style.height = `${field.scrollHeight}px`;
      }
      field.focus();
      field.setSelectionRange(selectedStart, selectedEnd);
      updatePosition();
    });
  };

  if (!position || disabled) return null;

  return createPortal(
    <div
      className="fixed z-[11000] animate-[chatFadeIn_140ms_ease-out]"
      style={{ left: position.left, top: position.top }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <ChatFormattingToolbar compact active={active} onCommand={applyCommand} />
    </div>,
    document.body
  );
};

export default TextFieldSelectionToolbar;
