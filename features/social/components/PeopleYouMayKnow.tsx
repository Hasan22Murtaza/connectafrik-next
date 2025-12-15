import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { UserPlus, Users, Search } from 'lucide-react';
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

  useEffect(() => {
    if (user) {
      fetchRecommendations();
    }
  }, [user]);

  const fetchRecommendations = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // First try to get mutual friend recommendations
      const { data: mutualData, error: mutualError } = await supabase.rpc('get_friend_recommendations', {
        p_user_id: user.id,
        p_limit: 5
      });

      if (mutualError) {
        console.error('Error fetching mutual recommendations:', mutualError);
      }

      // If no mutual recommendations, get general user recommendations
      if (!mutualData || mutualData.length === 0) {
        const { data: generalData, error: generalError } = await supabase.rpc('get_general_user_recommendations', {
          p_user_id: user.id,
          p_limit: 5
        });

        if (generalError) {
          console.error('Error fetching general recommendations:', generalError);
          return;
        }

        setRecommendations(generalData || []);
      } else {
        setRecommendations(mutualData || []);
      }
    } catch (error) {
      console.error('Error in fetchRecommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (userId: string) => {
    if (!user) return;

    setSendingRequests(prev => new Set(prev).add(userId));

    try {
      const { error } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: user.id,
          receiver_id: userId,
          status: 'pending'
        });

      if (error) throw error;

      // Remove from recommendations after sending request
      setRecommendations(prev => prev.filter(rec => rec.user_id !== userId));
      toast.success('Friend request sent!');
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

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Users className="w-5 h-5" />
          People You May Know
        </h3>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return null; // Don't show the widget if no recommendations
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 flex items-center" style={{ gap: '8px' }}>
            <Users className="w-5 h-5 text-primary-600" />
            People You May Know
          </h3>
          <button
            onClick={() => setShowUserSearch(true)}
            className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center"
            style={{ gap: '4px' }}
          >
            <Search className="w-4 h-4" />
            Search
          </button>
        </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {recommendations.map(rec => (
          <div key={rec.user_id} className="flex items-center justify-between" style={{ gap: '12px' }}>
            <div className="flex items-center flex-1 min-w-0" style={{ gap: '12px' }}>
              {rec.avatar_url ? (
                <img
                  src={rec.avatar_url}
                  alt={rec.full_name}
                  className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-semibold text-primary-700">
                    {rec.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900 truncate">
                  {rec.full_name}
                </p>
                <p className="text-xs text-gray-500 flex items-center" style={{ gap: '4px' }}>
                  <Users className="w-3 h-3" />
                  {rec.mutual_friends_count} mutual {rec.mutual_friends_count === 1 ? 'friend' : 'friends'}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleSendRequest(rec.user_id)}
              disabled={sendingRequests.has(rec.user_id)}
              className="flex-shrink-0 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center min-w-[80px] sm:px-3 sm:py-1.5 sm:text-xs"
              style={{ gap: '4px' }}
            >
              {sendingRequests.has(rec.user_id) ? (
                <>Sending...</>
              ) : (
                <>
                  <UserPlus className="w-3 h-3" />
                  Add
                </>
              )}
            </button>
          </div>
        ))}
      </div>
      </div>

      {/* User Search Modal */}
      {showUserSearch && (
        <UserSearch
          onClose={() => setShowUserSearch(false)}
          onUserSelect={() => {
            setShowUserSearch(false)
            // Refresh recommendations after adding a friend
            fetchRecommendations()
          }}
        />
      )}
    </>
  );
};
