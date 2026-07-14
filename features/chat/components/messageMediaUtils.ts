import type { ChatAttachment } from "@/features/chat/services/supabaseMessagingService";

const EMOJI_ONLY_RE =
  /^(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E0}-\u{1F1FF}\u{200D}\u{20E3}\s])+$/u;

export function isEmojiOnlyMessage(text: string | undefined | null): boolean {
  const t = (text || "").trim();
  if (!t || t.length > 24) return false;
  try {
    return EMOJI_ONLY_RE.test(t);
  } catch {
    return false;
  }
}

export function formatAttachmentSize(size: number): string {
  if (!Number.isFinite(size) || size < 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1048576) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1048576).toFixed(1)} MB`;
}

export function formatMediaDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function isGifAttachment(att: ChatAttachment): boolean {
  const mime = (att.mimeType || "").toLowerCase();
  const name = (att.name || "").toLowerCase();
  return mime === "image/gif" || name.endsWith(".gif");
}

export function isAudioAttachment(att: ChatAttachment): boolean {
  return (
    (att.mimeType || "").toLowerCase().startsWith("audio/") ||
    (att.name || "").toLowerCase().match(/\.(mp3|m4a|wav|ogg|aac|webm)$/) != null
  );
}

export function isVoiceNoteAttachment(att: ChatAttachment): boolean {
  const name = (att.name || "").toLowerCase();
  return isAudioAttachment(att) && (name.startsWith("voice-") || name.includes("voice"));
}

export function isPdfAttachment(att: ChatAttachment): boolean {
  const mime = (att.mimeType || "").toLowerCase();
  const name = (att.name || "").toLowerCase();
  return mime === "application/pdf" || name.endsWith(".pdf");
}

/** Stable pastel color for group participant names */
const PARTICIPANT_COLORS = [
  "#e17076",
  "#7bc862",
  "#e5ab49",
  "#65aadd",
  "#ee7aae",
  "#6ec3c0",
  "#faa774",
  "#a695e7",
] as const;

export function participantNameColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return PARTICIPANT_COLORS[hash % PARTICIPANT_COLORS.length];
}

export function extractFirstUrl(text: string): string | null {
  const m = text.match(/(?:https?:\/\/|www\.)[^\s<]+/i);
  if (!m) return null;
  const url = m[0];
  return url.startsWith("http") ? url : `https://${url}`;
}

/** UUID-style post id from ConnectAfrik post URLs (web, app deep links, or relative paths). */
const POST_ID =
  "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})";
const POST_URL_RE = new RegExp(
  `(?:https?:\\/\\/[^\\s/]+|connectafrik:\\/\\/)?\\/post\\/${POST_ID}(?:[/?#][^\\s]*)?`,
  "i"
);

export function extractConnectAfrikPostId(text: string | undefined | null): string | null {
  const raw = text || "";
  const m = raw.match(POST_URL_RE);
  return m?.[1] ?? null;
}

export function stripConnectAfrikPostUrls(text: string): string {
  return text
    .replace(new RegExp(POST_URL_RE.source, "gi"), "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
