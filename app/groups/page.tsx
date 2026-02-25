"use client";

import { useAuth } from "@/contexts/AuthContext";
import GroupCard from "@/features/groups/components/GroupCard";
import GroupPostCard from "@/features/groups/components/GroupPostCard";
import { useGroups } from "@/shared/hooks/useGroups";
import { Group } from "@/shared/types";
import {
  Compass,
  Plus,
  Search,
  Users,
  FileText,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { apiClient } from "@/lib/api-client";
import toast from "react-hot-toast";
import { getReactionTypeFromEmoji } from "@/shared/utils/reactionUtils";
import {
  useShimmerCount,
  GroupsFeedShimmer,
  GroupsGridShimmer,
} from "@/shared/components/ui/ShimmerLoaders";
import ShareModal from "@/features/social/components/ShareModal";
import { useMembers } from "@/shared/hooks/useMembers";
import { sendNotification } from "@/shared/services/notificationService";

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
  const [managedGroups, setManagedGroups] = useState<Group[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [showAllJoined, setShowAllJoined] = useState(false);
  const [showCommentsFor, setShowCommentsFor] = useState<string | null>(null);
  const [shareModalState, setShareModalState] = useState<{ open: boolean; postId: string | null; groupId: string | null }>({ open: false, postId: null, groupId: null });
  const { members } = useMembers();
  const shimmerCount = useShimmerCount();

  // Fetch managed and joined groups separately
  useEffect(() => {
    if (user?.id) {
      const loadGroups = async () => {
        await fetchMyGroups();
        const managed = await fetchManagedGroups();
        setManagedGroups(managed);
      };
      loadGroups();
    }
  }, [user?.id]);

  // Derive joined groups synchronously — no extra render cycle
  const joinedGroups = useMemo(() => {
    if (!user || groups.length === 0) return [];
    return groups.filter(
      (g: Group) =>
        g.membership &&
        g.membership.status === "active" &&
        !managedGroups.some((mg) => mg.id === g.id),
    );
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

  // Derive filtered groups synchronously — no extra render cycle
  const filteredGroups = useMemo(() => {
    if (!searchTerm) return groups;
    const lowercaseSearch = searchTerm.toLowerCase();
    return groups.filter(
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

  const displayedJoinedGroups = useMemo(
    () => (showAllJoined ? joinedGroups : joinedGroups.slice(0, 5)),
    [joinedGroups, showAllJoined],
  );

  const handlePostLike = async (postId: string) => {
    // Default like reaction via the React button fallback
    handlePostEmojiReaction(postId, '\u{1F44D}');
  };

  const handlePostEmojiReaction = useCallback(async (postId: string, emoji: string) => {
    if (!user) {
      toast.error("You must be logged in to react to posts");
      return;
    }

    try {
      const reactionType = getReactionTypeFromEmoji(emoji);
      const targetPost = recentActivity.find((p: any) => p.id === postId);
      if (!targetPost?.group_id) {
        toast.error("Post not found");
        return;
      }

      const response = await apiClient.post<{ action: 'added' | 'updated' | 'removed'; reaction_type: string }>(
        `/api/groups/${targetPost.group_id}/posts/${postId}/reactions`,
        { reaction_type: reactionType }
      );

      setRecentActivity((prev: any[]) =>
        prev.map((p: any) =>
          p.id === postId
            ? {
                ...p,
                likes_count:
                  response.action === "added"
                    ? p.likes_count + 1
                    : response.action === "removed"
                    ? Math.max(0, p.likes_count - 1)
                    : p.likes_count,
                isLiked: response.action === "removed" ? false : true,
              }
            : p,
        ),
      );

      if (response.action === "removed") {
        toast.success("Reaction removed");
      } else if (response.action === "updated") {
        toast.success("Reaction updated");
      } else {
        toast.success("Reaction saved!");
      }
      window.dispatchEvent(new CustomEvent("group-reaction-updated", { detail: { postId } }));
    } catch (err: any) {
      console.error("Error handling emoji reaction:", err);
      toast.error("Something went wrong");
    }
  }, [user?.id, recentActivity]);

  const handlePostComment = (postId: string) => {
    setShowCommentsFor(showCommentsFor === postId ? null : postId);
  };

  const handlePostShare = (postId: string) => {
    const post = recentActivity.find((p: any) => p.id === postId);
    setShareModalState({ open: true, postId, groupId: post?.group_id || null });
  };

  const handleSendToMembers = async (memberIds: string[], message: string) => {
    if (!memberIds.length) {
      toast.success('No members selected');
      return;
    }

    const senderName = user?.user_metadata?.full_name || user?.email || 'Someone';
    const postId = shareModalState.postId;
    const groupId = shareModalState.groupId;

    const results = await Promise.allSettled(
      memberIds.map((memberId) =>
        sendNotification({
          user_id: memberId,
          title: 'Post Shared With You',
          body: message
            ? `${senderName} shared a group post with you: "${message}"`
            : `${senderName} shared a group post with you`,
          notification_type: 'post_share',
          data: {
            type: 'post_share',
            post_id: postId || '',
            group_id: groupId || '',
            sender_id: user?.id || '',
            sender_name: senderName,
            message,
            url: `/groups/${groupId || ''}?post=${postId}`,
          },
        })
      )
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
    if (succeeded > 0) {
      toast.success(`Shared with ${succeeded} member${succeeded === 1 ? '' : 's'}`);
    } else {
      toast.error('Failed to send notifications');
    }
  };

  const shareUrl = useMemo(() => {
    if (!shareModalState.postId) return '';
    if (typeof window === 'undefined') return `/groups/${shareModalState.groupId || ''}?post=${shareModalState.postId}`;
    return `${window.location.origin}/groups/${shareModalState.groupId || ''}?post=${shareModalState.postId}`;
  }, [shareModalState.postId, shareModalState.groupId]);

  // Sidebar content as plain JSX — avoids recreating a component type every
  // render which would cause React to fully unmount/remount the sidebar DOM.
  const sidebarContent = (
    <div className="space-y-4">
      {/* Groups Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Groups</h2>
      
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
                  {group.banner_url ? (
                    <img
                      src={group.banner_url}
                      alt={group.name}
                      className="w-full h-full rounded-lg object-cover"
                    />
                  ) : (
                   <span className="text-gray-700 font-bold text-sm bg-gray-300 w-10 h-10 rounded-lg flex items-center justify-center">
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
                  {group.banner_url ? (
                    <img
                      src={group.banner_url}
                      alt={group.name}
                      className="w-full h-full rounded-lg object-cover"
                    />
                  ) : (
                  <span className="text-gray-700 font-bold text-sm bg-gray-300 w-10 h-10 rounded-lg flex items-center justify-center">
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
    <div className="min-h-screen bg-gray-50 w-full min-w-0 overflow-x-hidden">
      <div className="max-w-full 2xl:max-w-screen-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 w-full min-w-0">
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
              {sidebarContent}
            </div>
          </div>


          {/* Main Content */}
          <div className="flex-1 min-w-0 w-full lg:w-auto">
            {view === "feed" && (
              <div className="max-w-2xl mx-auto w-full min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
                  Recent activity
                </h2>
                {activityLoading ? (
                  <GroupsFeedShimmer />
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
                          onEmojiReaction={handlePostEmojiReaction}
                          isPostLiked={post.isLiked}
                          showCommentsFor={showCommentsFor === post.id}
                          onToggleComments={() => setShowCommentsFor(showCommentsFor === post.id ? null : post.id)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {view === "discover" && (
              <div className="max-w-4xl mx-auto w-full min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                    Discover Groups
                  </h2>
                </div>

                {loading ? (
                  <GroupsGridShimmer count={shimmerCount} />
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
              <div className="max-w-4xl mx-auto w-full min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
                  Your Groups
                </h2>
                {loading ? (
                  <GroupsGridShimmer count={shimmerCount} />
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

      {/* Share Modal */}
      {shareModalState.postId && (
        <ShareModal
          isOpen={shareModalState.open}
          onClose={() => setShareModalState({ open: false, postId: null, groupId: null })}
          postUrl={shareUrl}
          postId={shareModalState.postId}
          members={members}
          onSendToMembers={handleSendToMembers}
        />
      )}
    </div>
  );
};

export default GroupsPage;
