import React, { useState, useEffect } from 'react';
import Portal from '@/shared/components/ui/Portal';
import { X, Share2, Facebook, Twitter, MessageCircle, Users, Copy } from 'lucide-react';

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
    name: 'WhatsApp',
  icon: <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.472-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.151-.174.2-.298.3-.497.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51-.173-.007-.372-.009-.571-.009-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.363.709.306 1.262.489 1.694.626.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 5.421h-.001a9.87 9.87 0 01-4.946-1.354l-.355-.211-3.682.964.985-3.588-.231-.368a9.86 9.86 0 01-1.51-5.19c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.991c-.003 5.451-4.437 9.885-9.888 9.885m8.413-18.297A11.815 11.815 0 0012.05.001C5.495 0 .001 5.493 0 12.047c0 2.124.557 4.199 1.613 6.032L.057 23.925a1.001 1.001 0 001.225 1.225l5.858-1.545a11.93 11.93 0 005.91 1.511h.005c6.554 0 11.947-5.492 11.949-12.043a11.89 11.89 0 00-3.489-8.462"/></svg>,
    url: (url: string) => `https://wa.me/?text=${encodeURIComponent(url)}`,
  },
  {
    name: 'Facebook',
    icon: <Facebook className="w-5 h-5 text-blue-600" />,
    url: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    name: 'Twitter',
    icon: <Twitter className="w-5 h-5 text-blue-400" />,
    url: (url: string) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`,
  },
  {
    name: 'SMS',
    icon: <MessageCircle className="w-5 h-5 text-gray-600" />,
    url: (url: string) => `sms:?body=${encodeURIComponent(url)}`,
  },
];

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, postUrl, postId, members, onSendToMembers }) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  // Lock background scroll when open
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      await onSendToMembers(selected, message);
      setSelected([]);
      setMessage('');
      onClose();
    } finally {
      setSending(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(postUrl);
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
          className="bg-white w-full max-w-md rounded-2xl shadow-2xl ring-1 ring-black/5 p-6 relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>

          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Share2 className="w-5 h-5" /> Share Post
          </h2>

          {/* Send to members */}
          <div className="mb-4">
            <div className="font-semibold mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" /> Send to Members
            </div>
            <div className="max-h-40 overflow-y-auto border rounded mb-2">
              {members.length === 0 ? (
                <div className="p-3 text-gray-500">No members found.</div>
              ) : (
                members.map(m => (
                  <label key={m.id} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.includes(m.id)}
                      onChange={() => handleSelect(m.id)}
                      className="mr-2"
                    />
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt={m.name} className="w-7 h-7 rounded-full mr-2 object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gray-200 mr-2 flex items-center justify-center text-xs font-bold text-gray-600">
                        {m.name.charAt(0)}
                      </div>
                    )}
                    <span>{m.name}</span>
                  </label>
                ))
              )}
            </div>

            <input
              type="text"
              className="w-full border rounded px-3 py-2 mb-2"
              placeholder="Add an optional message..."
              value={message}
              onChange={e => setMessage(e.target.value)}
            />

            <button
              className="w-full bg-primary-600 text-white py-2 rounded font-semibold hover:bg-primary-700 transition-colors disabled:opacity-60"
              disabled={selected.length === 0 || sending}
              onClick={handleSend}
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>

          {/* External share */}
          <div className="mb-2">
            <div className="font-semibold mb-2 flex items-center gap-2">
              <Share2 className="w-4 h-4" /> Share Externally
            </div>
            <div className="flex flex-wrap gap-3 mb-2">
              {socialPlatforms.map(platform => (
                <a
                  key={platform.name}
                  href={platform.url(postUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 border rounded hover:bg-gray-50 transition-colors"
                >
                  {platform.icon}
                  <span className="text-sm font-medium">{platform.name}</span>
                </a>
              ))}

              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-3 py-2 border rounded hover:bg-gray-50 transition-colors"
              >
                <Copy className="w-5 h-5 text-gray-500" />
                <span className="text-sm font-medium">{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default ShareModal;
