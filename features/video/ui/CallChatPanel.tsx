'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { X } from '@/shared/icons';
import {
  chatUserIdsEqual,
  getChatMessageAuthorId,
  supabaseMessagingService,
  type ChatMessage,
  type ChatParticipant,
} from '@/features/chat/services/supabaseMessagingService';
import { stripMarkdown } from '@/features/chat/richtext';
import CallChatInput from './CallChatInput';

const HIDDEN_MESSAGE_TYPES = new Set([
  'initiated',
  'ringing',
  'active',
  'ended',
  'failed',
  'call_notification',
  'hand_raised',
  'reaction',
  'screen_share_started',
  'screen_share_stopped',
]);

interface CallChatPanelProps {
  threadId?: string;
  currentUserId?: string;
  currentUserName?: string;
  messageText: string;
  onMessageChange: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
}

function isVisibleChatMessage(message: ChatMessage, currentUserId?: string): boolean {
  if (HIDDEN_MESSAGE_TYPES.has((message.message_type || '').toLowerCase())) return false;
  if (message.is_deleted && currentUserId && message.deleted_for?.includes(currentUserId)) {
    return false;
  }
  return true;
}

const CallChatPanel: React.FC<CallChatPanelProps> = ({
  threadId,
  currentUserId,
  currentUserName,
  messageText,
  onMessageChange,
  onSend,
  onClose,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const currentUser: ChatParticipant | null = currentUserId
    ? { id: currentUserId, name: currentUserName || 'You' }
    : null;

  useEffect(() => {
    if (!threadId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void supabaseMessagingService
      .getThreadMessages(threadId, { limit: 40 })
      .then(({ messages: list }) => {
        if (cancelled) return;
        const sorted = [...list].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
        setMessages(sorted);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const unsubscribe = supabaseMessagingService.subscribeToThread(
      threadId,
      (incoming) => {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === incoming.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...incoming };
            return next;
          }
          return [...prev, incoming].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
          );
        });
      },
      currentUser,
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
    // currentUser is derived from ids; listing it would resubscribe every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, currentUserId]);

  const visible = useMemo(
    () => messages.filter((m) => isVisibleChatMessage(m, currentUserId)),
    [messages, currentUserId],
  );

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [visible.length, loading]);

  return (
    <aside
      className="z-40 flex h-[min(58vh,28rem)] w-full flex-col border-t border-border bg-surface shadow-2xl sm:h-screen sm:w-[360px] sm:border-l sm:border-t-0 max-sm:absolute max-sm:inset-x-0 max-sm:bottom-0 max-sm:rounded-t-2xl"
      aria-label="Meeting chat"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
        <div>
          <h2 className="text-sm font-semibold text-content">Chat</h2>
          <p className="text-[11px] text-content-secondary">Visible to everyone in this thread</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-content-secondary transition hover:bg-surface-hover hover:text-content"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {!threadId ? (
          <p className="px-2 py-8 text-center text-xs text-content-secondary">
            Chat is unavailable for this call.
          </p>
        ) : loading && visible.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-content-secondary">Loading messages…</p>
        ) : visible.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-content-secondary">
            No messages yet. Say hello to everyone on the call.
          </p>
        ) : (
          <ul className="space-y-3">
            {visible.map((message) => {
              const own = chatUserIdsEqual(getChatMessageAuthorId(message), currentUserId);
              const name = own ? 'You' : message.sender?.name || 'Participant';
              const body = message.is_deleted
                ? 'This message was deleted'
                : stripMarkdown(message.content || '').trim() ||
                  (message.attachments?.length ? 'Attachment' : '');
              return (
                <li
                  key={message.id}
                  className={`flex flex-col ${own ? 'items-end' : 'items-start'}`}
                >
                  <div className="mb-0.5 flex max-w-[92%] items-baseline gap-1.5 px-0.5">
                    <span className="truncate text-[11px] font-semibold text-content">{name}</span>
                    <span className="shrink-0 text-[10px] tabular-nums text-content-tertiary">
                      {format(new Date(message.created_at), 'HH:mm')}
                    </span>
                  </div>
                  <div
                    className={`max-w-[92%] rounded-2xl px-3 py-2 text-[13px] leading-snug shadow-sm ${
                      own
                        ? 'chat-bubble-own text-content'
                        : 'chat-bubble-in text-content ring-1 ring-black/[0.04]'
                    } ${message.is_deleted ? 'italic text-content-tertiary' : ''}`}
                  >
                    {body || 'Message'}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-border p-2.5">
        <CallChatInput
          messageText={messageText}
          onMessageChange={onMessageChange}
          onSend={onSend}
          disabled={!threadId}
        />
      </div>
    </aside>
  );
};

export default CallChatPanel;
