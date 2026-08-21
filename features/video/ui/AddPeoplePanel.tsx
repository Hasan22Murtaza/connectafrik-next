import { Search, X } from '@/shared/icons';
import React from 'react';
import type { CallInvitation } from '@/shared/types/callInvite';

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

export interface AddPeoplePerson {
  id: string;
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  status?: string | null;
}

interface AddPeoplePanelProps {
  addPeopleSearch: string;
  addPeopleResults: AddPeoplePerson[];
  participants: any[];
  inCallUserIds: string[];
  busyByUserId: Record<string, boolean>;
  invitingUserId: string | null;
  cancellingUserId?: string | null;
  invitations?: CallInvitation[];
  selectedIds?: Set<string>;
  friendsLoading?: boolean;
  onSearchChange: (value: string) => void;
  onClose: () => void;
  onInvite: (person: AddPeoplePerson) => void;
  onInviteSelected?: () => void;
  onToggleSelected?: (userId: string) => void;
  onCancelInvite?: (invitation: CallInvitation) => void;
}

function statusLabel(invitation?: CallInvitation): string | null {
  if (!invitation) return null;
  if (invitation.status === 'pending') return 'Invited';
  if (invitation.status === 'accepted') return 'Joined';
  if (invitation.status === 'declined') return 'Declined';
  if (invitation.status === 'cancelled') return 'Cancelled';
  if (invitation.status === 'expired') return 'No answer';
  return null;
}

const AddPeoplePanel: React.FC<AddPeoplePanelProps> = ({
  addPeopleSearch,
  addPeopleResults,
  participants,
  inCallUserIds,
  busyByUserId,
  invitingUserId,
  cancellingUserId,
  invitations = [],
  selectedIds = new Set(),
  friendsLoading = false,
  onSearchChange,
  onClose,
  onInvite,
  onInviteSelected,
  onToggleSelected,
  onCancelInvite,
}) => {
  const pendingInvites = invitations.filter((inv) => inv.status === 'pending');
  const selectedCount = selectedIds.size;

  return (
    <div className="absolute top-0 right-0 w-full sm:w-80 h-full bg-gray-900/95 backdrop-blur-md z-50 flex flex-col border-l border-white/10">
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <h3 className="text-sm font-semibold text-white">Add People</h3>
        <button
          onClick={onClose}
          className="text-content-tertiary hover:text-white p-1 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary" />
          <input
            type="text"
            placeholder="Search friends..."
            value={addPeopleSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
            autoFocus
          />
        </div>
      </div>

      {pendingInvites.length > 0 && (
        <div className="px-3 pb-2 border-b border-white/10">
          <p className="text-[10px] uppercase tracking-wide text-content-tertiary mb-1.5">Invited</p>
          <div className="space-y-1">
            {pendingInvites.map((inv) => (
              <div key={inv.session_id} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                {inv.avatar_url ? (
                  <img src={inv.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
                    <span className="text-xs font-bold text-white">
                      {(inv.full_name || inv.username || 'U')[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{inv.full_name || inv.username}</p>
                  <p className="text-[10px] text-amber-300">Ringing…</p>
                </div>
                {onCancelInvite && (
                  <button
                    type="button"
                    onClick={() => onCancelInvite(inv)}
                    disabled={cancellingUserId === inv.user_id}
                    className="text-[10px] text-red-300 hover:text-red-200 font-medium shrink-0 disabled:opacity-50"
                  >
                    {cancellingUserId === inv.user_id ? 'Cancelling…' : 'Cancel'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
        {friendsLoading && addPeopleResults.length === 0 ? (
          <p className="text-xs text-content-secondary text-center mt-4">Loading friends…</p>
        ) : addPeopleResults.length === 0 ? (
          <p className="text-xs text-content-secondary text-center mt-4">
            {addPeopleSearch.trim() ? 'No friends found' : 'No friends to invite'}
          </p>
        ) : (
          addPeopleResults.map((person) => {
            const inThisMeeting = isUserInThisMeetingById(person.id, participants, inCallUserIds);
            const invitation = invitations.find((inv) => inv.user_id === person.id);
            const pending = invitation?.status === 'pending';
            const onAnotherCall =
              Boolean(person.id && busyByUserId[String(person.id)]) && !inThisMeeting && !pending;
            const offline = person.status && person.status !== 'online' && !inThisMeeting;
            const cannotInvite =
              inThisMeeting || onAnotherCall || pending || invitingUserId === person.id;
            const selected = selectedIds.has(person.id);
            const inviteStatus = statusLabel(invitation);
            return (
              <div
                key={person.id}
                className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                  cannotInvite && invitingUserId !== person.id
                    ? 'opacity-50'
                    : invitingUserId === person.id
                    ? 'bg-primary-500/20'
                    : selected
                    ? 'bg-primary-500/15'
                    : 'hover:bg-surface/10'
                }`}
              >
                {onToggleSelected && !cannotInvite ? (
                  <button
                    type="button"
                    onClick={() => onToggleSelected(person.id)}
                    className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
                      selected ? 'bg-orange-500 border-orange-500' : 'border-gray-500'
                    }`}
                    aria-label={selected ? 'Deselect' : 'Select'}
                  >
                    {selected && <span className="text-[10px] text-white leading-none">✓</span>}
                  </button>
                ) : null}
                {person.avatar_url ? (
                  <img src={person.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
                    <span className="text-xs font-bold text-white">
                      {(person.full_name || person.username || 'U')[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{person.full_name || person.username}</p>
                  {person.username && <p className="text-xs text-content-tertiary truncate">@{person.username}</p>}
                  {offline && !onAnotherCall && !inThisMeeting && (
                    <p className="text-[10px] text-content-tertiary">Offline</p>
                  )}
                </div>
                {inThisMeeting ? (
                  <span className="text-[10px] text-green-400 font-medium shrink-0">In this call</span>
                ) : onAnotherCall ? (
                  <span className="text-[10px] text-amber-400 font-medium text-right shrink-0 max-w-[100px] sm:max-w-none leading-tight">
                    On another call
                  </span>
                ) : pending ? (
                  <span className="text-[10px] text-amber-300 font-medium shrink-0">Invited</span>
                ) : invitingUserId === person.id ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-400 border-t-transparent" />
                ) : inviteStatus && invitation?.status !== 'pending' ? (
                  <button
                    type="button"
                    onClick={() => onInvite(person)}
                    className="text-xs bg-orange-500 text-white px-3 py-1 rounded-full font-medium"
                  >
                    Invite again
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onInvite(person)}
                    className="text-xs bg-orange-500 text-white px-3 py-1 rounded-full font-medium"
                  >
                    Invite
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {onInviteSelected && selectedCount > 0 && (
        <div className="p-3 border-t border-white/10">
          <button
            type="button"
            onClick={onInviteSelected}
            disabled={Boolean(invitingUserId)}
            className="w-full py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {invitingUserId ? 'Inviting…' : `Invite ${selectedCount}`}
          </button>
        </div>
      )}
    </div>
  );
};

export default AddPeoplePanel;
