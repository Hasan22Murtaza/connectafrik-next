"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useProductionChat } from "@/contexts/ProductionChatContext";
import { apiClient } from "@/lib/api-client";
import {
  BirthdayListShimmer,
  FriendProfileCardsShimmer,
  useShimmerCount,
} from "@/shared/components/ui/ShimmerLoaders";
import { Friend, FriendRequest } from "@/shared/types";
import FriendsSidebar, { type FriendsSection } from "@/features/social/components/FriendsSidebar";
import FriendProfileCard from "@/features/social/components/FriendProfileCard";
import { friendRequestService } from "@/features/social/services/friendRequestService";
import { useConfirmDialog } from "@/shared/components/ui/ConfirmDialog";
import {
  Cake,
  ChevronDown,
  ChevronRight,
  Clock,
  Gift,
  PartyPopper,
  Search,
  Users,
  X,
} from '@/shared/icons';
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";



type BirthdayProfileRow = {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
  banner_image?: string | null;
  birthday: string;
};

function mapBirthdayProfileToFriend(p: BirthdayProfileRow): Friend {
  return {
    id: p.id,
    username: p.username,
    full_name: p.full_name,
    avatar_url: p.avatar_url ?? undefined,
    banner_image: p.banner_image ?? null,
    birthday: p.birthday,
  };
}

function getBirthdayDate(friend: Friend, from = new Date()) {
  const [, month, day] = String(friend.birthday).split("-").map(Number);
  let birthday = new Date(from.getFullYear(), month - 1, day, 0, 0, 0, 0);
  if (birthday <= from) birthday = new Date(from.getFullYear() + 1, month - 1, day, 0, 0, 0, 0);
  return birthday;
}

function formatCountdown(target: Date, now: Date) {
  let months = 0;
  const addMonths = (date: Date, count: number) => {
    const result = new Date(date);
    const day = result.getDate();
    result.setDate(1);
    result.setMonth(result.getMonth() + count);
    const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(day, lastDay));
    return result;
  };
  while (addMonths(now, months + 1) <= target) months += 1;

  const monthRemainder = addMonths(now, months);
  const totalSeconds = Math.max(0, Math.floor((target.getTime() - monthRemainder.getTime()) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { months, days, hours, minutes, seconds };
}

type Section = FriendsSection;
type RequestsView = "received" | "pending";
const FRIENDS_SECTIONS: Section[] = ["home", "requests", "suggestions", "all", "birthdays"];

type MutualFriendPreview = {
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
};

type SentFriendRequest = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  receiver?: {
    id: string;
    username: string;
    full_name: string;
    avatar_url?: string | null;
    banner_image?: string | null;
    country?: string | null;
  } | null;
  mutualFriendsCount?: number;
  mutual_friends_count?: number;
  mutual_friends?: MutualFriendPreview[];
};

type FriendSuggestion = {
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  banner_image?: string | null;
  location?: string | null;
  country?: string | null;
  mutual_friends_count: number;
  mutual_friends?: Array<{
    user_id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
  }>;
};

function parseFriendsSection(tab: string | null): Section | null {
  if (tab && FRIENDS_SECTIONS.includes(tab as Section)) return tab as Section
  return null
}

