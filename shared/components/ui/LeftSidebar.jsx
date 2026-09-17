"use client";
import saved from "@/public/assets/icons/bookmark.png";
import friend from "@/public/assets/icons/friend.png";
import group from "@/public/assets/icons/groups.png";
import marketplace from "@/public/assets/icons/market.png";
import orders from "@/public/assets/icons/my-order.png";
import { useSpaceNavCounts } from "@/shared/hooks/useSpaceNavCounts";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const shortcuts = [
  { name: "Friends", to: "/friends", icon: friend, badgeKey: "friends" },
  { name: "Groups", to: "/groups", icon: group },
  { name: "TradeHub", to: "/marketplace", icon: marketplace },
  { name: "My Orders", to: "/my-orders", icon: orders, badgeKey: "orders" },
  { name: "Saved", to: "/saved", icon: saved },
];

function formatBadge(count) {
  if (count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

const LeftSidebar = () => {
  const pathname = usePathname();
  const { friendRequestCount, newOrderCount } = useSpaceNavCounts();

  const badgeFor = (badgeKey) => {
    if (badgeKey === "friends") return formatBadge(friendRequestCount);
    if (badgeKey === "orders") return formatBadge(newOrderCount);
    return null;
  };

  return (
    <aside className="hidden lg:block shrink-0 h-full overflow-y-auto py-6  w-65 xl:w-80 2xl:w-[24rem]">
      <ul className="space-y-3">
        {shortcuts.map((item) => {
          const isActive = pathname === item.to;
          const Icon = item.icon;
          const badge = badgeFor(item.badgeKey);

          return (
            <li key={item.name}>
              <Link
                href={item.to}
                className={`group relative flex items-center space-x-3 px-3 py-2 rounded-lg 
          transition-all duration-300 ease-in-out
          ${
            isActive
              ? "bg-primary-100 text-primary-600"
              : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
          } 
         `}
              >
                <Image src={Icon} alt={`${item.name} icon`} width={30} height={30} />

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
