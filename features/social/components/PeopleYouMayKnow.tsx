import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { UserPlus, Users, ChevronLeft, ChevronRight, X, MoreHorizontal } from 'lucide-react';
import { toast } from 'react-hot-toast';
import UserSearch from '@/shared/components/ui/UserSearch';

interface Recommendation {
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  mutual_friends_count: number;
}

export const PeopleYouMayKnow: React.FC = () => {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingRequests, setSendingRequests] = useState<Set<string>>(new Set());
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
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

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-md shadow-gray-200/60">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-primary-100 animate-pulse" />
            <div className="h-4 w-40 rounded bg-gray-200 animate-pulse" />
          </div>
          <div className="h-8 w-8 rounded-full bg-primary-50 animate-pulse" />
        </div>
        <div className="flex gap-3 overflow-hidden px-4 pb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-[168px] shrink-0 animate-pulse rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="aspect-square bg-gray-200" />
              <div className="space-y-2 p-3">
                <div className="h-3.5 w-3/4 rounded bg-gray-200" />
                <div className="h-3 w-1/2 rounded bg-gray-200" />
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
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-md shadow-gray-200/60">
        <div className="flex items-center justify-between px-4 pt-4 pb-1">
          <h3 className="text-[15px] font-bold text-[#1c1e21] flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-600 shrink-0" />
            People you may know
          </h3>
          <button
            type="button"
            onClick={() => setShowUserSearch(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-primary-50 hover:text-primary-700"
            aria-label="More options"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>

        <div className="relative pb-2">
          {showLeftArrow && (
            <button
              type="button"
              onClick={() => scrollStrip('left')}
              className="flex absolute left-1 sm:left-2 top-[calc(50%-12px)] -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 bg-white rounded-full shadow-md items-center justify-center hover:bg-primary-50 transition-colors border border-gray-200"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600" />
            </button>
          )}
          {showRightArrow && (
            <button
              type="button"
              onClick={() => scrollStrip('right')}
              className="flex absolute right-1 sm:right-2 top-[calc(50%-12px)] -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 bg-white rounded-full shadow-md items-center justify-center hover:bg-primary-50 transition-colors border border-gray-200"
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
              <div
                key={rec.user_id}
                className="w-[168px] shrink-0 rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm"
              >
                <div className="relative aspect-square bg-gray-100">
                  {rec.avatar_url ? (
                    <img
                      src={rec.avatar_url}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary-100 to-primary-200">
                      <span className="text-3xl font-semibold text-primary-700">
                        {rec.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDismiss(rec.user_id)}
                    className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-gray-800/55 text-white hover:bg-gray-900/65 transition-colors"
                    aria-label={`Dismiss ${rec.full_name}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-3 pt-2.5">
                  <p className="font-semibold text-sm text-[#1c1e21] text-center line-clamp-2 min-h-[2.5rem] leading-tight">
                    {rec.full_name}
                  </p>
                  {rec.mutual_friends_count > 0 ? (
                    <p className="mt-1.5 text-xs text-gray-500 text-center truncate px-0.5">
                      {rec.mutual_friends_count} mutual {rec.mutual_friends_count === 1 ? 'friend' : 'friends'}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-gray-400 text-center">Suggested for you</p>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSendRequest(rec.user_id)}
                    disabled={sendingRequests.has(rec.user_id)}
                    className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--primary-200)] bg-primary-50 py-2 text-sm font-semibold text-primary-600 transition-colors hover:bg-[var(--primary-100)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sendingRequests.has(rec.user_id) ? (
                      'Sending…'
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 shrink-0" />
                        Add friend
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-100 py-3">
          <Link
            href="/friends"
            className="block text-center text-sm font-semibold text-primary-600 hover:text-primary-700 hover:underline"
          >
            See all
          </Link>
        </div>
      </div>

      {showUserSearch && (
        <UserSearch
          onClose={() => setShowUserSearch(false)}
          onUserSelect={() => {
            setShowUserSearch(false);
            fetchRecommendations();
          }}
        />
      )}
    </>
  );
};
