import React, { useState, useRef, useEffect } from "react";
import {
  MoreHorizontal,
  Trash2,
  Edit,
  UserPlus,
  UserCheck,
  Eye,
  Plus,
  MapPin,
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
import { getDiversityBadges } from "../services/fairnessRankingService";
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
  is_following?: boolean;
  reactions?: Record<string, any>;
  reactions_total_count?: number;
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
  /** When false, follow (Tap In) button is hidden (e.g. post author allow_follows is none or friends-only). Default true. */
  canFollow?: boolean;
  /** When true, clicking the card does not navigate to the post page (e.g. when already on the detail page). */
  disablePostClick?: boolean;
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
  const closeTimeout = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const postRef = useRef<HTMLElement>(null);
  // Auto-open comments for a random subset of posts with exactly 2 comments
  const shouldAutoOpenComments = (() => {
    if ((post.comments_count || 0) !== 2) return false;
    const hash = post.id.split("").reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    return Math.abs(hash) % 3 === 0; // ~33% of eligible posts
  })();

  const [showInlineComments, setShowInlineComments] = useState(shouldAutoOpenComments);

  const [reactions, setReactions] = useState<Record<string, any> & { totalCount: number }>({
    ...(post.reactions || {}),
    totalCount: post.reactions_total_count ?? 0,
  });

  useEffect(() => {
    const handleReactionUpdate = (event: CustomEvent) => {
      if (event.detail?.postId === post.id) {
        setTimeout(async () => {
          try {
            const res = await apiClient.get<{
              data: Record<string, any>
              totalCount: number
            }>(`/api/posts/${post.id}/reaction`);
            setReactions({ ...(res.data || {}), totalCount: res.totalCount || 0 });
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

  const handleFollow = async () => {
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

  const isOwnPost = user && post.author && post.author.id === user.id;

  // Get diversity badges for this post
  const diversityBadges = getDiversityBadges({
    id: post.id,
    creator_id: post.author_id,
    creator_type:
      (post.author?.creator_type as
        | "verified"
        | "regular"
        | "underrepresented") || "regular",
    creator_region: post.author.country || undefined,
    language: post.language || "English",
    created_at: post.created_at,
    engagement_score:
      (post.likes_count || 0) * 0.3 + (post.comments_count || 0) * 0.5,
    topic_category: post.category,
  });

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "politics":
        return "bg-red-100 text-red-800";
      case "culture":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "politics":
        return "🏛️";
      case "culture":
        return "🎭";
      default:
        return "💬";
    }
  };

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
    const groups: any[] = [];
    Object.keys(reactions).forEach((key) => {
      if (key !== "totalCount") {
        const reaction = reactions[key];
        // Type guard: check if it's a ReactionGroup (has count property) and not a number
        if (reaction && typeof reaction === "object" && "count" in reaction && reaction.count > 0) {
          groups.push(reaction);
        }
      }
    });
    return groups.sort((a, b) => b.count - a.count);
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
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(
                    post.category
                  )}`}
                >
                  <span className="mr-1" role="img" aria-label={post.category}>
                    {getCategoryIcon(post.category)}
                  </span>
                  {post.category.charAt(0).toUpperCase() +
                    post.category.slice(1)}
                </span>
                {diversityBadges.map((badge, index) => (
                  <span
                    key={index}
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}
                    title={`This content is from a ${badge.label.toLowerCase()}`}
                  >
                    {badge.label}
                  </span>
                ))}
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

        {/* Tap In button or Three-dot menu */}
        {!isOwnPost && canFollow ? (
          <button
            onClick={handleFollow}
            disabled={followCheckLoading}
            className={`flex items-center space-x-1 justify-center px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors disabled:opacity-50  cursor-pointer ${
              isFollowing
                ? "bg-gray-400 text-white hover:bg-gray-600"
                : "bg-[#FF6900] text-white hover:bg-[#ea580c]"
            }`}
          >
            {followCheckLoading ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin " />
                <span>Loading...</span>
              </>
            ) : isFollowing ? (
              <>
                <UserCheck className="w-3 h-3" />
                <span>UnTap In</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3 h-3" />
                <span>Tap In</span>
              </>
            )}
          </button>
        ) : !isOwnPost && !canFollow ? null : (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
              aria-label="Post options"
            >
              <MoreHorizontal className="w-5 h-5 text-gray-600" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-34 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <button
                  onClick={handleEditClick}
                  className="w-full px-2 py-1 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2 cursor-pointer"
                >
                  <Edit className="w-3 h-3" />
                  <span>Edit Post</span>
                </button>
                <button
                  onClick={handleDeleteClick}
                  className="w-full px-2 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete Post</span>
                </button>
              </div>
            )}
          </div>
        )}
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
