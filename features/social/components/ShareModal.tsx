import React, { useState, useEffect, useRef, useCallback } from "react";
import Portal from "@/shared/components/ui/Portal";
import EmojiPicker from "@/shared/components/ui/EmojiPicker";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/shared/hooks/useProfile";
import {
  X,
  MessageCircle,
  Users,
  Link2,
  ChevronLeft,
  ChevronRight,
  Globe,
  ChevronDown,
  Smile,
  Newspaper,
  UserRound,
} from '@/shared/icons';
import { FaWhatsapp } from "react-icons/fa";
import toast from "react-hot-toast";

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  postUrl: string;
  postId: string;
  members: Array<{ id: string; name: string; avatar_url?: string }>;
  onSendToMembers: (memberIds: string[], message: string) => Promise<void>;
  /** Optional custom handler when user taps Share now (caption only, no repost). */
  onShareNow?: (message: string) => Promise<void>;
  /** Optional callback fired whenever a share action succeeds, with the destination platform. */
  onShared?: (platform: string) => void;
}

const FB_BLUE = "#F97316";

type ShareToOption = {
  name: string;
  icon: React.ReactNode;
  action: () => void;
};

const buildShareText = (caption: string, url: string) => {
  const trimmed = caption.trim();
  return trimmed ? `${trimmed}\n${url}` : url;
};

const buildShareToOptions = (
  fullUrl: string,
  caption: string,
  onCopy: () => void,
  onFeedShare: () => void,
  onShared?: (platform: string) => void
): ShareToOption[] => [
  {
    name: "Chat",
    icon: <MessageCircle className="w-5 h-5 text-gray-700" />,
    action: () => {
      onShared?.("chat");
      window.open("/chat", "_blank", "noopener,noreferrer");
    },
  },
  {
    name: "WhatsApp",
    icon: <FaWhatsapp className="w-5 h-5 text-gray-700" />,
    action: () => {
      onShared?.("whatsapp");
      window.open(
        `https://wa.me/?text=${encodeURIComponent(buildShareText(caption, fullUrl))}`,
        "_blank",
        "noopener,noreferrer"
      );
    },
  },
  {
    name: "News Feed",
    icon: <Newspaper className="w-5 h-5 text-gray-700" />,
    action: onFeedShare,
  },
  {
    name: "Copy Link",
    icon: <Link2 className="w-5 h-5 text-gray-700" />,
    action: onCopy,
  },
  {
    name: "Groups",
    icon: <Users className="w-5 h-5 text-gray-700" />,
    action: () => {
      window.open("/groups", "_blank", "noopener,noreferrer");
    },
  },
  {
    name: "Friends",
    icon: <UserRound className="w-5 h-5 text-gray-700" />,
    action: () => {
      window.open("/friends", "_blank", "noopener,noreferrer");
    },
  },
];

const MemberAvatar: React.FC<{
  name: string;
  avatarUrl?: string;
  selected: boolean;
  onClick: () => void;
}> = ({ name, avatarUrl, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 focus:outline-none"
    aria-pressed={selected}
  >
    <div
      className={`relative rounded-full p-0.5 transition-colors ${
        selected ? "ring-2 ring-[#F97316] ring-offset-1" : ""
      }`}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="h-12 w-12 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      {selected && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#F97316] text-[10px] font-bold text-white">
          ✓
        </span>
      )}
    </div>
    <span className="w-full truncate px-0.5 text-center text-xs text-gray-800">
      {name}
    </span>
  </button>
);

