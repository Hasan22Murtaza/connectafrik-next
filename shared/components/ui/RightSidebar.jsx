import { PeopleYouMayKnow } from '@/features/social/components/PeopleYouMayKnow';
import ArtOfInksAd from '@/shared/components/ui/ArtOfInksAd';
import OnlineContactsSection from '@/shared/components/ui/OnlineContactsSection';

const RightSidebar = ({ birthdays = [], contacts = [], ads = [], onlineContacts = [] }) => {

  return (
    <aside className="w-65 xl:w-80 2xl:w-[24rem] shrink-0 h-full overflow-y-auto py-6 scrollbar-hover">
      {/* DataAfrik Promotion */}
      <div className="mb-8">
        <a
          href="https://www.dataafrik.com"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center space-x-3 rounded-2xl border border-border-subtle bg-primary-50/40 dark:bg-primary-50/10 p-3 transition-all duration-300 hover:bg-primary-100/60 dark:hover:bg-primary-50/20 shadow-inner"
        >
          <img
            src="/assets/images/logo.png"
            alt="DataAfrik logo"
            className="h-10 w-10 rounded-full object-cover shadow-sm"
          />

          <div>
            <p className="font-semibold text-primary-600 group-hover:text-primary-700 transition-colors">
              Connect with DataAfrik
            </p>
            <p className="text-xs font-medium text-primary-700 dark:text-primary-400">
              www.dataafrik.com
            </p>
          </div>
        </a>
      </div>

      <div className="h-px bg-border-subtle w-full my-4"></div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 text-content-secondary ps-1">Birthdays</h2>
        <ul className="space-y-2">
          {birthdays.length > 0 ? (
            birthdays.map((birthday) => {
              const displayName = birthday?.full_name || birthday?.name || 'Community member';
              return (
                <li key={birthday.id || displayName} className="flex items-center space-x-2">
                  <span role="img" aria-label="birthday">🎂</span>
                  <span className="font-medium text-content">{displayName}</span>
                </li>
              );
            })
          ) : (
            <li className="text-content-tertiary">No birthdays today</li>
          )}
        </ul>
      </div>
      <div className="h-px bg-border-subtle w-full my-4"></div>
      {/* Friends/Contacts Section */}
      {contacts && contacts.length > 0 && (
        <OnlineContactsSection
          contacts={contacts.map(c => ({
            id: c.id,
            name: c.full_name || c.name || 'Friend',
            avatarUrl: c.avatar_url || c.avatarUrl,
            status: c.status || 'online'
          }))}
          showAddFriendButton={false}
          title="Contacts"
        />
      )}

      <div className="h-px bg-border-subtle w-full my-4"></div>

      <div className="mb-8">
        <ArtOfInksAd type="sidebar" className="rounded-lg shadow-sm" />
      </div>
      {ads && ads.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 text-content-secondary">Sponsored</h2>
          <ul className="space-y-4">
            {ads.map((ad) => (
              <li key={ad.id} className="bg-surface-secondary rounded p-3">
                <a href={ad.url} target="_blank" rel="noopener noreferrer" className="block">
                  <img src={ad.image} alt={ad.title} className="w-full h-24 object-cover rounded mb-2" />
                  <div className="font-medium text-content">{ad.title}</div>
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
