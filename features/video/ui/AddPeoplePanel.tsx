import { Search, X } from '@/shared/icons';
import React from 'react';

/** In-meeting detection uses ids only (VideoSDK `participantId` = app user id). */
function isUserInThisMeetingById(
  userId: string | undefined,
  sdkParticipants: any[],
  inCallUserIds: string[],
): boolean {
  if (userId == null || userId === '') return false;
  const uid = String(userId);
  if (inCallUserIds.some((id) => String(id) === uid)) return true;
  return sdkParticipants.some((p: any) => p?.id != null && String(p.id) === uid);
}

interface AddPeoplePanelProps {
  addPeopleSearch: string;
  addPeopleResults: any[];
  /** True while the friends list is loading. */
  loading?: boolean;
  participants: any[];
  /**
   * VideoSDK participant ids when `MeetingProvider` uses `participantId` = app user id
   * (matches `call_sessions.participants` UUIDs).
   */
  inCallUserIds: string[];
  /** From call_sessions: user is active in a different call (not this call_id). */
  busyByUserId: Record<string, boolean>;
  invitingUserId: string | null;
  onSearchChange: (value: string) => void;
  onClose: () => void;
  onInvite: (person: any) => void;
}

const AddPeoplePanel: React.FC<AddPeoplePanelProps> = ({
  addPeopleSearch,
  addPeopleResults,
  loading = false,
  participants,
  inCallUserIds,
  busyByUserId,
  invitingUserId,
  onSearchChange,
  onClose,
  onInvite,
}) => {
  const searchActive = addPeopleSearch.trim().length > 0;

  return (
    <aside
      className="z-50 flex h-full max-h-full min-h-0 w-full shrink-0 flex-col overflow-hidden border-l border-border bg-surface shadow-2xl sm:w-80 max-sm:absolute max-sm:inset-0"
      aria-label="Add people to call"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
        <h3 className="text-sm font-semibold text-content">Add People</h3>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-content-secondary transition hover:bg-surface-hover hover:text-content"
          aria-label="Close add people"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="shrink-0 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary" />
          <input
            type="text"
            placeholder="Search friends..."
            value={addPeopleSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-secondary py-2 pl-9 pr-3 text-sm text-content outline-none transition placeholder:text-content-tertiary focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            autoFocus
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-3">
        {loading ? (
          <p className="mt-4 text-center text-xs text-content-secondary">Loading friends...</p>
        ) : addPeopleResults.length === 0 ? (
          <p className="mt-4 text-center text-xs text-content-secondary">
            {searchActive ? 'No friends found' : 'No friends to add'}
          </p>
        ) : (
          <>
            {!searchActive && (
              <p className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-content-tertiary">
                Friends
              </p>
            )}
            {addPeopleResults.map((person: any) => {
              const inThisMeeting = isUserInThisMeetingById(person.id, participants, inCallUserIds);
              const onAnotherCall =
                Boolean(person.id && busyByUserId[String(person.id)]) && !inThisMeeting;
              const cannotInvite = inThisMeeting || onAnotherCall || invitingUserId === person.id;
              return (
                <button
                  key={person.id}
                  onClick={() => !cannotInvite && onInvite(person)}
                  disabled={cannotInvite}
                  className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors ${
                    cannotInvite && invitingUserId !== person.id
                      ? 'cursor-not-allowed opacity-50'
                      : invitingUserId === person.id
                      ? 'bg-primary/15'
                      : 'hover:bg-surface-hover'
                  }`}
                >
                  {person.avatar_url ? (
                    <img src={person.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                      <span className="text-xs font-bold text-content-inverse">
                        {(person.full_name || person.username || 'U')[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-content">
                      {person.full_name || person.username}
                    </p>
                    {person.username && (
                      <p className="truncate text-xs text-content-tertiary">@{person.username}</p>
                    )}
                  </div>
                  {inThisMeeting ? (
                    <span className="shrink-0 text-[10px] font-medium text-[var(--african-green)]">
                      In this call
                    </span>
                  ) : onAnotherCall ? (
                    <span className="max-w-[100px] shrink-0 text-right text-[10px] font-medium leading-tight text-primary sm:max-w-none">
                      On another call
                    </span>
                  ) : invitingUserId === person.id ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : (
                    <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-content-inverse">
                      Invite
                    </span>
                  )}
                </button>
              );
            })}
          </>
        )}
      </div>
    </aside>
  );
};

export default AddPeoplePanel;
