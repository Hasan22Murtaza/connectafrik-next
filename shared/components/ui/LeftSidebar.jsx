import Link from "next/link";
import { usePathname } from "next/navigation";
import { BsShop } from "react-icons/bs";
import {
  FaRegUser
} from "react-icons/fa";
import { FiVideo } from "react-icons/fi";
import { IoBookmarkOutline } from "react-icons/io5";
import { MdOutlineGroups2 } from "react-icons/md";
import { RiHandbagLine } from "react-icons/ri";





const shortcuts = [
  { name: "Friends", to: "/friends", icon: FaRegUser },
  { name: "Groups", to: "/groups", icon: MdOutlineGroups2 },
  { name: "Marketplace", to: "/marketplace", icon: BsShop },
  { name: "My Orders", to: "/my-orders", icon: RiHandbagLine },
  { name: "Saved", to: "/saved", icon: IoBookmarkOutline },
  { name: "Video", to: "/video", icon: FiVideo },
];

const LeftSidebar = () => {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:block shrink-0 h-full overflow-y-auto py-6 px-4 w-64 xl:w-70 2xl:w-[20rem]">
      <h2 className="text-md font-semibold text-gray-600 uppercase tracking-wide mb-3 px-2">
  Your Space
</h2>
      <ul className="space-y-4">
        {shortcuts.map((item) => {
          const isActive = pathname === item.to;
          const Icon = item.icon;

          return (
            <li key={item.name}>
              <Link
                href={item.to}
                className={`group relative flex items-center space-x-3 px-3 py-2 rounded-md 
                transition-all duration-300 ease-in-out
                ${
                  isActive
                    ? "bg-orange-50 text-[#FF6900]"
                    : "text-gray-500 hover:bg-gray-100 hover:text-[#FF6900]"
                } 
                hover:translate-x-1`}
              >
                {/* LEFT ANIMATED LINE */}
                <span
                  className={`absolute left-0 top-0 h-full w-[3px] rounded-r 
                  transition-all duration-300 ease-in-out
                  ${
                    isActive
                      ? "bg-[#FF6900] opacity-100 scale-y-100"
                      : "bg-[#FF6900] opacity-0 scale-y-0 group-hover:opacity-100 group-hover:scale-y-100"
                  }`}
                ></span>

                {/* ICON */}
                <Icon
                  className={`text-lg transition-all duration-300 
                  group-hover:scale-110 
                  ${isActive ? "scale-110" : ""}`}
                />

                {/* TEXT */}
                <span className="font-medium transition-all duration-300 group-hover:translate-x-1">
                  {item.name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
};

export default LeftSidebar;