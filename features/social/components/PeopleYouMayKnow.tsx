import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { UserPlus, Users, ChevronLeft, ChevronRight, X, MoreHorizontal } from '@/shared/icons';
import { toast } from 'react-hot-toast';
import FriendProfileCard from './FriendProfileCard';

interface Recommendation {
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
}

export const PeopleYouMayKnow: React.FC = () => {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingRequests, setSendingRequests] = useState<Set<string>>(new Set());
  const [showOptions, setShowOptions] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const fetchRecommendations = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const res = await apiClient.get<{ data: Recommendation[] }>('/api/friends/suggestions', { limit: 12 });
      setRecommendations(res.data || []);
    } catch (error) {
      console.error('Error in fetchRecommendations:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      setRecommendations([]);
      return;
    }
    fetchRecommendations();
  }, [user?.id, fetchRecommendations]);

  const visibleRecommendations = recommendations.filter((r) => !dismissedIds.has(r.user_id));

  const checkScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    setShowLeftArrow(container.scrollLeft > 12);
    setShowRightArrow(container.scrollLeft < container.scrollWidth - container.clientWidth - 12);
  }, []);

  useEffect(() => {
    checkScrollPosition();
    const container = scrollContainerRef.current;
    container?.addEventListener('scroll', checkScrollPosition);
    window.addEventListener('resize', checkScrollPosition);
    return () => {
      container?.removeEventListener('scroll', checkScrollPosition);
      window.removeEventListener('resize', checkScrollPosition);
    };
  }, [checkScrollPosition, visibleRecommendations.length, loading]);

  useEffect(() => {
    if (!showOptions) return;

    const handleDocumentClick = (event: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
        setShowOptions(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [showOptions]);

  const scrollStrip = useCallback((direction: 'left' | 'right') => {
    scrollContainerRef.current?.scrollBy({
      left: direction === 'left' ? -200 : 200,
      behavior: 'smooth',
    });
  }, []);

  const handleSendRequest = async (userId: string) => {
    if (!user) return;

    setSendingRequests((prev) => new Set(prev).add(userId));

    try {
      await apiClient.post('/api/friends', { receiver_id: userId });

      setRecommendations((prev) => prev.filter((rec) => rec.user_id !== userId));
      toast.success('Friend request sent!');
    } catch (error: any) {
      console.error('Error sending friend request:', error);
      toast.error(error.message || 'Failed to send friend request');
    } finally {
      setSendingRequests((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const handleDismiss = (userId: string) => {
    setDismissedIds((prev) => new Set(prev).add(userId));
  };

  const handleHideSuggestions = () => {
    setDismissedIds(new Set(recommendations.map((recommendation) => recommendation.user_id)));
    setShowOptions(false);
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-md shadow-gray-200/60">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-primary-100 animate-pulse" />
            <div className="h-4 w-40 rounded bg-surface-tertiary animate-pulse" />
          </div>
          <div className="h-8 w-8 rounded-full bg-primary-50 animate-pulse" />
        </div>
        <div className="flex gap-3 overflow-hidden px-4 pb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-[168px] shrink-0 animate-pulse rounded-xl border border-border overflow-hidden shadow-sm">
              <div className="aspect-square bg-surface-tertiary" />
              <div className="space-y-2 p-3">
                <div className="h-3.5 w-3/4 rounded bg-surface-tertiary" />
                <div className="h-3 w-1/2 rounded bg-surface-tertiary" />
                <div className="h-9 w-full rounded-lg bg-primary-50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (visibleRecommendations.length === 0) {
    return null;
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-md shadow-gray-200/60">
        <div className="flex items-center justify-between px-4 pt-4 pb-1">
          <h3 className="text-[15px] font-bold text-[#1c1e21] flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-600 shrink-0" />
            People you may know
          </h3>
          <div ref={optionsRef} className="relative">
            <button
              type="button"
              onClick={() => setShowOptions((open) => !open)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-content-secondary transition-colors hover:bg-primary-50 hover:text-orange-500"
              aria-label="More options"
              aria-expanded={showOptions}
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {showOptions && (
              <div className="absolute right-0 top-11 z-30 min-w-44 rounded-xl border border-border bg-surface p-1.5 shadow-lg">
                <button
                  type="button"
                  onClick={handleHideSuggestions}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-content transition-colors hover:bg-surface-secondary"
                >
                  Hide suggestions
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="relative pb-2">
          {showLeftArrow && (
            <button
              type="button"
              onClick={() => scrollStrip('left')}
              className="flex absolute left-1 sm:left-2 top-[calc(50%-12px)] -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 bg-surface rounded-full shadow-md items-center justify-center hover:bg-primary-50 transition-colors border border-border"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600" />
            </button>
          )}
          {showRightArrow && (
            <button
              type="button"
              onClick={() => scrollStrip('right')}
              className="flex absolute right-1 sm:right-2 top-[calc(50%-12px)] -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 bg-surface rounded-full shadow-md items-center justify-center hover:bg-primary-50 transition-colors border border-border"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600" />
            </button>
          )}

          <div
            ref={scrollContainerRef}
            className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth px-4 pt-1 pb-3"
          >
            {visibleRecommendations.map((rec) => (
              <FriendProfileCard
                key={rec.user_id}
                userId={rec.user_id}
                fullName={rec.full_name}
                username={rec.username}
                avatarUrl={rec.avatar_url}
                bannerImage={rec.banner_image}
                location={rec.location ?? rec.country ?? undefined}
                relationshipText={
                  rec.mutual_friends_count > 0
                    ? `${rec.mutual_friends_count} mutual ${rec.mutual_friends_count === 1 ? 'friend' : 'friends'}`
                    : 'Suggested for you'
                }
                mutualFriends={rec.mutual_friends ?? []}
                className="w-[220px] shrink-0"
                coverAction={
                  <button
                    type="button"
                    onClick={() => handleDismiss(rec.user_id)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-800/55 text-white transition-colors hover:bg-gray-900/65"
                    aria-label={`Dismiss ${rec.full_name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                }
              >
                <button
                  type="button"
                  onClick={() => handleSendRequest(rec.user_id)}
                  disabled={sendingRequests.has(rec.user_id)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-full bg-[#ff6900] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#e85f00] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sendingRequests.has(rec.user_id) ? (
                    'Sending…'
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 shrink-0" />
                      Link Up
                    </>
                  )}
                </button>
                <Link
                  href={`/user/${rec?.user_id}`}
                  className="mt-2.5 flex w-full items-center justify-center rounded-full bg-[#eef2ff] px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-[#e0e7ff] dark:bg-white/10 dark:text-content dark:hover:bg-white/15"
                >
                  View Profile
                </Link>
              </FriendProfileCard>
            ))}
          </div>
        </div>

        <div className="border-t border-border-subtle py-3">
          <Link
            href="/friends"
            className="block text-center text-sm font-semibold text-primary-600 hover:text-orange-500 hover:underline"
          >
            See all
          </Link>
        </div>
      </div>

    </>
  );
};
