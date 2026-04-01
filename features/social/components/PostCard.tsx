import React, { useState, useRef, useEffect, useId } from "react";
import {
  MoreHorizontal,
  Trash2,
  Edit,
  UserPlus,
  UserCheck,
  MapPin,
  Bookmark,
  BookmarkX,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import EmojiPicker from "@/shared/components/ui/EmojiPicker";
import { useAuth } from "@/contexts/AuthContext";
import {
  followUser,
  unfollowUser,
} from "../services/followService";
import { supabase } from "@/lib/supabase";
import { logEngagementEvent } from "../services/engagementTracking";
import toast from "react-hot-toast";
import dynamic from "next/dynamic";
import { apiClient } from "@/lib/api-client";
import ImageViewer from "@/shared/components/ui/ImageViewer";
import CommentsSection from "./CommentsSection";
import PostEngagement from "@/shared/components/PostEngagement";
import CreatePost, { type PostSubmitData } from "./CreatePost";
interface Post {
  id: string;
  title: string;
  content: string;
  category: "politics" | "culture" | "general";
  author_id: string;
  author: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
    country: string | null;
    creator_type?: string;
    location?: string;
  };
  media_urls: string[] | null;
  location?: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  views_count: number;
  language?: string;
  created_at: string;
  isLiked?: boolean;
  /** From API when user has bookmarked this post */
  is_saved?: boolean;
  is_following?: boolean;
  reactions?: Array<{
    type: string;
    count: number;
    users: Array<{ id: string; username?: string; full_name?: string; avatar_url?: string | null }>;
    currentUserReacted?: boolean;
  }>;
  reactions_total_count?: number;
  canComment?: boolean;
  canFollow?: boolean;
}

interface PostCardProps {
  post: Post;
  onLike: (postId: string) => void;
  onComment: (postId: string) => void;
  onShare: (postId: string) => void;
  onDelete?: (postId: string) => void;
  onEdit?: (postId: string, updates: { title: string; content: string; category: 'politics' | 'culture' | 'general'; media_urls?: string[]; media_type?: string; tags?: string[] }) => void;
  onEmojiReaction?: (postId: string, emoji: string) => void;
  showEmojiPicker?: boolean;
  postReactions?: { [emoji: string]: string[] };
  isPostLiked?: boolean;
  /** When false, comment action is hidden/disabled (e.g. post owner turned off comments). Default true. */
  canComment?: boolean;
  /** When false, Follow is hidden in the post menu (e.g. author allow_follows is none or friends-only). Default true. */
  canFollow?: boolean;
  /** When true, clicking the card does not navigate to the post page (e.g. when already on the detail page). */
  disablePostClick?: boolean;
  /** Called after save/unsave API succeeds (e.g. remove card from Saved list). */
  onSaveStateChange?: (postId: string, saved: boolean) => void;
}

// Facebook-style background colors for short posts
const POST_BACKGROUNDS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", // Purple
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", // Pink-Red
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", // Blue
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)", // Green-Cyan
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)", // Pink-Yellow
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)", // Teal-Purple
  "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)", // Mint-Pink
  "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)", // Coral-Pink
  "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)", // Peach
  "linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)", // Red-Blue
];

