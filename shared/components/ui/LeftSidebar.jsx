"use client";
import { useSpaceNavCounts } from "@/shared/hooks/useSpaceNavCounts";
import { useHeaderInboxCounts } from "@/shared/hooks/useHeaderInboxCounts";
import {
  Bookmark,
  MessageCircle,
  MessageSquareText,
  Phone,
  Settings,
  Landmark,
  Palette,
  Home,
  Video,
  Users,
  User,
  Store,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const shortcuts = [
  { name: "Feed", to: "/feed", icon: Home },
  { name: "Reels", to: "/reels", icon: Video },
  { name: "Friends", to: "/friends", icon: User },
  { name: "Groups", to: "/groups", icon: Users },
  { name: "Messages", to: "/chat", icon: MessageCircle, badgeKey: "chat" },
  { name: "Calls", to: "/calls", icon: Phone, badgeKey: "calls" },
  { name: "TradeHub", to: "/marketplace", icon: Store },
  { name: "Politics", to: "/politics", icon: Landmark },
  { name: "Culture", to: "/culture", icon: Palette },
  { name: "Saved", to: "/saved", icon: Bookmark },
  { name: "Feedback", to: "/feedback", icon: MessageSquareText },
  { name: "Settings", to: "/settings", icon: Settings },
];

function formatBadge(count) {
  if (count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

function isPathActive(pathname, to) {
  if (!to) return false;
  if (pathname === to) return true;
  if (to !== "/" && pathname.startsWith(`${to}/`)) return true;
  return false;
}

const LeftSidebar = () => {
  const pathname = usePathname();
  const { newOrderCount } = useSpaceNavCounts();
  const { unreadMessages, callBadgeCount } = useHeaderInboxCounts();

  const badgeFor = (badgeKey) => {
    if (badgeKey === "orders") return formatBadge(newOrderCount);
    if (badgeKey === "chat") return formatBadge(unreadMessages);
    if (badgeKey === "calls") return formatBadge(callBadgeCount);
    return null;
  };

  const itemClass = (isActive) =>
    `group relative flex w-full items-center space-x-2 px-3 py-1.5 rounded-lg 
          transition-all duration-300 ease-in-out
          ${
            isActive
              ? "bg-primary-100 text-primary-600"
              : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
          }`;

  return (
    <aside className="hidden lg:block shrink-0 h-full overflow-y-auto py-1   w-55 xl:w-60 2xl:w-[24rem] ">
      <ul className="space-y-1">
        {shortcuts.map((item) => {
          const isActive = isPathActive(pathname, item.to);
          const Icon = item.icon;
          const badge = badgeFor(item.badgeKey);

          return (
            <li key={item.name}>
              <Link href={item.to} className={itemClass(isActive)}>
                <Icon
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0"
                  strokeWidth={1.6}
                />
                <span className="font-medium flex-1">{item.name}</span>
                {badge && (
                  <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
};

export default LeftSidebar;
