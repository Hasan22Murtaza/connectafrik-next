import React from "react";
import Link from "next/link";

const shortcuts = [
  { name: "Friends", to: "/friends", path: "/assets/icons/friend.png" },
  { name: "Groups", to: "/groups", path: "/assets/icons/groups.png" },
  { name: "Marketplace", to: "/marketplace", path: "/assets/icons/market.png" },
  { name: "My Orders", to: "/my-orders", path: "/assets/icons/my-order.png" },
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