export const PostCard: React.FC<PostCardProps> = React.memo(({
  post,
  onLike,
  onComment,
  onShare,
  onDelete,
  onEdit,
  onEmojiReaction,
  postReactions = {},
  isPostLiked = false,
  canComment = true,
  canFollow = true,
  disablePostClick = false,
  onSaveStateChange,
}) => {
  const { user } = useAuth();
  const router = useRouter();
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(post.is_following ?? false);
  const [followCheckLoading, setFollowCheckLoading] = useState(false);
  const [hasViewed, setHasViewed] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [postSaved, setPostSaved] = useState(post.is_saved ?? false);
  const closeTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setPostSaved(post.is_saved ?? false);
  }, [post.id, post.is_saved]);
  const menuRef = useRef<HTMLDivElement>(null);
  const postRef = useRef<HTMLElement>(null);
  const postOptionsMenuId = useId();
  // Auto-open comments for a random subset of posts with exactly 2 comments
  const shouldAutoOpenComments = (() => {
    if ((post.comments_count || 0) !== 2) return false;
    const hash = post.id.split("").reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    return Math.abs(hash) % 3 === 0; // ~33% of eligible posts
  })();

  const [showInlineComments, setShowInlineComments] = useState(shouldAutoOpenComments);

  const [reactions, setReactions] = useState<{
    groups: Array<{
      type: string;
      count: number;
      users: Array<{ id: string; username?: string; full_name?: string; avatar_url?: string | null }>;
      currentUserReacted?: boolean;
    }>;
    totalCount: number;
  }>({
    groups: post.reactions || [],
    totalCount: post.reactions_total_count ?? 0,
  });

  useEffect(() => {
    const handleReactionUpdate = (event: CustomEvent) => {
      if (event.detail?.postId === post.id) {
        setTimeout(async () => {
          try {
            const res = await apiClient.get<{
              data: Array<{
                type: string;
                count: number;
                users: Array<{ id: string; username?: string; full_name?: string; avatar_url?: string | null }>;
                currentUserReacted?: boolean;
              }>
              totalCount: number
            }>(`/api/posts/${post.id}/reaction`);
            setReactions({ groups: res.data || [], totalCount: res.totalCount || 0 });
          } catch {}
        }, 300);
      }
    };

    window.addEventListener("reaction-updated", handleReactionUpdate as EventListener);
    return () => {
      window.removeEventListener("reaction-updated", handleReactionUpdate as EventListener);
    };
  }, [post.id]);

  // Determine if this is a short text-only post (Facebook-style large text)
  const isShortTextPost = () => {
    const hasMedia = post.media_urls && post.media_urls.length > 0;
    const fullText = (post.title || "") + " " + (post.content || "");
    const textLength = fullText.trim().length;
    return !hasMedia && textLength > 0 && textLength <= 150;
  };

  const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
    ssr: false,
  });

  // Get a consistent background color for this post
  const getPostBackground = () => {
    if (!isShortTextPost()) return null;
    // Use post ID to consistently select same color for same post
    const hash = post.id.split("").reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    const index = Math.abs(hash) % POST_BACKGROUNDS.length;
    return POST_BACKGROUNDS[index];
  };

  // Track view when post comes into view
  useEffect(() => {
    if (!user || hasViewed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasViewed) {
            setHasViewed(true);
            logEngagementEvent({
              userId: user.id,
              postId: post.id,
              type: 'view',
            });
          }
        });
      },
      { threshold: 0.5 }
    );

    if (postRef.current) {
      observer.observe(postRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [user, hasViewed, post.id]);


  const handleEmojiHover = (emoji: string) => {
    setHoveredEmoji(emoji);
  };

  const handleEmojiLeave = () => {
    setHoveredEmoji(null);
  };

  const handleReactHover = () => {
    if (closeTimeout.current) {
      clearTimeout(closeTimeout.current);
      closeTimeout.current = null;
    }
    setShowReactionPicker(true);
  };

  const handleReactLeave = () => {
    // ❗ Don't close quick reactions if emoji picker is open
    if (showEmojiPicker) return;

    closeTimeout.current = setTimeout(() => {
      setShowReactionPicker(false);
    }, 300);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
    setShowMenu(false);
  };

  const handleDeleteConfirm = () => {
    onDelete?.(post.id);
    setShowDeleteConfirm(false);
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  const handleFollow = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!user) {
      toast.error("Please sign in to tap in");
      return;
    }

    try {
      setFollowCheckLoading(true);
      if (isFollowing) {
        const success = await unfollowUser(user.id, post.author.id);
        if (success) {
          setIsFollowing(false);
          toast.success("Untapped");
        } else {
          toast.error("Failed to untap");
        }
      } else {
        const success = await followUser(user.id, post.author.id);
        if (success) {
          setIsFollowing(true);
          toast.success("Tapped in!");
        } else {
          toast.error("Failed to tap in");
        }
      }
    } catch (error) {
      console.error("Error handling follow:", error);
      toast.error("Something went wrong");
    } finally {
      setFollowCheckLoading(false);
    }
  };

  const requireSignedIn = (): boolean => {
    if (!user) {
      toast.error("Please sign in to continue");
      return false;
    }
    return true;
  };

  const persistPostSaveToggle = async () => {
    if (!requireSignedIn() || !user) return;
    if (post.author?.id === user.id) {
      toast.success("This is your post");
      return;
    }
    try {
      const { saved } = await apiClient.post<{ saved: boolean }>(
        `/api/posts/${post.id}/save`
      );
      setPostSaved(saved);
      onSaveStateChange?.(post.id, saved);
      if (saved) {
        logEngagementEvent({
          userId: user.id,
          postId: post.id,
          type: "save",
          contentType: "post",
        });
        toast.success("Post saved");
      } else {
        logEngagementEvent({
          userId: user.id,
          postId: post.id,
          type: "unsave",
          contentType: "post",
        });
        toast.success("Removed from saved");
      }
    } catch {
      toast.error("Could not update saved posts");
    }
  };

  const savePostFromMenu = async () => {
    if (postSaved) {
      toast.success("Already in your saved list");
      return;
    }
    await persistPostSaveToggle();
  };

  const unsavePostFromMenu = async () => {
    if (!postSaved) {
      toast.success("This post isn't in your saved list");
      return;
    }
    await persistPostSaveToggle();
  };

  // Navigate to user profile
  const handleUserProfileClick = () => {
    router.push(`/user/${post.author.username}`);
  };

  // Handle edit post
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setShowMenu(false);
  };

  const handleSaveEdit = async (postData: PostSubmitData) => {
    try {
      const updatePayload: Record<string, any> = {
        title: postData.title,
        content: postData.content,
        category: postData.category,
        media_type: postData.media_type,
        media_urls: postData.media_urls ?? [],
        location: postData.location || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("posts")
        .update(updatePayload)
        .eq("id", post.id);

      if (error) throw error;

      if (onEdit) {
        onEdit(post.id, {
          title: postData.title,
          content: postData.content,
          category: postData.category,
          media_urls: postData.media_urls,
          media_type: postData.media_type,
          tags: postData.tags,
        });
      }

      setIsEditing(false);
      toast.success("Post updated successfully");
    } catch (error) {
      console.error("Error updating post:", error);
      toast.error("Failed to update post");
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const isOwnPost = Boolean(
    user && post.author && post.author.id === user.id
  );

  // Open image viewer on image click
  const handleImageClick = (index: number) => {
    setImageViewerIndex(index);
    setImageViewerOpen(true);
  };

  // Get only image URLs for the viewer (exclude videos)
  const isImageFile = (url: string): boolean => {
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg|jfif|avif)(\?|#|$)/i.test(url);
  };

  const isVideoFile = (url: string): boolean => {
    return /\.(mp4|webm|ogg|avi|mov|wmv|flv|mkv)(\?|#|$)/i.test(url);
  };

  const imageUrls = (post.media_urls || []).filter(isImageFile);


  // Format reaction summary (Facebook style: "John, Mary and 5 others")
  const formatReactionSummary = (reactionGroup: any): string => {
    if (!reactionGroup || reactionGroup.count === 0) return "";

    const users = reactionGroup.users || [];
    const count = reactionGroup.count;

    if (count === 0) return "";
    if (count === 1 && users.length > 0) {
      return users[0].full_name || users[0].username;
    }
    if (count === 2 && users.length >= 2) {
      return `${users[0].full_name || users[0].username} and ${
        users[1].full_name || users[1].username
      }`;
    }
    if (users.length > 0) {
      const remaining = count - users.length;
      if (remaining > 0) {
        return `${
          users[0].full_name || users[0].username
        } and ${remaining} other${remaining !== 1 ? "s" : ""}`;
      } else {
        const names = users
          .slice(0, 2)
          .map((u: any) => u.full_name || u.username)
          .join(", ");
        return `${names} and ${count - 2} other${count - 2 !== 1 ? "s" : ""}`;
      }
    }
    return `${count} reaction${count !== 1 ? "s" : ""}`;
  };

  // Get all reaction groups sorted by count
  const getReactionGroups = () => {
    return (reactions.groups || [])
      .filter((reaction) => reaction && reaction.count > 0)
      .sort((a, b) => b.count - a.count);
  };

  const renderMedia = (url: string, index: number) => {
    if (isImageFile(url)) {
      // Find the index of this image within imageUrls (excluding videos)
      const imageIndex = imageUrls.indexOf(url);
      return (
        <div
          className="relative cursor-pointer group"
          onClick={(e) => {
            e.stopPropagation();
            handleImageClick(imageIndex >= 0 ? imageIndex : 0);
          }}
        >
          <img
            src={url}
            alt={`Post media ${index + 1}`}
            className="w-full h-auto max-h-96 object-cover transition-transform duration-200 group-hover:brightness-95"
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
            }}
          />
        </div>
      );
    }

    if (isVideoFile(url)) {
      return (
        <video
          src={url}
          controls
          className="w-full h-auto max-h-96"
          preload="metadata"
          onError={(e) => {
            const target = e.target as HTMLVideoElement;
            target.style.display = "none";
          }}
        >
          Your browser does not support the video tag.
        </video>
      );
    }

    return (
      <div className="w-full h-32 bg-gray-100 flex items-center justify-center rounded-lg">
        <span className="text-gray-500">Unsupported media file</span>
      </div>
    );
  };

  const handlePostClick = (e: React.MouseEvent) => {
    if (disablePostClick || isEditing) return
    const target = e.target as HTMLElement
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('[role="button"]') ||
      target.closest('[data-edit-modal]')
    ) {
      return
    }
    router.push(`/post/${post.id}`)
  }

  return (
    <article
      ref={postRef}
      onClick={handlePostClick}
      className="card mb-1 sm:mb-2 hover:shadow-md transition-shadow duration-200 bg-white rounded-lg border border-gray-200 p-3 sm:p-4 cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <button
            onClick={handleUserProfileClick}
            className="flex items-center space-x-3 flex-1 min-w-0 !no-underline"
            style={{ textDecoration: 'none' }}
          >
            {post.author.avatar_url ? (
              <img
                src={post.author.avatar_url}
                alt={`${post.author.full_name}'s avatar`}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover flex-shrink-0"
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                  target.nextElementSibling?.classList.remove("hidden");
                }}
              />
            ) : null}
            <div
              className={`w-8 h-8 sm:w-10 sm:h-10 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0 ${
                post.author.avatar_url ? "hidden" : ""
              }`}
            >
              <span className="text-gray-600 font-medium text-xs sm:text-sm">
                {post.author.full_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2 flex-wrap">
                <h3 className="font-semibold text-gray-900 truncate text-sm sm:text-base !no-underline">
                  {post.author.full_name}
                </h3>
                <span className="text-gray-500 truncate text-xs sm:text-sm">
                  @{post.author.username}
                </span>
                {post.author.country && (
                  <span className="text-gray-400 truncate text-xs sm:text-sm">
                    • {post.author.country}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2 mt-1 flex-wrap">
                <time
                  className="text-gray-500 text-xs sm:text-sm"
                  dateTime={post.created_at}
                >
                  {formatDistanceToNow(new Date(post.created_at), {
                    addSuffix: true,
                  })}
                </time>
                {post.location && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(post.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-orange-500 hover:text-orange-600 text-xs sm:text-sm transition-colors"
                    title="Open in Google Maps"
                  >
                    <MapPin className="w-3 h-3" />
                    <span className="truncate max-w-[150px] sm:max-w-[200px] underline">{post.location}</span>
                  </a>
                )}
              </div>
            </div>
          </button>
        </div>

        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="rounded-full p-2 transition-colors duration-200 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1"
            aria-label="Post options"
            aria-expanded={showMenu}
            aria-haspopup="menu"
            aria-controls={postOptionsMenuId}
          >
            <MoreHorizontal className="h-5 w-5 text-gray-600" aria-hidden />
          </button>

          {showMenu && (
            <ul
              id={postOptionsMenuId}
              role="menu"
              aria-label={isOwnPost ? "Your post actions" : "Post actions"}
              className="absolute right-0 top-full z-50 mt-1 m-0 w-[min(100vw-2rem,20rem)] list-none rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
            >
              {isOwnPost ? (
                <>
                  <li role="none" className="list-none">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleEditClick}
                      className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-100 focus:outline-none focus-visible:bg-gray-100"
                    >
                      <Edit
                        className="mt-0.5 h-5 w-5 shrink-0 text-gray-600"
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-gray-900">
                          Edit post
                        </span>
                        <span className="mt-0.5 block text-xs text-gray-500">
                          Change text, media, or details
                        </span>
                      </span>
                    </button>
                  </li>
                  <li role="none" className="list-none border-t border-gray-100">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleDeleteClick}
                      className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-red-50 focus:outline-none focus-visible:bg-red-50"
                    >
                      <Trash2
                        className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-red-600">
                          Delete post
                        </span>
                        <span className="mt-0.5 block text-xs text-red-500/90">
                          Remove this post permanently
                        </span>
                      </span>
                    </button>
                  </li>
                </>
              ) : (
                <>
                  {canFollow && (
                    <li role="none" className="list-none">
                      <button
                        type="button"
                        role="menuitem"
                        disabled={followCheckLoading}
                        onClick={async (e) => {
                          e.stopPropagation();
                          await handleFollow(e);
                          setShowMenu(false);
                        }}
                        className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-100 focus:outline-none focus-visible:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {followCheckLoading ? (
                          <>
                            <div
                              className="mt-0.5 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-gray-200 border-t-gray-600"
                              aria-hidden
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-gray-900">
                                Working…
                              </span>
                              <span className="mt-0.5 block text-xs text-gray-500">
                                Updating tap-in status
                              </span>
                            </span>
                          </>
                        ) : isFollowing ? (
                          <>
                            <UserCheck
                              className="mt-0.5 h-5 w-5 shrink-0 text-gray-600"
                              aria-hidden
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-gray-900">
                                UnTap In
                              </span>
                              <span className="mt-0.5 block text-xs text-gray-500">
                                Stop following this creator from your feed
                              </span>
                            </span>
                          </>
                        ) : (
                          <>
                            <UserPlus
                              className="mt-0.5 h-5 w-5 shrink-0 text-gray-600"
                              aria-hidden
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-gray-900">
                                Tap In
                              </span>
                              <span className="mt-0.5 block text-xs text-gray-500">
                                Follow this creator and see more of their posts
                              </span>
                            </span>
                          </>
                        )}
                      </button>
                    </li>
                  )}
                  <li
                    role="none"
                    className={`list-none ${canFollow ? "border-t border-gray-100" : ""}`}
                  >
                    {postSaved ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation();
                          void (async () => {
                            await unsavePostFromMenu();
                            setShowMenu(false);
                          })();
                        }}
                        className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-100 focus:outline-none focus-visible:bg-gray-100"
                      >
                        <BookmarkX
                          className="mt-0.5 h-5 w-5 shrink-0 text-gray-600"
                          aria-hidden
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-gray-900">
                            Unsave post
                          </span>
                          <span className="mt-0.5 block text-xs text-gray-500">
                            Remove from your saved items
                          </span>
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation();
                          void (async () => {
                            await savePostFromMenu();
                            setShowMenu(false);
                          })();
                        }}
                        className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-100 focus:outline-none focus-visible:bg-gray-100"
                      >
                        <Bookmark
                          className="mt-0.5 h-5 w-5 shrink-0 text-gray-600"
                          aria-hidden
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-gray-900">
                            Save post
                          </span>
                          <span className="mt-0.5 block text-xs text-gray-500">
                            Add to your saved list
                          </span>
                        </span>
                      </button>
                    )}
                  </li>
                </>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Edit Post Modal */}
      {isEditing && (
        <div data-edit-modal className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCancelEdit} />
          {/* Modal */}
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl z-10">
            <CreatePost
              editData={{
                id: post.id,
                title: post.title,
                content: post.content,
                category: post.category,
                media_urls: post.media_urls ?? undefined,
                location: post.location ?? undefined,
              }}
              onSubmit={handleSaveEdit}
              onCancel={handleCancelEdit}
            />
          </div>
        </div>
      )}

      {/* Content */}
      {!isEditing && (
        <>
          {isShortTextPost() ? (
            /* Facebook-style large text with gradient background */
            <div
              className="mb-4 rounded-xl p-8 min-h-[250px] flex items-center justify-center"
              style={{ background: getPostBackground() || undefined }}
            >
              <div className="text-center">
                {post.title && (
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 break-words drop-shadow-lg">
                    {post.title}
                  </h2>
                )}
                <p className="text-xl sm:text-2xl md:text-3xl font-semibold text-white leading-relaxed whitespace-pre-wrap break-words drop-shadow-lg">
                  {post.content}
                </p>
              </div>
            </div>
          ) : (
            /* Regular post style */
            <div className="mb-2">
              {post.title && (
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 break-words">
                  {post.title}
                </h2>
              )}
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap break-words text-sm sm:text-base">
                {post.content}
              </p>
            </div>
          )}
        </>
      )}

      {/* Media - Facebook style grid */}
      {post.media_urls && post.media_urls.length > 0 && (
        <div className="mb-2 -mx-3 sm:-mx-4">
          {(() => {
            const mediaCount = post.media_urls!.length;
            const visibleMedia = post.media_urls!.slice(0, mediaCount === 1 ? 1 : mediaCount === 2 ? 2 : mediaCount === 3 ? 3 : 4);
            const extraCount = mediaCount - visibleMedia.length;

            if (mediaCount === 1) {
              return (
                <div className="overflow-hidden">
                  {renderMedia(visibleMedia[0], 0)}
                </div>
              );
            }

            if (mediaCount === 2) {
              return (
                <div className="grid grid-cols-2 gap-0.5">
                  {visibleMedia.map((url, index) => (
                    <div key={`${post.id}-media-${index}`} className="overflow-hidden aspect-square">
                      {renderMedia(url, index)}
                    </div>
                  ))}
                </div>
              );
            }

            if (mediaCount === 3) {
              return (
                <div className="grid grid-cols-2 gap-0.5">
                  <div className="col-span-2 overflow-hidden aspect-video">
                    {renderMedia(visibleMedia[0], 0)}
                  </div>
                  {visibleMedia.slice(1).map((url, index) => (
                    <div key={`${post.id}-media-${index + 1}`} className="overflow-hidden aspect-square">
                      {renderMedia(url, index + 1)}
                    </div>
                  ))}
                </div>
              );
            }

            // 4+ images: 2x2 grid with +N overlay on last cell
            return (
              <div className="grid grid-cols-2 gap-0.5">
                {visibleMedia.map((url, index) => (
                  <div key={`${post.id}-media-${index}`} className="relative overflow-hidden aspect-square">
                    {renderMedia(url, index)}
                    {/* +N overlay on the last visible image if there are more */}
                    {index === visibleMedia.length - 1 && extraCount > 0 && (
                      <div
                        className="absolute inset-0 bg-black/50 flex items-center justify-center cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleImageClick(index);
                        }}
                      >
                        <span className="text-white text-3xl font-bold">
                          +{extraCount}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Engagement Stats & Actions */}
      <PostEngagement
        reactionGroups={getReactionGroups()}
        totalReactionCount={reactions.totalCount}
        commentsCount={post.comments_count}
        sharesCount={post.shares_count}
        viewsCount={post.views_count}
        showViews={!!(post.media_urls && post.media_urls.some((url) => isVideoFile(url)))}
        onLike={(emoji) => onEmojiReaction?.(post.id, emoji || '👍')}
        onComment={() => setShowInlineComments(prev => !prev)}
        onShare={() => onShare(post.id)}
        onUserClick={(username) => router.push(`/user/${username}`)}
        postId={post.id}
      />

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Post
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this post? This action cannot be
              undone.
            </p>
            <div className="flex space-x-3 justify-end">
              <button
                onClick={handleDeleteCancel}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer - Facebook style lightbox */}
      {imageUrls.length > 0 && (
        <ImageViewer
          images={imageUrls}
          initialIndex={imageViewerIndex}
          isOpen={imageViewerOpen}
          onClose={() => setImageViewerOpen(false)}
        />
      )}

      {/* Inline Comments Section - Facebook style */}
      {showInlineComments && (
        <div className="border-t border-gray-100 mt-1" onClick={(e) => e.stopPropagation()}>
          <CommentsSection
            postId={post.id}
            isOpen={true}
            onClose={() => setShowInlineComments(false)}
            canComment={canComment}
          />
        </div>
      )}

    </article>
  );
});

PostCard.displayName = 'PostCard';
