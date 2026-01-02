import React, { useState, useRef, useEffect } from "react";
import {
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  ThumbsUp,
  Smile,
  Trash2,
  Edit,
  UserPlus,
  UserCheck,
  Eye,
  Share,
  ShareIcon,
  Plus,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import EmojiPicker from "@/shared/components/ui/EmojiPicker";
import { useAuth } from "@/contexts/AuthContext";
import {
  followUser,
  unfollowUser,
  checkIsFollowing,
} from "../services/followService";
import { supabase } from "@/lib/supabase";
import { getDiversityBadges } from "../services/fairnessRankingService";
import { DwellTimeTracker } from "../services/engagementTracking";
import toast from "react-hot-toast";
import { PiShareFatLight } from "react-icons/pi";
import dynamic from "next/dynamic";
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
  likes_count: number;
  comments_count: number;
  shares_count: number;
  views_count: number;
  language?: string;
  created_at: string;
  isLiked?: boolean;
}

interface PostCardProps {
  post: Post;
  onLike: (postId: string) => void;
  onComment: (postId: string) => void;
  onShare: (postId: string) => void;
  onDelete?: (postId: string) => void;
  onEdit?: (postId: string, newContent: string) => void;
  onView?: (postId: string) => void;
  onEmojiReaction?: (postId: string, emoji: string) => void;
  showEmojiPicker?: boolean;
  postReactions?: { [emoji: string]: string[] };
  isPostLiked?: boolean;
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

export const PostCard: React.FC<PostCardProps> = ({
  post,
  onLike,
  onComment,
  onShare,
  onDelete,
  onEdit,
  onView,
  onEmojiReaction,
  postReactions = {},
  isPostLiked = false,
}) => {
  const { user } = useAuth();
  const router = useRouter();
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isFollowing, setIsFollowing] = useState(false);
  const [followCheckLoading, setFollowCheckLoading] = useState(true);
  const [hasViewed, setHasViewed] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const closeTimeout = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const postRef = useRef<HTMLElement>(null);
  const dwellTrackerRef = useRef<DwellTimeTracker | null>(null);

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