const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  postUrl,
  postId,
  members,
  onSendToMembers,
  onShareNow,
  onShared,
}) => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sharingNow, setSharingNow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const membersScrollRef = useRef<HTMLDivElement>(null);
  const [memberScrollState, setMemberScrollState] = useState({
    canScrollLeft: false,
    canScrollRight: false,
  });

  const displayName =
    profile?.full_name?.trim() ||
    user?.user_metadata?.full_name?.trim() ||
    user?.email?.split("@")[0] ||
    "You";
  const avatarUrl =
    profile?.avatar_url || user?.user_metadata?.avatar_url || undefined;

  const fullUrl = (() => {
    if (!postUrl) return "";
    if (/^https?:\/\//.test(postUrl)) return postUrl;
    const base =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || "";
    return `${base}${postUrl.startsWith("/") ? "" : "/"}${postUrl}`;
  })();

  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSelected([]);
      setMessage("");
      setCopied(false);
      setShowEmojiPicker(false);
    }
  }, [isOpen]);

  const handleSelect = useCallback((id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const handleSendToSelected = async () => {
    if (selected.length === 0) return;
    setSending(true);
    try {
      await onSendToMembers(selected, message);
      onShared?.("members");
      setSelected([]);
      setMessage("");
      onClose();
    } finally {
      setSending(false);
    }
  };

  const handleShareNow = async () => {
    setSharingNow(true);
    try {
      if (selected.length > 0) {
        await onSendToMembers(selected, message);
        onShared?.("members");
        setSelected([]);
      } else if (onShareNow) {
        await onShareNow(message);
        onShared?.("internal");
      } else {
        const shareText = buildShareText(message, fullUrl);
        if (navigator.share) {
          await navigator.share({
            url: fullUrl,
            text: message.trim() || undefined,
          });
          onShared?.("native");
        } else {
          await navigator.clipboard.writeText(shareText);
          onShared?.("copy");
          toast.success("Link copied");
        }
      }
      setMessage("");
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Could not share";
      toast.error(msg);
    } finally {
      setSharingNow(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildShareText(message, fullUrl));
    onShared?.("copy");
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const updateMemberScrollState = useCallback(() => {
    const el = membersScrollRef.current;
    if (!el) return;
    setMemberScrollState({
      canScrollLeft: el.scrollLeft > 1,
      canScrollRight: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setMemberScrollState({ canScrollLeft: false, canScrollRight: false });
      return;
    }

    const el = membersScrollRef.current;
    if (!el) return;

    const update = () => updateMemberScrollState();
    const frame = window.requestAnimationFrame(update);
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);

    return () => {
      window.cancelAnimationFrame(frame);
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      resizeObserver.disconnect();
    };
  }, [isOpen, members.length, updateMemberScrollState]);

  const scrollMembers = (direction: "left" | "right") => {
    const el = membersScrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction === "right" ? el.clientWidth * 0.8 : -el.clientWidth * 0.8,
      behavior: "smooth",
    });
  };

  if (!isOpen) return null;

  const shareOptions = buildShareToOptions(
    fullUrl,
    message,
    handleCopy,
    handleShareNow,
    onShared
  );

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[1000] bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 z-[1001] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Share"
      >
        <div
          className="relative w-full max-w-[500px] overflow-hidden rounded-xl bg-white shadow-[0_12px_28px_rgba(0,0,0,0.2)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative flex items-center justify-between border-b border-gray-200 bg-primary-500 px-4 py-3">
            <h2 className="text-xl font-bold text-white">Share</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-100 hover:text-gray-700 focus:outline-none"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Compose + Share now */}
          <div className="px-4 py-3">
            <div className="flex gap-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-600">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-gray-900">
                  {displayName}
                </p>
                <p className="text-xs text-gray-500">{profile?.username}</p>
              </div>
            </div>

            <div className="relative mt-3">
              <textarea
                rows={3}
                className="w-full resize-none border-0 bg-transparent text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                placeholder="Say something about this..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />

            </div>

           
          </div>

          <div className="border-t border-gray-200" />

          {/* Send to members */}
          <div className="px-4 py-3">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[17px] font-bold text-gray-900">
                Send to Members
              </h3>
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={handleSendToSelected}
                  disabled={sending}
                  className="text-sm font-semibold disabled:opacity-50"
                  style={{ color: FB_BLUE }}
                >
                  {sending ? "Sending..." : `Send (${selected.length})`}
                </button>
              )}
            </div>

            <div className="relative flex items-center">
              <div
                ref={membersScrollRef}
                className="flex flex-1 gap-2 overflow-x-auto scrollbar-hide py-1 "
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {members.length === 0 ? (
                  <p className="py-2 text-sm text-gray-500">No members found.</p>
                ) : (
                  members.map((m) => (
                    <MemberAvatar
                      key={m.id}
                      name={m.name}
                      avatarUrl={m.avatar_url}
                      selected={selected.includes(m.id)}
                      onClick={() => handleSelect(m.id)}
                    />
                  ))
                )}
              </div>
              {memberScrollState.canScrollLeft && (
                <button
                  type="button"
                  onClick={() => scrollMembers("left")}
                  className="absolute top-3 left-0 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm transition-colors hover:bg-gray-50"
                  aria-label="Scroll members left"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-700" />
                </button>
              )}
              {memberScrollState.canScrollRight && (
                <button
                  type="button"
                  onClick={() => scrollMembers("right")}
                  className="absolute top-3 right-0 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm transition-colors hover:bg-gray-50"
                  aria-label="Scroll members right"
                >
                  <ChevronRight className="h-5 w-5 text-gray-700" />
                </button>
              )}
            </div>
          </div>

          <div className="border-t border-gray-200" />

          {/* Share to */}
          <div className="px-4 py-4">
            <h3 className="mb-3 text-[17px] font-bold text-gray-900">Share to</h3>
            <div className="flex flex-wrap justify-between gap-y-4">
              {shareOptions.map((option) => (
                <button
                  key={option.name}
                  type="button"
                  onClick={option.action}
                  className="flex w-[72px] flex-col items-center gap-1.5 focus:outline-none"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 transition-colors hover:bg-gray-300">
                    {option.name === "Copy Link" && copied ? (
                      <span className="text-xs font-semibold text-gray-700">
                        ✓
                      </span>
                    ) : (
                      option.icon
                    )}
                  </div>
                  <span className="text-center text-xs text-gray-800">
                    {option.name === "Copy Link" && copied ? "Copied!" : option.name}
                  </span>
                </button>
              ))}
            </div>

            
         <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleShareNow}
                disabled={sharingNow}
                className="rounded-md bg-[var(--african-orange)] px-4 py-1.5 text-[15px] font-semibold text-white transition-opacity hover:bg-[var(--african-orange-dark)] disabled:opacity-60"
              >
                {sharingNow ? "Sharing..." : "Share now"}
              </button>
            </div>
          </div>
          
        </div>

      </div>
    </Portal>
  );
};

export default ShareModal;
