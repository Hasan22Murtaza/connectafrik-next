"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Compass, FileText, Plus, Users } from "@/shared/icons";
import type { Group } from "@/shared/types";

export type GroupsSidebarView = "feed" | "discover" | "my-groups" | "group-detail";

interface GroupsSidebarProps {
  view: GroupsSidebarView;
  onViewChange: (view: Exclude<GroupsSidebarView, "group-detail">) => void;
  isAuthenticated: boolean;
  managedGroups: Group[];
  joinedGroups: Group[];
  activeGroupId?: string;
}

const GroupsSidebar: React.FC<GroupsSidebarProps> = ({
  view,
  onViewChange,
  isAuthenticated,
  managedGroups,
  joinedGroups,
  activeGroupId,
}) => {
  const router = useRouter();
  const [showAllJoined, setShowAllJoined] = useState(false);
  const displayedJoinedGroups = showAllJoined ? joinedGroups : joinedGroups.slice(0, 5);

  const renderGroupButton = (group: Group) => {
    const isActive = activeGroupId === group.id;

    return (
      <button
        key={group.id}
        type="button"
        onClick={() => router.push(`/groups/${group.id}`)}
        aria-current={isActive ? "page" : undefined}
        className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors ${
          isActive
            ? "bg-orange-50 dark:bg-orange-500/15"
            : "hover:bg-surface-secondary dark:hover:bg-surface-hover"
        }`}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-african-green">
          {group.banner_url ? (
            <img
              src={group.banner_url}
              alt={group.name}
              className="h-full w-full rounded-lg object-cover"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-tertiary text-sm font-bold text-content">
              {group.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-content">{group.name}</p>
          <p className="text-xs text-content-secondary">
            Last active{" "}
            {formatDistanceToNow(new Date(group.updated_at || group.created_at), {
              addSuffix: true,
            })}
          </p>
        </div>
      </button>
    );
  };

  const navigationItems: {
    view: Exclude<GroupsSidebarView, "group-detail">;
    label: string;
    Icon: typeof FileText;
  }[] = [
    { view: "feed", label: "Your feed", Icon: FileText },
    { view: "discover", label: "Discover", Icon: Compass },
    { view: "my-groups", label: "Your groups", Icon: Users },
  ];

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-content">Groups</h2>
      </div>

      <nav className="space-y-2" aria-label="Groups navigation">
        {navigationItems.map(({ view: itemView, label, Icon }) =>
          itemView === "my-groups" && !isAuthenticated ? null : (
            <button
              key={itemView}
              type="button"
              onClick={() => onViewChange(itemView)}
              aria-current={view === itemView ? "page" : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-200 ${
                view === itemView
                  ? "bg-orange-50 text-primary-600 dark:bg-orange-500/15 dark:text-orange-300"
                  : "text-content-secondary hover:bg-gray-50 hover:text-gray-700 dark:hover:bg-surface-hover dark:hover:text-content"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium">{label}</span>
            </button>
          )
        )}
      </nav>

      {isAuthenticated && (
        <button
          type="button"
          onClick={() => router.push("/groups/create")}
          className="btn-primary flex w-full items-center justify-center gap-2"
        >
          <Plus className="h-5 w-5" />
          <span>Create new group</span>
        </button>
      )}

      {isAuthenticated && managedGroups.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-2 px-2 text-sm font-semibold text-content">Groups you manage</h3>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {managedGroups.map(renderGroupButton)}
          </div>
        </section>
      )}

      {isAuthenticated && joinedGroups.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between px-2">
            <h3 className="text-sm font-semibold text-content">Groups you&apos;ve joined</h3>
            {joinedGroups.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllJoined((show) => !show)}
                className="text-xs text-orange-600 hover:text-orange-700 hover:underline dark:text-orange-300 dark:hover:text-orange-200"
              >
                {showAllJoined ? "See less" : "See all"}
              </button>
            )}
          </div>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {displayedJoinedGroups.map(renderGroupButton)}
          </div>
        </section>
      )}
    </div>
  );
};

export default GroupsSidebar;
