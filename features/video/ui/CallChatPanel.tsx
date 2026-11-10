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

/** Call signaling / system rows — never show these in the in-call chat drawer. */
const HIDDEN_MESSAGE_TYPES = new Set([
  'initiated',
  'ringing',
  'active',
  'ended',
  'failed',
  'declined',
  'missed',
  'accepted_on_another_device',
  'call_notification',
  'hand_raised',
  'reaction',
  'screen_share_started',
  'screen_share_stopped',
]);

const HIDDEN_CONTENT_PATTERNS = [
  /^accepted on another device$/i,
  /^call (started|ended|missed|declined)/i,
];

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
  const type = (message.message_type || '').toLowerCase();
  if (HIDDEN_MESSAGE_TYPES.has(type)) return false;
  if (type.startsWith('call_') || type.includes('signal')) return false;
  if (message.is_deleted && currentUserId && message.deleted_for?.includes(currentUserId)) {
    return false;
  }
  const body = stripMarkdown(message.content || '').trim();
  if (body && HIDDEN_CONTENT_PATTERNS.some((re) => re.test(body))) return false;
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
      .getThreadMessages(threadId, { limit: 60 })
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
    <aside className="call-chat-panel" aria-label="Meeting chat">
      <header className="call-chat-header">
        <div>
          <h2>Chat</h2>
          <span>Visible to everyone in this call</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close chat">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div ref={scrollerRef} className="call-chat-messages">
        {!threadId ? (
          <p className="call-chat-empty">Chat is unavailable for this call.</p>
        ) : loading && visible.length === 0 ? (
          <p className="call-chat-empty">Loading messages…</p>
        ) : visible.length === 0 ? (
          <p className="call-chat-empty">No messages yet. Say hello to everyone on the call.</p>
        ) : (
          <ul className="call-chat-list">
            {visible.map((message) => {
              const own = chatUserIdsEqual(getChatMessageAuthorId(message), currentUserId);
              const name = own ? 'You' : message.sender?.name || 'Participant';
              const body = message.is_deleted
                ? 'This message was deleted'
                : stripMarkdown(message.content || '').trim() ||
                  (message.attachments?.length ? 'Attachment' : '');
              return (
                <li key={message.id} className={`call-chat-row ${own ? 'is-own' : 'is-peer'}`}>
                  <div className="call-chat-meta">
                    <strong>{name}</strong>
                    <time dateTime={message.created_at}>
                      {format(new Date(message.created_at), 'HH:mm')}
                    </time>
                  </div>
                  <div
                    className={`call-chat-bubble ${own ? 'is-own' : 'is-peer'} ${
                      message.is_deleted ? 'is-deleted' : ''
                    }`}
                  >
                    {body || 'Message'}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="call-chat-composer" data-call-chat-composer>
        <CallChatInput
          messageText={messageText}
          onMessageChange={onMessageChange}
          onSend={onSend}
          disabled={!threadId}
        />
      </footer>
    </aside>
  );
};

export default CallChatPanel;
