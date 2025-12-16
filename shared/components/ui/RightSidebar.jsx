import React from 'react';
import OnlineContactsSection from '@/shared/components/ui/OnlineContactsSection';
import { PeopleYouMayKnow } from '@/features/social/components/PeopleYouMayKnow';
import ArtOfInksAd from '@/shared/components/ui/ArtOfInksAd';

const RightSidebar = ({ birthdays = [], contacts = [], ads = [], onlineContacts = [] }) => {

  return (
  <aside className="w-96 flex-shrink-0 hidden xl:block bg-white
   border-l border-gray-200 h-full overflow-y-auto py-6 px-4
   scrollbar-hover">
    {/* DataAfrik Promotion */}
    <div className="mb-8">
      <a
        href="https://www.dataafrik.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center space-x-3 rounded-lg border border-primary-100 bg-primary-50/40 p-3 transition-colors hover:bg-primary-50"
      >
        <img
          src="/assets/images/logo.png"
          alt="DataAfrik logo"
          className="h-10 w-10 rounded-full object-cover shadow-sm"
        />
        <div>
          <p className="font-semibold text-gray-900">Connect with DataAfrik</p>
          <p className="text-xs font-medium text-primary-700">www.dataafrik.com</p>
        </div>
      </a>
    </div>

    {/* Art of Ink Advertisement */}
    <div className="mb-8">
      <ArtOfInksAd type="sidebar" className="rounded-lg shadow-sm" />
    </div>

    {/* People You May Know - Friend Recommendations */}
    <div className="mb-8">
      <PeopleYouMayKnow />
    </div>

    {/* Friends/Contacts Section - Show friends with chat/call buttons */}
    {contacts && contacts.length > 0 && (
      <OnlineContactsSection
        contacts={contacts.map(c => ({
          id: c.id,
          name: c.full_name || c.name || 'Friend',
          avatarUrl: c.avatar_url || c.avatarUrl,
          status: c.status || 'online'
        }))}
        showAddFriendButton={false}
        title="Friends"
      />
    )}

    {/* Online Contacts - Legacy support - REMOVED to prevent duplicate People You May Know */}
    {/* 
    {onlineContacts && onlineContacts.length > 0 && (
      <OnlineContactsSection contacts={onlineContacts} showAddFriendButton={true} />
    )}
    */}

    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-4">Birthdays</h2>
      <ul className="space-y-2">
        {birthdays.length > 0 ? (
          birthdays.map((birthday) => {
            const displayName = birthday?.full_name || birthday?.name || 'Community member';
            return (
              <li key={birthday.id || displayName} className="flex items-center space-x-2">
                <span role="img" aria-label="birthday">🎂</span>
                <span className="font-medium text-gray-800">{displayName}</span>
              </li>
            );
          })
        ) : (
          <li className="text-gray-400">No birthdays today</li>
        )}
      </ul>
    </div>
    {ads && ads.length > 0 && (
      <div>
        <h2 className="text-lg font-semibold mb-4">Sponsored</h2>
        <ul className="space-y-4">
          {ads.map((ad) => (
            <li key={ad.id} className="bg-gray-100 rounded p-3">
              <a href={ad.url} target="_blank" rel="noopener noreferrer" className="block">
                <img src={ad.image} alt={ad.title} className="w-full h-24 object-cover rounded mb-2" />
                <div className="font-medium text-gray-700">{ad.title}</div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    )}
  </aside>
  );
};

export default RightSidebar;


