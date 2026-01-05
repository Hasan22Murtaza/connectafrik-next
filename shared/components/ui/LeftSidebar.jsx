import React from "react";
import Link from "next/link";

const shortcuts = [
  { name: "Friends", to: "/friends", path: "/assets/icons/friend.png" },
  { name: "Groups", to: "/groups", path: "/assets/icons/groups.png" },
  { name: "Marketplace", to: "/marketplace", path: "/assets/icons/market.png" },
  { name: "My Orders", to: "/my-orders", path: "/assets/icons/my-order.png" },
  { name: "Memories", to: "/memories", path: "/assets/icons/memories.png" },
  { name: "Saved", to: "/saved", path: "/assets/icons/bookmark.png" },
  { name: "Video", to: "/video", path: "/assets/icons/video.png" },
];

const getStatusColor = (status) => {
  switch (status) {
    case "online":
      return "bg-green-500";
    case "away":
      return "bg-yellow-500";
    case "busy":
      return "bg-red-500";
    default:
      return "bg-gray-400";
  }
};

const LeftSidebar = ({ onlineContacts = [] }) => (
  <aside className="w-80 flex-shrink-0 hidden lg:block h-full overflow-y-auto py-6 px-4 scrollbar-hover">
    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-4">Online Contacts</h2>
      <ul className="space-y-2">
        {onlineContacts && onlineContacts.length > 0 ? (
          onlineContacts.map((user) => {
            const displayName =
              user?.full_name || user?.name || "Community member";
            const avatar = user?.avatar_url || user?.avatarUrl || null;
            const status =
              user?.status || (user?.lastSeen ? "away" : "offline");
            const statusColor = getStatusColor(status);

            return (
              <li
                key={user.id || displayName}
                className="flex items-center space-x-3"
              >
                <div className="relative">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={displayName}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Status Dot */}
                  <span
                    className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${statusColor}`}
                  />
                </div>

                <span className="font-medium text-gray-800">{displayName}</span>
              </li>
            );
          })
        ) : (
          <li className="text-gray-400">No contacts online</li>
        )}
      </ul>
    </div>
    <div>
      <h2 className="text-lg font-semibold mb-4">Shortcuts</h2>
      <ul className="space-y-4">
        {shortcuts.map((item) => (
          <li key={item.name}>
            <Link
              href={item.to}
              className="flex items-center space-x-3 text-gray-700 hover:bg-gray-100 rounded px-2 py-1"
            >
              <img src={item.path} alt="" className="w-8" />
              <span>{item.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  </aside>
);

export default LeftSidebar;