  // Check if current user is following the post author
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!user || !post.author?.id || user.id === post.author.id) {
        setFollowCheckLoading(false);
        return;
      }

      try {
        const following = await checkIsFollowing(user.id, post.author.id);
        setIsFollowing(following);
      } catch (error) {
        console.error("Error checking follow status:", error);
      } finally {
        setFollowCheckLoading(false);
      }
    };

    checkFollowStatus();
  }, [user, post.author?.id]);

  // Track view when post comes into view
  useEffect(() => {
    if (!user || hasViewed || !onView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasViewed) {
            setHasViewed(true);
            onView(post.id);
          }
        });
      },
      { threshold: 0.5 } // Trigger when 50% of post is visible
    );

    if (postRef.current) {
      observer.observe(postRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [user, hasViewed, onView, post.id]);

  const quickReactions = [
    "\u{1F44D}",
    "\u2764\uFE0F",
    "\u{1F602}",
    "\u{1F62E}",
    "\u{1F622}",
    "\u{1F621}",
    "\u{1F525}",
    "\u{1F44F}",
    "\u{1F64C}",
    "\u{1F389}",
    "\u{1F4AF}",
    "\u{1F60E}",
    "\u{1F973}",
    "\u{1F929}",
    "\u{1F606}",
    "\u{1F60F}",
    "\u{1F607}",
    "\u{1F61C}",
    "\u{1F914}",
    "\u{1F631}",
    "\u{1F624}",
    "\u{1F605}",
    "\u{1F60B}",
    "\u{1F62C}",
    "\u{1F603}",
  ];

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
          // Check if already following (failed because duplicate)
          const stillFollowing = await checkIsFollowing(
            user.id,
            post.author.id
          );
          if (stillFollowing) {
            setIsFollowing(true);
            toast.success("Already tapped in!");
          } else {
            toast.error("Failed to tap in");
          }
        }
      }
    } catch (error) {
      console.error("Error handling follow:", error);
      toast.error("Something went wrong");
    }
  };

  // Navigate to user profile
  const handleUserProfileClick = () => {
    router.push(`/user/${post.author.username}`);
  };

  // Handle edit post
  const handleEditClick = () => {
    setEditContent(post.content);
    setIsEditing(true);
    setShowMenu(false);
  };

  const handleSaveEdit = async () => {
    try {
      const { error } = await supabase
        .from("posts")
        .update({
          content: editContent,
          updated_at: new Date().toISOString(),
        })
        .eq("id", post.id);

      if (error) throw error;

      // Update the post in the parent component
      if (onEdit) {
        onEdit(post.id, editContent);
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
    setEditContent("");
  };

  // Check if user is following the post author on mount
  // Track dwell time for engagement
  useEffect(() => {
    if (user?.id && post.id) {
      dwellTrackerRef.current = new DwellTimeTracker(post.id, user.id);
      dwellTrackerRef.current.start();
    }

    return () => {
      dwellTrackerRef.current?.cleanup();
    };
  }, [post.id, user?.id]);

  useEffect(() => {
    const checkFollowStatus = async () => {
      if (user && post.author && user.id !== post.author.id) {
        const following = await checkIsFollowing(user.id, post.author.id);
        setIsFollowing(following);
      }
    };
    checkFollowStatus();
  }, [user, post.author?.id]);

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

  const isImageFile = (url: string): boolean => {
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url);
  };

  const isVideoFile = (url: string): boolean => {
    return /\.(mp4|webm|ogg|avi|mov|wmv|flv|mkv)$/i.test(url);
  };

  const renderMedia = (url: string, index: number) => {
    if (isImageFile(url)) {
      return (
        <img
          src={url}
          alt={`Post media ${index + 1}`}
          className="w-full h-auto max-h-96 object-cover"
          loading="lazy"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = "none";
          }}
        />
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

  return (
    <article
      ref={postRef}
      className="card mb-4 sm:mb-6 hover:shadow-md transition-shadow duration-200 bg-white rounded-lg border border-gray-200 p-3 sm:p-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <button
            onClick={handleUserProfileClick}
            className="flex items-center space-x-3 flex-1 min-w-0 "
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
                <h3 className="font-semibold text-gray-900 truncate text-sm sm:text-base">
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
              </div>
            </div>
          </button>
        </div>

        {/* Tap In button or Three-dot menu */}
        {!isOwnPost ? (
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
        ) : (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
              aria-label="Post options"
            >
              <MoreHorizontal className="w-5 h-5 text-gray-600" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <button
                  onClick={handleEditClick}
                  className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center space-x-2 cursor-pointer"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit Post</span>
                </button>
                <button
                  onClick={handleDeleteClick}
                  className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 flex items-center space-x-2 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Post</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {isEditing ? (
        /* Edit form */
        <div className="mb-4">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            rows={4}
            placeholder="What's on your mind?"
          />
          <div className="flex justify-end space-x-2 mt-2">
            <button
              onClick={handleCancelEdit}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
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
            <div className="mb-4">
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

      {/* Media */}
      {post.media_urls && post.media_urls.length > 0 && (
        <div className="mb-4">
          <div
            className={`grid gap-3 ${
              post.media_urls.length === 1
                ? "grid-cols-1"
                : "grid-cols-1 sm:grid-cols-2"
            }`}
          >
            {post.media_urls.map((url, index) => (
              <div
                key={`${post.id}-media-${index}`}
                className="rounded-lg overflow-hidden"
              >
                {renderMedia(url, index)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reaction display */}
      {Object.keys(postReactions).length > 0 && (
        <div className="flex items-center space-x-1 justify-center mb-3 p-2 bg-gray-50 rounded-lg">
          {Object.entries(postReactions).map(([emoji, users]) => (
            <div key={emoji} className="relative group">
              <span
                className="text-lg cursor-pointer hover:scale-110 transition-transform emoji"
                onMouseEnter={() => handleEmojiHover(emoji)}
                onMouseLeave={handleEmojiLeave}
              >
                {emoji}
              </span>

              {/* Hover tooltip showing users who reacted */}
              {hoveredEmoji === emoji && users.length > 0 && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
                  <div className="bg-gray-800 text-white rounded-lg p-3 shadow-lg min-w-48">
                    <div className="font-semibold text-sm mb-2">
                      <span className="emoji">{emoji}</span> {users.length}{" "}
                      reaction{users.length !== 1 ? "s" : ""}
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {users.map((user, index) => (
                        <div key={index} className="text-sm text-gray-200">
                          {user}
                        </div>
                      ))}
                    </div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                  </div>
                </div>
              )}
            </div>
          ))}
          <span className="text-sm text-gray-600 ml-2">
            {Object.values(postReactions).flat().length}
          </span>
        </div>
      )}

      <div>
        <div className="flex justify-between items-center pb-2">
          <div>
            {post.likes_count && (
              <span className=" hover:underline cursor-pointer text-gray-600 text-sm">
                likes {post.likes_count}
              </span>
            )}
          </div>
          <div className="space-x-2">
            {post.views_count > 0 && (
              <span className=" hover:underline cursor-pointer text-gray-600 text-sm ">
                Watch {post.views_count || 0}
              </span>
            )}
            {post.comments_count > 0 && (
              <span className=" hover:underline cursor-pointer text-gray-600 text-sm "  onClick={(e) => {
                e.stopPropagation();
                onComment(post.id);
              }}>
                Comment {post.comments_count}
              </span>
            )}
            {post.shares_count > 0 && (
              <span className=" hover:underline cursor-pointer text-gray-600 text-sm ">
                Share {post.shares_count}
              </span>
            )}
          </div>
        </div>
        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        

          {/* React button with hover emoji picker */}
          <div className="relative flex-1">
            <button
              onMouseEnter={handleReactHover}
              onMouseLeave={handleReactLeave}
              className="flex  items-center justify-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors duration-200 cursor-pointer"
              aria-label="React to post"
            >
              <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs sm:text-sm font-medium">React</span>
            </button>

           
            {showReactionPicker && (
              <div 
                className="absolute bottom-full left-0 mb-2 z-50"
                onMouseEnter={handleReactHover}
                onMouseLeave={handleReactLeave}
              >
                <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-1 sm:p-2">
                  <div className="flex space-x-1 overflow-x-auto scrollbar-hide max-w-xs px-1">
                    {quickReactions.slice(0,6).map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          onEmojiReaction?.(post.id, emoji)
                          setShowReactionPicker(false)
                        }}
                        className="w-6 h-6 sm:w-8 sm:h-8 text-sm sm:text-lg hover:scale-125 transition-transform cursor-pointer flex-shrink-0"
                      >
                        <span className="emoji">{emoji}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>


          <button
            onClick={() => onComment(post.id)}
            className="flex flex-1 items-center justify-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors duration-200"
            aria-label="Comment on post"
          >
            <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-base sm:text-sm ">Comments</span>
          </button>

          <button
            onClick={() => onShare(post.id)}
            className="flex flex-1 items-center justify-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-gray-600 hover:text-green-600 hover:bg-green-50 transition-colors duration-200"
            aria-label="Share post"
          >
            <PiShareFatLight className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-base sm:text-sm font-medium">Share</span>
          </button>
        </div>
      </div>

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
    </article>
  );
};
