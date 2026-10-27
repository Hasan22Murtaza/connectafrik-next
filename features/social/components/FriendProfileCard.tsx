import Link from "next/link";
import type { ReactNode } from "react";

interface MutualFriendPreview {
  user_id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
}

interface FriendProfileCardProps {
  userId: string;
  fullName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  bannerImage?: string | null;
  relationshipText?: string;
  location?: string;
  mutualFriends?: MutualFriendPreview[];
  className?: string;
  coverAction?: ReactNode;
  children?: ReactNode;
}

export default function FriendProfileCard({
  userId,
  fullName,
  username,
  avatarUrl,
  bannerImage,
  relationshipText,
  location,
  mutualFriends = [],
  className = "",
  coverAction,
  children,
}: FriendProfileCardProps) {
  const displayName = fullName?.trim() || "Unknown User";
  const initials =
    displayName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "U";

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-surface ${className}`}
    >
      <Link
        href={`/user/${userId}`}
        aria-label={`View ${displayName}'s profile`}
        className="relative block aspect-[1.8/1] overflow-hidden bg-gradient-to-br from-orange-200 via-amber-100 to-orange-300"
      >
        <img
          src={bannerImage || "/assets/images/no-cover.svg"}
          alt=""
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
      </Link>

      {coverAction && (
        <div className="absolute right-2 top-2 z-10">{coverAction}</div>
      )}

      <div className="relative z-10 -mt-7 ml-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-orange-100 shadow-md dark:border-surface">
        <span className="text-lg font-bold text-orange-700">{initials}</span>
        {avatarUrl && (
          <img
            src={avatarUrl}
            alt={displayName}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
            className="absolute inset-0 h-full w-full rounded-full object-cover"
          />
        )}
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-2">
        <Link href={`/user/${userId}`}>
          <h3 className="truncate text-sm font-bold text-content transition-colors hover:text-orange-500">
            {displayName}
          </h3>
        </Link>

        {(username || location) && (
          <div className="mt-0.5 mb-3 flex min-w-0 items-center gap-1 truncate text-xs text-content-secondary">
            {username && (
              <span className="truncate">
                @{username.replace(/^@/, "")}
              </span>
            )}

            {username && location && <span>·</span>}

            {location && (
              <span className="truncate">
                {location}
              </span>
            )}
          </div>
        )}


        {(relationshipText || mutualFriends.length > 0) && (
          <div className="mb-2 flex min-h-7 items-center gap-2">
            {mutualFriends.length > 0 && (
              <div className="flex shrink-0 -space-x-2">
                {mutualFriends.slice(0, 3).map((friend, index) => {
                  const friendName = friend.full_name || friend.username || "Mutual friend";
                  const fallbackAvatar = "/assets/images/profile-dp.svg";

                  return (
                    <Link
                      key={friend.user_id}
                      href={`/user/${friend.user_id}`}
                      aria-label={`View ${friendName}'s profile`}
                      className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-orange-100 text-[10px] font-semibold text-orange-700 shadow-sm dark:border-surface"
                      style={{ zIndex: 3 - index }}
                    >
                      <img
                        src={friend.avatar_url || fallbackAvatar}
                        alt={friendName}
                        onError={(event) => {
                          if (event.currentTarget.src.endsWith(fallbackAvatar)) return;
                          event.currentTarget.src = fallbackAvatar;
                        }}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </Link>
                  );
                })}
              </div>
            )}
            {relationshipText && (
              <p className="min-w-0 truncate text-xs text-content-secondary">
                {relationshipText}
              </p>
            )}
          </div>
        )}

        {children && <div className="mt-auto">{children}</div>}
      </div>
    </article>
  );
}