function RequestsViewTabs({
  view,
  onChange,
  receivedCount,
  pendingCount,
}: {
  view: RequestsView;
  onChange: (view: RequestsView) => void;
  receivedCount: number;
  pendingCount: number;
}) {
  return (
    <div className="mb-6 border-b border-border">
      <div className="flex gap-1 -mb-px overflow-x-auto scrollbar-hide">
        {([
          { key: "received", label: "Received", count: receivedCount },
          { key: "pending", label: "Pending", count: pendingCount },
        ] as const).map((tab) => {
          const isActive = view === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`relative shrink-0 px-4 py-2.5 text-sm font-semibold transition-colors ${isActive ? "text-primary-600" : "text-content-secondary hover:text-content"
                }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`ml-1.5 tabular-nums ${isActive ? "text-primary-600" : "text-content-tertiary"
                    }`}
                >
                  ({tab.count})
                </span>
              )}
              {isActive && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary-600 w-full left-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SentRequestCard({
  request,
  cancelling,
  onCancel,
}: {
  request: SentFriendRequest;
  cancelling: boolean;
  onCancel: () => void;
}) {
  const profile = request.receiver;
  const userId = request.receiver_id || profile?.id || "";
  const mutualCount = request.mutual_friends_count ?? request.mutualFriendsCount ?? 0;
  const relationshipText = mutualCount > 0
    ? `${mutualCount} mutual ${mutualCount === 1 ? "friend" : "friends"}`
    : "Request pending";

  return (
    <FriendProfileCard
      userId={userId}
      fullName={profile?.full_name}
      username={profile?.username}
      avatarUrl={profile?.avatar_url}
      bannerImage={profile?.banner_image}
      relationshipText={relationshipText}
      mutualFriends={request.mutual_friends ?? []}
    >
      <div className="flex flex-col gap-2">
        <Link
          href={`/user/${userId}`}
          className="flex w-full items-center justify-center rounded-full bg-[#ff6900] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#e85f00]"
        >
          View Profile
        </Link>
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelling}
          className="w-full rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-content-secondary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cancelling ? "Cancelling..." : "Cancel request"}
        </button>
      </div>
    </FriendProfileCard>
  );
}

function ReceivedRequestCard({
  request,
  onAccept,
  onDecline,
}: {
  request: FriendRequest;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const profile = request.requester;
  const mutualCount = request.mutual_friends_count ?? request.mutualFriendsCount ?? 0;
  const relationshipText = mutualCount > 0
    ? `${mutualCount} mutual ${mutualCount === 1 ? "friend" : "friends"}`
    : "Wants to connect with you";

  return (
    <FriendProfileCard
      userId={request.requester_id}
      fullName={profile?.full_name}
      username={profile?.username}
      avatarUrl={profile?.avatar_url}
      bannerImage={profile?.banner_image}
      location={profile?.country}
      relationshipText={relationshipText}
      mutualFriends={request.mutual_friends ?? []}
    >
      <div className="flex gap-2 flex-col">
        <button
          type="button"
          onClick={onAccept}
          className="flex-1  rounded-full bg-[#ff6900] px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#e85f00]"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={onDecline}
          className="flex-1  rounded-full border border-border px-3 py-2.5 text-sm font-semibold text-content-secondary transition-colors hover:bg-surface-hover"
        >
          Delete
        </button>
      </div>
    </FriendProfileCard>
  );
}

function SuggestionCard({
  suggestion,
  sending,
  onSend,
  onDismiss,
}: {
  suggestion: FriendSuggestion;
  sending: boolean;
  onSend: () => void;
  onDismiss: () => void;
}) {
  const relationshipText = suggestion.mutual_friends_count > 0
    ? `${suggestion.mutual_friends_count} mutual ${suggestion.mutual_friends_count === 1 ? "friend" : "friends"}`
    : "Suggested for you";

  return (
    <FriendProfileCard
      userId={suggestion.user_id}
      fullName={suggestion.full_name}
      username={suggestion.username}
      avatarUrl={suggestion.avatar_url}
      bannerImage={suggestion.banner_image}
      location={suggestion.country ?? undefined}
      relationshipText={relationshipText}
      mutualFriends={suggestion.mutual_friends ?? []}
      coverAction={
        <button
          type="button"
          onClick={onDismiss}
          aria-label={`Remove ${suggestion.full_name} from suggestions`}
          title="Remove suggestion"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-[opacity,background-color] group-hover:opacity-100 hover:bg-black/75 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      }
    >
      <button
        type="button"
        onClick={onSend}
        disabled={sending}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-[#ff6900] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#e85f00] hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sending ? "Sending..." : "Link up"}
      </button>
      <Link
        href={`/user/${suggestion.user_id}`}
        className="mt-2.5 flex w-full items-center justify-center rounded-full bg-[#eef2ff] px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-[#e0e7ff] dark:bg-white/10 dark:text-content dark:hover:bg-white/15"
      >
        View Profile
      </Link>
    </FriendProfileCard>
  );
}

const FriendsPageContent: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { startChatWithMembers, openThread } = useProductionChat();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<SentFriendRequest[]>([]);
  const [sentLoading, setSentLoading] = useState(false);
  const [requestsView, setRequestsView] = useState<RequestsView>("received");
  const [cancellingRequests, setCancellingRequests] = useState<Set<string>>(new Set());
  const [removingFriends, setRemovingFriends] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [sendingRequests, setSendingRequests] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestionsSearchTerm, setSuggestionsSearchTerm] = useState("");
  const [requestsDisplayLimit, setRequestsDisplayLimit] = useState(20);
  const [suggestionsDisplayLimit, setSuggestionsDisplayLimit] = useState(20);
  const [activeSection, setActiveSection] = useState<Section>(
    () => parseFriendsSection(searchParams.get("tab")) ?? "all"
  );
  const [birthdayDisplayLimit, setBirthdayDisplayLimit] = useState(10);
  const [birthdayTabFriends, setBirthdayTabFriends] = useState<Friend[]>([]);
  const [birthdaysLoading, setBirthdaysLoading] = useState(false);
  const [countdownFriend, setCountdownFriend] = useState<Friend | null>(null);
  const [countdownNow, setCountdownNow] = useState(() => new Date());
  const birthdaySentinelRef = useRef<HTMLDivElement>(null);
  const shimmerCount = useShimmerCount();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  // Categories for Birthdays tab (data loaded from /api/friends/birthdays when tab is opened)
  const birthdayFriends = useMemo(() => {
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();
    const currentYear = today.getFullYear();

    const todayList: Friend[] = [];
    const thisMonthList: Friend[] = [];
    const upcomingList: Friend[] = [];

    birthdayTabFriends.forEach((friend) => {
      if (!friend.birthday) return;

      const parts = String(friend.birthday).split("-");
      if (parts.length < 3) return;

      const bMonth = parseInt(parts[1], 10);
      const bDay = parseInt(parts[2], 10);

      if (bMonth === todayMonth && bDay === todayDay) {
        todayList.push(friend);
      } else if (bMonth === todayMonth && bDay > todayDay) {
        thisMonthList.push(friend);
      } else {
        upcomingList.push(friend);
      }
    });

    const sortByNextBirthday = (a: Friend, b: Friend) => {
      const getNext = (f: Friend) => {
        const p = String(f.birthday).split("-");
        const m = parseInt(p[1], 10);
        const d = parseInt(p[2], 10);
        let next = new Date(currentYear, m - 1, d);
        if (next < today) next = new Date(currentYear + 1, m - 1, d);
        return next.getTime();
      };
      return getNext(a) - getNext(b);
    };

    thisMonthList.sort(sortByNextBirthday);
    upcomingList.sort(sortByNextBirthday);

    return { today: todayList, thisMonth: thisMonthList, upcoming: upcomingList };
  }, [birthdayTabFriends]);

  // Flat list of all birthday friends for pagination
  const allBirthdayFriends = useMemo(
    () => [...birthdayFriends.today, ...birthdayFriends.thisMonth, ...birthdayFriends.upcoming],
    [birthdayFriends]
  );


  const hasMoreBirthdays = birthdayDisplayLimit < allBirthdayFriends.length;

  const countdownTarget = countdownFriend ? getBirthdayDate(countdownFriend, countdownNow) : null;
  const countdown = countdownTarget ? formatCountdown(countdownTarget, countdownNow) : null;

  useEffect(() => {
    if (!countdownFriend) return;
    const interval = window.setInterval(() => setCountdownNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, [countdownFriend]);

  useEffect(() => {
    if (!countdownFriend) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCountdownFriend(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [countdownFriend]);

  const openBirthdayCountdown = (friend: Friend) => {
    setCountdownNow(new Date());
    setCountdownFriend(friend);
  };

  const selectSection = (section: Section) => {
    setActiveSection(section);
    const next = `/friends?tab=${section}`;
    router.replace(next, { scroll: false });
  };

  useEffect(() => {
    const section = parseFriendsSection(searchParams.get("tab"));
    if (section) {
      setActiveSection(section);
    } else if (!searchParams.get("tab")) {
      setActiveSection("all");
    }
  }, [searchParams]);

  // Reset pagination when switching to birthdays
  useEffect(() => {
    if (activeSection === "birthdays") {
      setBirthdayDisplayLimit(10);
    }
  }, [activeSection]);

  // IntersectionObserver for infinite scroll on birthdays
  useEffect(() => {
    if (activeSection !== "birthdays" || !hasMoreBirthdays) return;

    const sentinel = birthdaySentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setBirthdayDisplayLimit((prev) => prev + 10);
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeSection, hasMoreBirthdays]);

  useEffect(() => {
    if (!user) return;
    if (activeSection === "home") {
      fetchFriends();
      fetchFriendRequests();
      fetchSentRequests();
      fetchSuggestions();
    } else if (activeSection === "all") {
      fetchFriends();
    } else if (activeSection === "requests") {
      fetchFriendRequests();
      fetchSentRequests();
    } else if (activeSection === "suggestions") {
      fetchSuggestions();
    }
  }, [user, activeSection]);

  useEffect(() => {
    if (!user) return;
    setFriends([]);
    setRequests([]);
    setSentRequests([]);
    setSuggestions([]);
    setBirthdayTabFriends([]);
    setLoading(false);
    setFriendsLoading(false);
    setSuggestionsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (activeSection !== "birthdays") return;

    let cancelled = false;

    const loadBirthdays = async () => {
      setBirthdaysLoading(true);
      try {
        const rows = await fetchAllPages<BirthdayProfileRow>("/api/friends/birthdays", 50);
        if (!cancelled) {
          setBirthdayTabFriends(rows.map(mapBirthdayProfileToFriend));
        }
      } catch (error) {
        console.error("Error fetching birthdays:", error);
        if (!cancelled) {
          setBirthdayTabFriends([]);
          toast.error("Could not load birthdays");
        }
      } finally {
        if (!cancelled) setBirthdaysLoading(false);
      }
    };

    loadBirthdays();
    return () => {
      cancelled = true;
    };
  }, [user?.id, activeSection]);

  useEffect(() => {
    if (activeSection === "home") {
      setRequestsDisplayLimit(20);
      setSuggestionsDisplayLimit(20);
    }
  }, [activeSection]);

  useEffect(() => {
    setRequestsDisplayLimit(20);
  }, [requestsView]);

  const fetchAllPages = async <T,>(
    endpoint: string,
    limit: number = 50
  ): Promise<T[]> => {
    const allItems: T[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const res = await apiClient.get<{ data: T[]; hasMore?: boolean }>(endpoint, { page, limit });
      const items = res.data || [];
      allItems.push(...items);
      hasMore = Boolean(res.hasMore);
      page += 1;
      if (items.length === 0) break;
    }

    return allItems;
  };

  const fetchFriends = async () => {
    try {
      if (!user?.id) return;
      setFriendsLoading(true);
      const allFriends = await fetchAllPages<Friend>("/api/friends", 20);
      setFriends(allFriends);
    } catch (error: any) {
      console.error("Error fetching friends:", error);
    } finally {
      setFriendsLoading(false);
    }
  };

  const fetchFriendRequests = async () => {
    try {
      setLoading(true);
      if (!user?.id) return;

      const allRequests = await fetchAllPages<any>("/api/friends/requests", 20);
      const mappedData = allRequests.map((req: any) => ({
        ...req,
        requester_id: req.sender_id || req.requester_id,
        recipient_id: req.receiver_id || req.recipient_id,
        requester: req.requester || req.sender,
      }));

      setRequests(mappedData);
    } catch (error: any) {
      console.error("Error fetching friend requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSentRequests = async () => {
    try {
      if (!user?.id) return;
      setSentLoading(true);
      const allSent = await fetchAllPages<SentFriendRequest>("/api/friends/requests/sent", 20);
      setSentRequests(allSent);
    } catch (error) {
      console.error("Error fetching sent friend requests:", error);
    } finally {
      setSentLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await apiClient.patch(`/api/friends/requests/${requestId}`, { status: "accepted" });
      toast.success("Friend request accepted!");
      fetchFriendRequests();
      fetchFriends();
    } catch (error: any) {
      console.error("Error accepting request:", error);
      toast.error(error?.message || "Failed to accept request");
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      await apiClient.patch(`/api/friends/requests/${requestId}`, { status: "declined" });
      toast.success("Friend request declined");
      fetchFriendRequests();
    } catch (error: any) {
      console.error("Error declining request:", error);
      toast.error("Failed to decline request");
    }
  };

  const handleCancelSentRequest = async (requestId: string) => {
    try {
      setCancellingRequests((prev) => new Set(prev).add(requestId));
      await apiClient.delete(`/api/friends/requests/${requestId}`);
      setSentRequests((prev) => prev.filter((request) => request.id !== requestId));
      toast.success("Friend request cancelled");
    } catch (error) {
      console.error("Error cancelling friend request:", error);
      toast.error("Failed to cancel request");
    } finally {
      setCancellingRequests((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  const handleRemoveFriend = async (friend: Friend) => {
    const confirmed = await confirm({
      title: "Remove friend",
      message: `Are you sure you want to remove ${friend.full_name} from your friends?`,
      confirmLabel: "Remove friend",
      variant: "danger",
    });
    if (!confirmed) return;

    setRemovingFriends((current) => new Set(current).add(friend.id));
    const result = await friendRequestService.removeFriend(friend.id);
    if (result.success) {
      setFriends((current) => current.filter((currentFriend) => currentFriend.id !== friend.id));
      toast.success(`${friend.full_name} removed from your friends`);
    } else {
      toast.error(result.error || "Failed to remove friend");
    }
    setRemovingFriends((current) => {
      const next = new Set(current);
      next.delete(friend.id);
      return next;
    });
  };

  const fetchSuggestions = async () => {
    if (!user?.id) return;

    try {
      setSuggestionsLoading(true);
      const allSuggestions = await fetchAllPages<any>("/api/friends/suggestions", 50);
      setSuggestions(allSuggestions);
    } catch (error) {
      console.error('Error in fetchSuggestions:', error);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleDismissSuggestion = (userId: string) => {
    setSuggestions((current) => current.filter((suggestion) => suggestion.user_id !== userId));
  };

  const handleStartBirthdayChat = async (friend: Friend) => {
    if (!user) return;

    try {
      const chatParticipant = {
        id: friend.id,
        name: friend.full_name,
        avatarUrl: friend.avatar_url || undefined,
      };

      const threadId = await startChatWithMembers([chatParticipant], {
        participant_ids: [friend.id],
        openInDock: true,
      });

      if (threadId) {
        openThread(threadId);
      }
    } catch (error) {
      console.error("Error starting birthday chat:", error);
      toast.error("Failed to open chat");
    }
  };

  const handleSendFriendRequest = async (userId: string) => {
    if (!user) return;

    setSendingRequests(prev => new Set(prev).add(userId));

    try {
      await apiClient.post('/api/friends', { receiver_id: userId });

      setSuggestions(prev => prev.filter(rec => rec.user_id !== userId));
      toast.success('Friend request sent!');
      fetchSentRequests();
    } catch (error: any) {
      console.error('Error sending friend request:', error);
      toast.error(error.message || 'Failed to send friend request');
    } finally {
      setSendingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const filteredFriends = friends.filter(
    (friend) =>
      friend.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      friend.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSuggestions = suggestions.filter(
    (suggestion) =>
      suggestion.full_name?.toLowerCase().includes(suggestionsSearchTerm.toLowerCase()) ||
      suggestion.username?.toLowerCase().includes(suggestionsSearchTerm.toLowerCase())
  );



  return (
    <div className="min-h-screen sm:p-0 p-2">
      <div className="flex gap-4 sm:pb-0 pb-18 md:min-h-[calc(100dvh-4rem)]">
        {/* Left Sidebar */}
        <aside className="fixed top-[55px] hidden h-[calc(100dvh-73px)]  shrink-0 self-start overflow-y-auto  bg-background  md:block">
          <FriendsSidebar
            activeSection={activeSection}
            requestCount={requests.length}
            onSectionSelect={selectSection}
          />
        </aside>

        {/* Main Content */}
        <div className="flex-1 max-w-full py-3 sm:py-6 pr-4 md:ml-64">
          <div className="flex gap-2 sm:hidden overflow-x-auto w-full pb-5  scrollbar-hide">
            {/* We use inline-flex + min-w-fit to prevent shrinking */}
            <button
              onClick={() => selectSection("all")}
              className={`min-w-fit   text-center rounded-full px-3 py-1.5 font-medium transition-colors
                 ${activeSection === "home" || activeSection === "all" ?
                  " border border-orange-500 bg-orange-100 text-orange-500" : "text-content bg-surface-tertiary"
                }`}
            >
              All friends
            </button>

            <button
              onClick={() => selectSection("suggestions")}
              className={`min-w-fit flex-shrink-0  text-center rounded-full px-4 py-2 font-medium transition-colors 
                ${activeSection === "suggestions" ? " border border-orange-500 bg-orange-100 text-orange-500" : "text-content bg-surface-tertiary"
                }`}
            >
              Friend suggestions
            </button>

            {(loading || sentLoading || requests.length > 0 || sentRequests.length > 0) && (
              <button
                onClick={() => selectSection("requests")}
                className={`min-w-fit flex-shrink-0  text-center rounded-full px-4 py-2 font-medium transition-colors ${activeSection === "requests" ? "border border-orange-500 bg-orange-100 text-orange-500" : "text-content bg-surface-tertiary"
                  }`}
              >
                Friend requests
                {requests.length > 0 && (
                  <span className="ml-2 bg-orange-600 text-white text-xs px-2 py-0.5 rounded-full ">
                    {requests.length}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => selectSection("birthdays")}
              className={`min-w-fit flex-shrink-0  text-center rounded-full px-4 py-2 font-medium transition-colors ${activeSection === "birthdays" ? "border border-orange-500 bg-orange-100 text-orange-500" : "text-content bg-surface-tertiary"
                }`}
            >
              Birthdays
            </button>
          </div>
          {activeSection === "home" ? (
            <div className="space-y-8">
              {/* Friend Requests Section — only shown when loading or there are requests */}
              {(loading || sentLoading || requests.length > 0 || sentRequests.length > 0) && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="sm:text-2xl font-semibold text-content text-lg">Friend Requests</h2>
                    <button
                      onClick={() => selectSection("requests")}
                      className="text-primary-600 hover:text-orange-700 font-medium hover:underline duration-300 "
                    >
                      See all
                    </button>
                  </div>

                  <RequestsViewTabs
                    view={requestsView}
                    onChange={setRequestsView}
                    receivedCount={requests.length}
                    pendingCount={sentRequests.length}
                  />

                  {requestsView === "pending" ? (
                    sentLoading ? (
                      <FriendProfileCardsShimmer count={shimmerCount * 2} />
                    ) : sentRequests.length > 0 ? (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {sentRequests.slice(0, requestsDisplayLimit).map((request) => (
                            <SentRequestCard
                              key={request.id}
                              request={request}
                              cancelling={cancellingRequests.has(request.id)}
                              onCancel={() => handleCancelSentRequest(request.id)}
                            />
                          ))}
                        </div>
                        {sentRequests.length > requestsDisplayLimit && (
                          <div className="flex justify-center mt-6">
                            <button
                              onClick={() => setRequestsDisplayLimit(prev => prev + 20)}
                              className="flex items-center space-x-1 text-primary-600 hover:text-orange-700 font-medium"
                            >
                              <span>See more</span>
                              <ChevronDown className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-12 bg-surface rounded-lg">
                        <Clock className="w-16 h-16 text-content-tertiary mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-content mb-2">
                          No pending requests
                        </h3>
                        <p className="text-content-secondary">
                          Friend requests you send will appear here.
                        </p>
                      </div>
                    )
                  ) : loading ? (
                    <FriendProfileCardsShimmer count={shimmerCount * 2} />
                  ) : requests.length > 0 ? (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {requests.slice(0, requestsDisplayLimit).map((request) => (
                          <ReceivedRequestCard
                            key={request.id}
                            request={request}
                            onAccept={() => handleAcceptRequest(request.id)}
                            onDecline={() => handleDeclineRequest(request.id)}
                          />
                        ))}
                      </div>
                      {requests.length > requestsDisplayLimit && (
                        <div className="flex justify-center mt-6">
                          <button
                            onClick={() => setRequestsDisplayLimit(prev => prev + 20)}
                            className="flex items-center space-x-1 text-primary-600 hover:text-orange-700 font-medium"
                          >
                            <span>See more</span>
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12 bg-surface rounded-lg">
                      <Clock className="w-16 h-16 text-content-tertiary mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-content mb-2">
                        No friend requests
                      </h3>
                      <p className="text-content-secondary">You&apos;re all caught up!</p>
                    </div>
                  )}
                </div>
              )}

              {/* People You May Know Section */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="sm:text-2xl font-semibold text-content text-lg">People You May Know</h2>
                  <button
                    onClick={() => selectSection("suggestions")}
                    className="text-primary-600 hover:text-orange-700 font-medium hover:underline duration-300 "
                  >
                    See all
                  </button>
                </div>

                {/* Suggestions Grid */}
                {suggestionsLoading ? (
                  <FriendProfileCardsShimmer count={shimmerCount * 2} />
                ) : suggestions.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {suggestions.slice(0, suggestionsDisplayLimit).map((suggestion) => (
                        <SuggestionCard
                          key={suggestion.user_id}
                          suggestion={suggestion}
                          sending={sendingRequests.has(suggestion.user_id)}
                          onSend={() => handleSendFriendRequest(suggestion.user_id)}
                          onDismiss={() => handleDismissSuggestion(suggestion.user_id)}
                        />
                      ))}
                    </div>
                    {suggestions.length > suggestionsDisplayLimit && (
                      <div className="flex justify-center mt-6">
                        <button
                          onClick={() => setSuggestionsDisplayLimit(prev => prev + 20)}
                          className="flex items-center space-x-1 text-primary-600 hover:text-orange-700 font-medium"
                        >
                          <span>See more</span>
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12 bg-surface rounded-lg">
                    <Users className="w-16 h-16 text-content-tertiary mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-content mb-2">
                      No suggestions available
                    </h3>
                    <p className="text-content-secondary">
                      We couldn't find any friend suggestions at the moment.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : activeSection === "requests" ? (
            <div>
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <h2 className="sm:text-2xl font-semibold text-content text-lg">Friend Requests</h2>
                <button className="text-primary-600 hover:text-orange-700 font-medium hover:underline duration-300 " onClick={() => selectSection("home")}>
                  See all
                </button>
              </div>

              <RequestsViewTabs
                view={requestsView}
                onChange={setRequestsView}
                receivedCount={requests.length}
                pendingCount={sentRequests.length}
              />

              {requestsView === "pending" ? (
                sentLoading ? (
                  <FriendProfileCardsShimmer count={shimmerCount * 2} />
                ) : sentRequests.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {sentRequests.map((request) => (
                      <SentRequestCard
                        key={request.id}
                        request={request}
                        cancelling={cancellingRequests.has(request.id)}
                        onCancel={() => handleCancelSentRequest(request.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-surface rounded-lg">
                    <Clock className="w-16 h-16 text-content-tertiary mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-content mb-2">
                      No pending requests
                    </h3>
                    <p className="text-content-secondary">
                      Friend requests you send will appear here.
                    </p>
                  </div>
                )
              ) : loading ? (
                <FriendProfileCardsShimmer count={shimmerCount * 2} />
              ) : requests.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {requests.map((request) => (
                    <ReceivedRequestCard
                      key={request.id}
                      request={request}
                      onAccept={() => handleAcceptRequest(request.id)}
                      onDecline={() => handleDeclineRequest(request.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-surface rounded-lg">
                  <Clock className="w-16 h-16 text-content-tertiary mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-content mb-2">
                    No friend requests
                  </h3>
                  <p className="text-content-secondary">You&apos;re all caught up!</p>
                </div>
              )}
            </div>
          ) : activeSection === "all" ? (
            <div>
              {/* Header */}
              <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
                <h2 className="sm:text-2xl font-semibold text-content text-lg">All Friends</h2>
                <div className="relative max-w-full w-sm ">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-content-secondary w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search friends..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2.5 pl-9 bg-surface-input hover:bg-surface-hover focus-visible:bg-surface-hover border border-border rounded-full focus:border-orange-500 focus:ring-2 focus:ring-orange-200 focus:outline-none transition-colors text-sm text-content placeholder:text-content-tertiary"
                  />
                </div>
              </div>

              {/* Friends Grid */}
              {friendsLoading ? (
                <FriendProfileCardsShimmer count={shimmerCount * 2} />
              ) : filteredFriends.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {filteredFriends.map((friend) => (
                    <FriendProfileCard
                      key={friend.id}
                      userId={friend.id}
                      fullName={friend.full_name}
                      username={friend.username}
                      avatarUrl={friend.avatar_url}
                      bannerImage={friend.banner_image}
                      location={friend.country}
                      relationshipText={
                        (friend.mutual_friends_count ?? 0) > 0
                          ? `${friend.mutual_friends_count} mutual ${friend.mutual_friends_count === 1 ? "friend" : "friends"}`
                          : undefined
                      }
                      mutualFriends={friend.mutual_friends ?? []}
                    >
                      <Link
                        href={`/user/${friend.id}`}
                        className="flex w-full items-center justify-center rounded-full bg-[#ff6900] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#e85f00]"
                      >
                        View Profile
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleRemoveFriend(friend)}
                        disabled={removingFriends.has(friend.id)}
                        className="mt-2 w-full rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-content-secondary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {removingFriends.has(friend.id) ? "Removing..." : "Remove friend"}
                      </button>
                    </FriendProfileCard>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-surface rounded-lg">
                  <Users className="w-16 h-16 text-content-tertiary mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-content mb-2">
                    {searchTerm ? "No friends found" : "No friends yet"}
                  </h3>
                  <p className="text-content-secondary">
                    {searchTerm
                      ? "Try a different search term"
                      : "Start connecting with people in the community!"}
                  </p>
                </div>
              )}
            </div>
          ) : activeSection === "suggestions" ? (
            <div>
              {/* Header */}
              <div className="flex items-center justify-between mb-6 flex-wrap gap-2 ">
                <h2 className="sm:text-2xl font-semibold text-content text-lg">Suggestions</h2>
                <div className="relative max-w-full w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-content-secondary w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search suggestions..."
                    value={suggestionsSearchTerm}
                    onChange={(e) => setSuggestionsSearchTerm(e.target.value)}
                    className="w-full px-3 py-2.5 pl-9 bg-surface-input hover:bg-surface-hover focus-visible:bg-surface-hover border border-border rounded-full focus:border-orange-500 focus:ring-2 focus:ring-orange-200 focus:outline-none transition-colors text-sm text-content placeholder:text-content-tertiary"
                  />
                </div>
              </div>

              {/* Suggestions Grid */}
              {suggestionsLoading ? (
                <FriendProfileCardsShimmer count={shimmerCount * 2} />
              ) : filteredSuggestions.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {filteredSuggestions.map((suggestion) => (
                    <SuggestionCard
                      key={suggestion.user_id}
                      suggestion={suggestion}
                      sending={sendingRequests.has(suggestion.user_id)}
                      onSend={() => handleSendFriendRequest(suggestion.user_id)}
                      onDismiss={() => handleDismissSuggestion(suggestion.user_id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-surface rounded-lg">
                  <Users className="w-16 h-16 text-content-tertiary mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-content mb-2">
                    {suggestionsSearchTerm ? "No suggestions found" : "No suggestions available"}
                  </h3>
                  <p className="text-content-secondary">
                    {suggestionsSearchTerm
                      ? "Try a different search term"
                      : "We couldn't find any friend suggestions at the moment."}
                  </p>
                </div>
              )}
            </div>
          ) : activeSection === "birthdays" ? (
            <section className="mx-auto max-w-3xl">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold uppercase tracking-wide text-content">Upcoming Birthdays</h2>
                  {!birthdaysLoading && (
                    <span className="rounded-full bg-surface-tertiary px-2.5 py-1 text-xs font-semibold text-content-secondary">
                      {allBirthdayFriends.length}
                    </span>
                  )}
                </div>
                {allBirthdayFriends.length > birthdayDisplayLimit && (
                  <button
                    type="button"
                    onClick={() => setBirthdayDisplayLimit(allBirthdayFriends.length)}
                    className="flex shrink-0 items-center gap-1 text-sm font-semibold text-orange-600 hover:text-orange-700"
                  >
                    View All <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>

              {birthdaysLoading ? (
                <BirthdayListShimmer count={shimmerCount} />
              ) : allBirthdayFriends.length > 0 ? (
                <div className="space-y-3">
                  {allBirthdayFriends.slice(0, birthdayDisplayLimit).map((friend) => {
                    const isToday = birthdayFriends.today.some((birthdayFriend) => birthdayFriend.id === friend.id);
                    const [, month, day] = String(friend.birthday).split("-").map(Number);
                    const birthdayLabel = new Date(2000, month - 1, day).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    });
                    return (
                      <article
                        key={friend.id}
                        className="flex items-center gap-3 rounded-[20px] border border-border bg-surface p-3.5 shadow-sm transition-colors hover:bg-surface-hover sm:gap-4 sm:p-4"
                      >
                        <Link
                          href={`/user/${friend.id}`}
                          aria-label={`View ${friend.full_name}'s profile`}
                          className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-sm font-bold text-white sm:h-14 sm:w-14 ${
                            isToday
                              ? "bg-emerald-500"
                              : "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
                          }`}
                        >
                          {friend.avatar_url ? (
                            <img src={friend.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            friend.full_name?.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "?"
                          )}
                        </Link>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <Link
                              href={`/user/${friend.id}`}
                              className="truncate text-sm font-semibold text-content hover:text-orange-600"
                            >
                              {friend.full_name}
                            </Link>
                            {isToday && (
                              <span className="shrink-0 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
                                Today
                              </span>
                            )}
                          </div>
                          <p className="mt-1 flex items-center gap-2 text-xs text-content-secondary">
                            {isToday ? (
                              <Cake className="h-3.5 w-3.5 text-orange-500" />
                            ) : (
                              <Gift className="h-3.5 w-3.5 text-content-tertiary" />
                            )}
                            <span>{birthdayLabel}</span>
                            {(friend.mutual_friends_count ?? 0) > 0 && (
                              <>
                                <span aria-hidden="true">•</span>
                                <span>
                                  {friend.mutual_friends_count} mutual{" "}
                                  {friend.mutual_friends_count === 1 ? "friend" : "friends"}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                        {isToday ? (
                          <button
                            type="button"
                            onClick={() => handleStartBirthdayChat(friend)}
                            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-600 transition-colors hover:bg-orange-100 dark:border-orange-400/30 dark:bg-orange-500/10 dark:text-orange-300 dark:hover:bg-orange-500/20 sm:px-4"
                          >
                            <PartyPopper className="h-4 w-4" />
                            <span>Wish</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openBirthdayCountdown(friend)}
                            aria-label={`Show countdown to ${friend.full_name}'s birthday`}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-secondary text-content-secondary transition-colors hover:bg-surface-hover"
                          >
                            <Clock className="h-5 w-5" />
                          </button>
                        )}
                        <Link
                          href={`/user/${friend.id}`}
                          aria-label={`Open ${friend.full_name}'s profile`}
                          className="flex h-10 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-secondary text-content-tertiary transition-colors hover:bg-surface-hover hover:text-content"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Link>
                      </article>
                    );
                  })}
                  {hasMoreBirthdays && (
                    <div ref={birthdaySentinelRef} className="flex justify-center py-4">
                      <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-orange-500" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-surface px-6 py-12 text-center">
                  <Gift className="mx-auto mb-4 h-12 w-12 text-content-tertiary" />
                  <h3 className="mb-2 text-lg font-medium text-content">No upcoming birthdays</h3>
                  <p className="text-content-secondary">
                    None of your friends have upcoming birthdays.
                  </p>
                </div>
              )}
            </section>
          ) : (
            <div>
              <h2 className="text-2xl font-bold text-content mb-6">Custom Lists</h2>
              <div className="bg-surface rounded-lg shadow-sm p-8 text-center">
                <p className="text-content-secondary">Coming soon...</p>
              </div>
            </div>
          )}
        </div>
      </div>
      {countdownFriend && countdown && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
          onClick={() => setCountdownFriend(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="birthday-countdown-title"
            className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-1 flex items-start justify-between gap-3">
              <div>
                <h2 id="birthday-countdown-title" className="sm:text-left text-center text-lg font-bold text-content">
                  Birthday countdown
                </h2>
                <p className="mt-1 text-center text-sm text-content-secondary">
                  Time left until {countdownFriend.full_name}&apos;s birthday
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCountdownFriend(null)}
                aria-label="Close countdown"
                className="rounded-full p-1 text-content-tertiary hover:bg-surface-hover hover:text-content"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 grid grid-cols-5 gap-2">
              {([
                [countdown.months, "months"],
                [countdown.days, "days"],
                [countdown.hours, "hours"],
                [countdown.minutes, "mins"],
                [countdown.seconds, "secs"],
              ] as const).map(([value, label]) => (
                <div key={label} className="rounded-xl border border-orange-200 bg-orange-50 px-1 py-2.5 text-center">
                  <div className="text-xl font-bold text-orange-600">{value}</div>
                  <div className="text-[10px] text-content-secondary">{label}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-content-secondary">
              {countdown.months} month{countdown.months === 1 ? "" : "s"}{" "}
              {countdown.days} day{countdown.days === 1 ? "" : "s"}{" "}
              {countdown.hours} hour{countdown.hours === 1 ? "" : "s"}{" "}
              {countdown.minutes} minute{countdown.minutes === 1 ? "" : "s"}{" "}
              {countdown.seconds} second{countdown.seconds === 1 ? "" : "s"}
            </p>
            <button
              type="button"
              onClick={() => setCountdownFriend(null)}
              className="mt-5 w-full rounded-full bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
            >
              Close
            </button>
          </section>
        </div>
      )}
      {confirmDialog}
    </div>
  );
};

function FriendsPageFallback() {
  return (
    <div className="min-h-screen px-4">
      <div className="flex gap-6">
        <aside className="sticky top-[73px] hidden h-[calc(100dvh-73px)] w-64 shrink-0 self-start border-r border-border-subtle bg-background px-3 py-4 md:block">
          <div className="mb-6 h-7 w-24 animate-pulse rounded bg-surface-tertiary" />
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-tertiary" />
            ))}
          </div>
        </aside>
        <div className="flex-1 max-w-full py-3 sm:py-6 px-4">
          <FriendProfileCardsShimmer count={8} />
        </div>
      </div>
    </div>
  );
}

export default function FriendsPage() {
  return (
    <Suspense fallback={<FriendsPageFallback />}>
      <FriendsPageContent />
    </Suspense>
  );
}
