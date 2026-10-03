"use client";

import React from "react";
import { FiUserPlus, FiUsers } from "react-icons/fi";
import { IoHomeOutline } from "react-icons/io5";
import { LuCake, LuUserCheck } from "react-icons/lu";

export type FriendsSection = "home" | "requests" | "suggestions" | "all" | "birthdays";

interface FriendsSidebarProps {
  activeSection: FriendsSection;
  requestCount?: number;
  onSectionSelect: (section: FriendsSection) => void;
}

const menu: {
  key: FriendsSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "home", label: "Home", icon: IoHomeOutline },
  { key: "requests", label: "Friend Requests", icon: FiUserPlus },
  { key: "suggestions", label: "Suggestions", icon: LuUserCheck },
  { key: "all", label: "All friends", icon: FiUsers },
  { key: "birthdays", label: "Birthdays", icon: LuCake },
];

const FriendsSidebar: React.FC<FriendsSidebarProps> = ({
  activeSection,
  requestCount = 0,
  onSectionSelect,
}) => (
  <aside className="w-full shrink-0 md:w-64">
    <div className="py-4">
      <h2 className="mb-6 text-xl font-semibold text-content">Friends</h2>
      <nav className="space-y-2" aria-label="Friends navigation">
        {menu.map(({ key, label, icon: Icon }) => {
          const isActive = activeSection === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSectionSelect(key)}
              aria-current={isActive ? "page" : undefined}
              className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors duration-200 ${
                isActive
                  ? "bg-orange-50 text-primary-600 dark:bg-orange-500/15 dark:text-orange-300"
                  : "text-content-secondary hover:bg-gray-50 hover:text-gray-700 dark:hover:bg-surface-hover dark:hover:text-content"
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon
                  className={`text-md transition-colors ${
                    isActive
                      ? "text-primary-600 dark:text-orange-300"
                      : "text-content-secondary group-hover:text-gray-600 dark:group-hover:text-content"
                  }`}
                />
                <span>{label}</span>
              </span>
              {key === "requests" && requestCount > 0 && (
                <span className="rounded-full bg-primary-600 px-2 py-0.5 text-xs text-white">
                  {requestCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  </aside>
);

export default FriendsSidebar;
