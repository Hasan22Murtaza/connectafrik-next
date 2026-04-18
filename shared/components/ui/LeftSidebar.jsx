import Link from "next/link";
import { usePathname } from "next/navigation";
import { BsShop } from "react-icons/bs";
import {
  FaRegUser
} from "react-icons/fa";
import { FiBookmark, FiVideo } from "react-icons/fi";
import { HiOutlineUserGroup } from "react-icons/hi";
import { RiHandbagLine } from "react-icons/ri";
import friend from "@/public/assets/icons/friend.png";
import group from "@/public/assets/icons/groups.png";
import marketplace from "@/public/assets/icons/market.png";
import orders from "@/public/assets/icons/my-order.png";
import saved from "@/public/assets/icons/bookmark.png";
import video from "@/public/assets/icons/video.png";
import Image from "next/image";



const shortcuts = [
  { name: "Friends", to: "/friends", icon: friend },
  { name: "Groups", to: "/groups", icon: group },
  { name: "Marketplace", to: "/marketplace", icon: marketplace },
  { name: "My Orders", to: "/my-orders", icon: orders },
  { name: "Saved", to: "/saved", icon: saved },
  { name: "Video", to: "/video", icon: video },
];

const LeftSidebar = () => {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:block shrink-0 h-full overflow-y-auto py-6  w-65 xl:w-80 2xl:w-[24rem]">
      <h2 className="text-md font-semibold text-gray-600 uppercase tracking-wide mb-3 px-2">
  Your Space
</h2>
     <ul className="space-y-3">
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
              ? "bg-primary-100 text-primary-600"
              : "text-gray-500 hover:bg-gray-200"
          } 
         `}
        >
          {/* ICON */}
          <Image src={Icon} alt={`${item.name} icon`} width={30} height={30} />

          {/* TEXT */}
          <span className="font-medium ">
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