"use client";

import { useAuth } from "@/contexts/AuthContext";
import GroupCard from "@/features/groups/components/GroupCard";
import GroupPostCard from "@/features/groups/components/GroupPostCard";
import { useGroups } from "@/shared/hooks/useGroups";
import { Group } from "@/shared/types";
import {
  BookOpen,
  Compass,
  Plus,
  Search,
  Users,
  Settings,
  FileText,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

const GroupsPage: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();
  const {
    groups,
    loading,
    fetchGroups,
    fetchMyGroups,
    fetchManagedGroups,
    fetchRecentActivity,
  } = useGroups();
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState<"feed" | "discover" | "my-groups">("feed");
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  const [managedGroups, setManagedGroups] = useState<Group[]>([]);
  const [joinedGroups, setJoinedGroups] = useState<Group[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [showAllJoined, setShowAllJoined] = useState(false);

  // Fetch managed and joined groups separately
  useEffect(() => {
    if (user) {
      const loadGroups = async () => {
        await fetchMyGroups();
        const managed = await fetchManagedGroups();
        setManagedGroups(managed);
      };
      loadGroups();
    }
  }, [user]);

  // Separate joined groups from managed groups
  useEffect(() => {
    if (groups.length > 0 && user) {
      const joined = groups.filter(
        (g: Group) =>
          g.membership &&
          g.membership.status === "active" &&
          !managedGroups.some((mg) => mg.id === g.id),
      );
      setJoinedGroups(joined);
    }
  }, [groups, managedGroups, user]);

  // Fetch recent activity
  useEffect(() => {
    if (user && view === "feed") {
      const loadActivity = async () => {
        setActivityLoading(true);
        const activity = await fetchRecentActivity(20);
        setRecentActivity(activity);
        setActivityLoading(false);
      };
      loadActivity();
    }
  }, [user, view]);

  // Filter groups based on search
  useEffect(() => {
    let filtered = groups;

    if (searchTerm) {
      const lowercaseSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (group) =>
          group.name.toLowerCase().includes(lowercaseSearch) ||
          group.description.toLowerCase().includes(lowercaseSearch) ||
          group.tags.some((tag) =>
            tag.toLowerCase().includes(lowercaseSearch),
          ) ||
          group.goals.some((goal) =>
            goal.toLowerCase().includes(lowercaseSearch),
          ),
      );
    }

    setFilteredGroups(filtered);
  }, [groups, searchTerm]);

  const handleViewChange = (newView: "feed" | "discover" | "my-groups") => {
    setView(newView);
    if (newView === "my-groups") {
      fetchMyGroups();
    } else if (newView === "discover") {
      fetchGroups();
    }
  };

  const handleSearch = () => {
    fetchGroups({
      search: searchTerm,
      limit: 50,
    });
  };

  const handleJoinGroup = async (groupId: string) => {
    if (view === "my-groups") {
      await fetchMyGroups();
    } else {
      await fetchGroups({
        search: searchTerm,
        limit: 50,
      });
    }
    // Reload managed groups
    if (user) {
      const managed = await fetchManagedGroups();
      setManagedGroups(managed);
    }
  };

  const handleViewGroup = (groupId: string) => {
    router.push(`/groups/${groupId}`);
  };

  const displayedJoinedGroups = showAllJoined
    ? joinedGroups
    : joinedGroups.slice(0, 5);

  const handlePostLike = async (postId: string) => {
    if (!user) {
      toast.error("You must be logged in to like posts");
      return;
    }

    try {
      const post = recentActivity.find((p: any) => p.id === postId);
      if (!post) return;

      // Check if already liked
      const { data: existingLike } = await supabase
        .from("likes")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .single();

      if (existingLike) {
        // Unlike
        await supabase.from("likes").delete().eq("id", existingLike.id);

        setRecentActivity((prev: any[]) =>
          prev.map((p: any) =>
            p.id === postId
              ? {
                  ...p,
                  likes_count: Math.max(0, p.likes_count - 1),
                  isLiked: false,
                }
              : p,
          ),
        );
      } else {
        // Like
        await supabase
          .from("likes")
          .insert([{ post_id: postId, user_id: user.id }]);

        setRecentActivity((prev: any[]) =>
          prev.map((p: any) =>
            p.id === postId
              ? { ...p, likes_count: p.likes_count + 1, isLiked: true }
              : p,
          ),
        );
      }
    } catch (err: any) {
      console.error("Error toggling like:", err);
      toast.error("Failed to update like");
    }
  };

  const handlePostComment = (postId: string) => {
    // Navigate to group post detail or open comment modal
    const post = recentActivity.find((p: any) => p.id === postId);
    if (post) {
      router.push(`/groups/${post.group_id}?post=${postId}`);
    }
  };

  const handlePostShare = (postId: string) => {
    // Implement share functionality
    toast.success("Share functionality coming soon!");
  };

  // Sidebar content component
  const SidebarContent = () => (
    <div className="space-y-4">
      {/* Groups Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Groups</h2>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <Settings className="w-5 h-5 text-gray-600" />
          </button>
         
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search groups"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSearch()}
          className="  w-full
    pl-10 pe-4 py-2
    border border-gray-300
    rounded-full
    text-base
    bg-gray-50
    text-gray-900
    transition-all duration-200
    focus:outline-none
    focus:border-orange-500
    focus:ring-3 focus:ring-orange-500/10"
        />
      </div>

      {/* Navigation */}
      <div className="space-y-1 mb-4">
        <button
          onClick={() => {
            handleViewChange("feed");
          }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
            view === "feed"
              ? "bg-orange-50 text-orange-600 font-semibold"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          <FileText className="w-5 h-5" />
          <span>Your feed</span>
        </button>
        <button
          onClick={() => {
            handleViewChange("discover");
          }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
            view === "discover"
              ? "bg-orange-50 text-orange-600 font-semibold"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          <Compass className="w-5 h-5" />
          <span>Discover</span>
        </button>
        {user && (
          <button
            onClick={() => {
              handleViewChange("my-groups");

            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              view === "my-groups"
                ? "bg-orange-50 text-orange-600 font-semibold"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Users className="w-5 h-5" />
            <span>Your groups</span>
          </button>
        )}
      </div>

      {/* Create Group Button */}
      {user && (
        <button
          onClick={() => {
            router.push("/groups/create");
          }}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span>Create new group</span>
        </button>
      )}

      {/* Groups You Manage */}
      {user && managedGroups.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 px-2">
            Groups you manage
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {managedGroups.map((group) => (
              <button
                key={group.id}
                onClick={() => {
                  handleViewGroup(group.id);
    
                }}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-100 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-african-green flex items-center justify-center shrink-0">
                  {group.avatar_url ? (
                    <img
                      src={group.avatar_url}
                      alt={group.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-bold text-sm">
                      {group.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate text-sm">
                    {group.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    Last active{" "}
                    {formatDistanceToNow(
                      new Date(group.updated_at || group.created_at),
                      { addSuffix: true },
                    )}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Groups You've Joined */}
      {user && joinedGroups.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2 px-2">
            <h3 className="text-sm font-semibold text-gray-700">
              Groups you've joined
            </h3>
            {joinedGroups.length > 5 && (
              <button
                onClick={() => setShowAllJoined(!showAllJoined)}
                className="text-xs text-orange-600 hover:underline"
              >
                {showAllJoined ? "See less" : "See all"}
              </button>
            )}
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {displayedJoinedGroups.map((group) => (
              <button
                key={group.id}
                onClick={() => {
                  handleViewGroup(group.id);
    
                }}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-100 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-african-green flex items-center justify-center shrink-0">
                  {group.avatar_url ? (
                    <img
                      src={group.avatar_url}
                      alt={group.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-bold text-sm">
                      {group.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate text-sm">
                    {group.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    Last active{" "}
                    {formatDistanceToNow(
                      new Date(group.updated_at || group.created_at),
                      { addSuffix: true },
                    )}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-full 2xl:max-w-screen-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Mobile Header */}
        <div className="lg:hidden mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">Groups</h1>
            </div>
            {user && (
              <button
                onClick={() => router.push("/groups/create")}
                className="p-2 bg-primary-600 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Mobile Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search groups"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              className="
               w-full
    pl-10 pe-4 py-2
    border border-gray-300
    rounded-full
    text-base
    bg-gray-50
    text-gray-900
    transition-all duration-200
    focus:outline-none
    focus:border-orange-500
    focus:ring-3 focus:ring-orange-500/10"
            />
          </div>

          {/* Mobile Navigation Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => handleViewChange("feed")}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors text-sm font-medium bg-gray-300  ${
                view === "feed"
                  ? "text-orange-600 bg-orange-100"
                  : "text-gray-700 hover:bg-gray-100 "
              }`}
            >
              Your feed
            </button>
            <button
              onClick={() => handleViewChange("discover")}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors text-sm font-medium bg-gray-300 ${
                view === "discover"
                  ? "text-orange-600 bg-orange-100"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              Discover
            </button>
            {user && (
              <button
                onClick={() => handleViewChange("my-groups")}
                className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors text-sm font-medium bg-gray-300 ${
                  view === "my-groups"
                    ? "text-orange-600 bg-orange-100"
                    : "text-gray-700 hover:bg-gray-100" 
                }`}
              >
                Your groups
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-4 lg:gap-6">
          {/* Left Sidebar - Desktop */}
          <div className="hidden lg:block w-80 shrink-0">
            <div className="sticky top-4 space-y-4">
              <SidebarContent />
            </div>
          </div>


          {/* Main Content */}
          <div className="flex-1 min-w-0 w-full lg:w-auto">
            {view === "feed" && (
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
                  Recent activity
                </h2>
                {activityLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  </div>
                ) : recentActivity.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-sm p-6 sm:p-12 text-center">
                    <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                      No recent activity
                    </h3>
                    <p className="text-sm sm:text-base text-gray-500 mb-4">
                      Join groups to see posts and updates from your
                      communities.
                    </p>
                    <button
                      onClick={() => handleViewChange("discover")}
                      className="btn-primary text-sm sm:text-base"
                    >
                      Discover Groups
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {recentActivity.map((post: any) => (
                      <div
                        key={post.id}
                        className="bg-white rounded-lg shadow-sm overflow-hidden"
                      >
                        <div className="p-2 sm:p-3 border-b border-gray-200">
                          <button
                            onClick={() => handleViewGroup(post.group_id)}
                            className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 hover:text-primary-600"
                          >
                            {post.group?.avatar_url ? (
                              <img
                                src={post.group.avatar_url}
                                alt={post.group.name}
                                className="w-4 h-4 sm:w-5 sm:h-5 rounded-full"
                              />
                            ) : (
                              <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-primary-500 to-african-green flex items-center justify-center">
                                <span className="text-white text-xs font-bold">
                                  {post.group?.name?.charAt(0).toUpperCase() ||
                                    "G"}
                                </span>
                              </div>
                            )}
                            <span className="font-medium truncate">
                              {post.group?.name || "Group"}
                            </span>
                            <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                          </button>
                        </div>
                        <GroupPostCard
                          post={post}
                          onLike={() => handlePostLike(post.id)}
                          onComment={() => handlePostComment(post.id)}
                          onShare={() => handlePostShare(post.id)}
                          isPostLiked={post.isLiked}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {view === "discover" && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                    Discover Groups
                  </h2>
                </div>

                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  </div>
                ) : filteredGroups.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6">
                    {filteredGroups.map((group) => (
                      <GroupCard
                        key={group.id}
                        group={group}
                        onViewGroup={handleViewGroup}
                        onJoinGroup={handleJoinGroup}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 sm:py-12">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                    </div>
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                      No groups found
                    </h3>
                    <p className="text-sm sm:text-base text-gray-500 mb-4 px-4">
                      {searchTerm
                        ? "Try adjusting your search filters or browse all groups."
                        : "Be the first to create a group in this community!"}
                    </p>
                    {user && (
                      <button
                        onClick={() => router.push("/groups/create")}
                        className="btn-primary text-sm sm:text-base"
                      >
                        Create Your First Group
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {view === "my-groups" && (
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
                  Your Groups
                </h2>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  </div>
                ) : filteredGroups.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {filteredGroups.map((group) => (
                      <GroupCard
                        key={group.id}
                        group={group}
                        onViewGroup={handleViewGroup}
                        onJoinGroup={handleJoinGroup}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 sm:py-12">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                    </div>
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                      No groups joined yet
                    </h3>
                    <p className="text-sm sm:text-base text-gray-500 mb-4 px-4">
                      Join or create groups to connect with people who share
                      your interests and goals.
                    </p>
                    {user && (
                      <button
                        onClick={() => router.push("/groups/create")}
                        className="btn-primary text-sm sm:text-base"
                      >
                        Create Your First Group
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupsPage;
