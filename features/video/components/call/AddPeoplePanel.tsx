import { Search, X } from 'lucide-react';
import React from 'react';

interface AddPeoplePanelProps {
  addPeopleSearch: string;
  addPeopleResults: any[];
  participants: any[];
  invitingUserId: string | null;
  onSearchChange: (value: string) => void;
  onClose: () => void;
  onInvite: (person: any) => void;
}

const AddPeoplePanel: React.FC<AddPeoplePanelProps> = ({
  addPeopleSearch,
  addPeopleResults,
  participants,
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
            const isAlreadyInCall = participants.some((p: any) => p.displayName === person.full_name);
            return (
              <button
                key={person.id}
                onClick={() => !isAlreadyInCall && onInvite(person)}
                disabled={isAlreadyInCall || invitingUserId === person.id}
                className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left ${
                  isAlreadyInCall
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
                {isAlreadyInCall ? (
                  <span className="text-[10px] text-green-400 font-medium">In call</span>
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
