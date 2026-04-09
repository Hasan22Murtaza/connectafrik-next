import { Search, X } from 'lucide-react';
import React from 'react';

function isInThisMeeting(
  person: { full_name?: string; username?: string },
  sdkParticipants: any[],
): boolean {
  const fn = (person.full_name || '').trim().toLowerCase();
  const un = (person.username || '').trim().toLowerCase();
  return sdkParticipants.some((p: any) => {
    const dn = String(p?.displayName || '').trim().toLowerCase();
    if (!dn) return false;
    if (fn && dn === fn) return true;
    if (un && dn === un) return true;
    return false;
  });
}

interface AddPeoplePanelProps {
  addPeopleSearch: string;
  addPeopleResults: any[];
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
  participants,
  inCallUserIds,
  busyByUserId,
  invitingUserId,
  onSearchChange,
  onClose,
  onInvite,
}) => {
  return (
    <div className="absolute top-0 right-0 w-full sm:w-80 h-full bg-gray-900/95 backdrop-blur-md z-50 flex flex-col border-l border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <h3 className="text-sm font-semibold text-white">Add People</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white p-1 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search Input */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name..."
            value={addPeopleSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
            autoFocus
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
        {addPeopleSearch.length < 2 ? (
          <p className="text-xs text-gray-500 text-center mt-4">Type at least 2 characters to search</p>
        ) : addPeopleResults.length === 0 ? (
          <p className="text-xs text-gray-500 text-center mt-4">No users found</p>
        ) : (
          addPeopleResults.map((person: any) => {
            const inThisMeeting =
              (person.id && inCallUserIds.includes(person.id)) ||
              isInThisMeeting(person, participants);
            const onAnotherCall = Boolean(busyByUserId[person.id]) && !inThisMeeting;
            const cannotInvite = inThisMeeting || onAnotherCall || invitingUserId === person.id;
            return (
              <button
                key={person.id}
                onClick={() => !cannotInvite && onInvite(person)}
                disabled={cannotInvite}
                className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left ${
                  cannotInvite && invitingUserId !== person.id
                    ? 'opacity-50 cursor-not-allowed'
                    : invitingUserId === person.id
                    ? 'bg-primary-500/20'
                    : 'hover:bg-white/10'
                }`}
              >
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
                  {person.username && <p className="text-xs text-gray-400 truncate">@{person.username}</p>}
                </div>
                {inThisMeeting ? (
                  <span className="text-[10px] text-green-400 font-medium shrink-0">In this call</span>
                ) : onAnotherCall ? (
                  <span className="text-[10px] text-amber-400 font-medium text-right shrink-0 max-w-[100px] sm:max-w-none leading-tight">
                    On another call
                  </span>
                ) : invitingUserId === person.id ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-400 border-t-transparent" />
                ) : (
                  <span className="text-xs bg-orange-500 text-white px-3 py-1 rounded-full font-medium">Invite</span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AddPeoplePanel;
