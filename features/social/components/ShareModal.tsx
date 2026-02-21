import React, { useState, useEffect } from "react";
import Portal from "@/shared/components/ui/Portal";
import {
  X,
  Share2,
  Facebook,
  Twitter,
  MessageCircle,
  Users,
  Copy,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  postUrl: string;
  postId: string;
  members: Array<{ id: string; name: string; avatar_url?: string }>;
  onSendToMembers: (memberIds: string[], message: string) => Promise<void>;
}

const socialPlatforms = [
  {
    name: "WhatsApp",
    color: "#25D366",
    icon: <FaWhatsapp className="w-5 h-5 text-white" />,
    url: (url: string) => `https://wa.me/?text=${encodeURIComponent(url)}`,
  },
  {
    name: "Facebook",
    color: "#1877F2",
    icon: <Facebook className="w-5 h-5 text-white" />,
    url: (url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    name: "Twitter",
    color: "#1DA1F2",
    icon: <Twitter className="w-5 h-5 text-white" />,
    url: (url: string) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`,
  },
  {
    name: "SMS",
    color: "#6B7280",
    icon: <MessageCircle className="w-5 h-5 text-white" />,
    url: (url: string) => `sms:?body=${encodeURIComponent(url)}`,
  },
];

const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  postUrl,
  postId,
  members,
  onSendToMembers,
}) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  // Ensure the share URL is always absolute
  const fullUrl = (() => {
    if (!postUrl) return "";
    if (/^https?:\/\//.test(postUrl)) return postUrl;
    const base =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || "";
    return `${base}${postUrl.startsWith("/") ? "" : "/"}${postUrl}`;
  })();

  // Lock background scroll when open
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSend = async () => {
    setSending(true);
    try {
      await onSendToMembers(selected, message);
      setSelected([]);
      setMessage("");
      onClose();
    } finally {
      setSending(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Portal>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Dialog */}
      <div
        className="fixed inset-0 z-[1001] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Share Post"
      >
        <div
          className="bg-white w-full max-w-md rounded-2xl shadow-2xl ring-1 ring-black/5  relative overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-primary-600 flex items-center justify-between py-4 px-6">
            <h2 className="text-xl font-bold  flex items-center gap-2 text-white">
              <Share2 className="w-5 h-5" /> Share Post
            </h2>
            <button
              onClick={onClose}
              className=" text-white hover:text-gray-300"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="p-6">
            {/* Send to members */}
            <div className="mb-4 ">
              <div className="font-semibold mb-2 flex items-center gap-2">
                <Users className="w-4 h-4" /> Send to Members
              </div>
              <div className="max-h-40 overflow-y-auto border rounded-lg border-gray-200">
                {members.length === 0 ? (
                  <div className="p-3 text-gray-500 text-sm">No members found.</div>
                ) : (
                  members.map((m) => (
                    <label
                      key={m.id}
                      className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(m.id)}
                        onChange={() => handleSelect(m.id)}
                        className="mr-2.5 accent-primary-600 w-4 h-4"
                      />
                      {m.avatar_url ? (
                        <img
                          src={m.avatar_url}
                          alt={m.name}
                          className="w-8 h-8 rounded-full mr-2.5 object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 mr-2.5 flex items-center justify-center text-xs font-bold text-gray-600">
                          {m.name.charAt(0)}
                        </div>
                      )}
                      <span className="text-sm text-gray-800">{m.name}</span>
                    </label>
                  ))
                )}
              </div>

              <div className="flex items-center gap-2 mt-3">
                <input
                  type="text"
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  placeholder="Add an optional message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <button
                  className="px-5 py-2 bg-primary-600 text-white rounded-lg font-semibold text-sm hover:bg-primary-700 active:bg-primary-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  disabled={selected.length === 0 || sending}
                  onClick={handleSend}
                >
                  {sending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>

            {/* External share */}
            <div className="mb-2">
              <div className="font-semibold mb-2 flex items-center gap-2">
                <Share2 className="w-4 h-4" /> Share Externally
              </div>
              <div className="flex flex-wrap gap-4 mb-2 justify-around">
                {socialPlatforms.map((platform) => (
                  <a
                    key={platform.name}
                    href={platform.url(fullUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1 group"
                  >
                    <div
                      className="w-12 h-12 flex items-center justify-center rounded-full text-white transition-transform duration-200 "
                      style={{ backgroundColor: platform.color }}
                    >
                      {platform.icon}
                    </div>
                    <span className="text-xs font-medium text-gray-700">
                      {platform.name}
                    </span>
                  </a>
                ))}

                {/* Copy Button */}
                <button
                  onClick={handleCopy}
                  className="flex flex-col items-center gap-1 group"
                >
                  <div className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-200 text-gray-700 transition-transform duration-200 group-hover:scale-110">
                    <Copy className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-gray-700">
                    {copied ? "Copied!" : "Copy"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default ShareModal;
