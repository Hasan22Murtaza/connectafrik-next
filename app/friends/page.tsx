"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Home,
  UserPlus,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Settings,
  Gift,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Friend, FriendRequest } from "@/shared/types";
import toast from "react-hot-toast";

const FriendsPage: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<(FriendRequest & { mutualFriendsCount?: number })[]>([]);
  const [suggestions, setSuggestions] = useState<Array<{
    user_id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
    mutual_friends_count: number;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [sendingRequests, setSendingRequests] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestionsSearchTerm, setSuggestionsSearchTerm] = useState("");
  const [requestsDisplayLimit, setRequestsDisplayLimit] = useState(20);
  const [suggestionsDisplayLimit, setSuggestionsDisplayLimit] = useState(20);
  const [activeSection, setActiveSection] = useState<"home" | "requests" | "suggestions" | "all" | "birthdays" | "custom">("home");

  useEffect(() => {
    if (user) {
      fetchFriends();
      fetchFriendRequests();
      if (activeSection === "suggestions" || activeSection === "home") {
        fetchSuggestions();
      }
      // Reset display limits when switching sections
      if (activeSection === "home") {
        setRequestsDisplayLimit(20);
        setSuggestionsDisplayLimit(20);
      }
    }
  }, [user, activeSection]);

  const fetchFriends = async () => {
    try {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from("friend_requests")
        .select(
          `
          *,
          sender:profiles!friend_requests_sender_id_profiles_fkey(id, username, full_name, avatar_url, country, bio),
          receiver:profiles!friend_requests_receiver_id_profiles_fkey(id, username, full_name, avatar_url, country, bio)
        `
        )
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .eq("status", "accepted")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Map to friend objects (the other person in the friendship)
      const friendsList: Friend[] = (data || []).map((req) => {
        const friend = req.sender_id === user.id ? req.receiver : req.sender;
        const friendData = Array.isArray(friend) ? friend[0] : friend;

        return {
          id: friendData?.id || "",
          username: friendData?.username || "",
          full_name: friendData?.full_name || "",
          avatar_url: friendData?.avatar_url,
          country: friendData?.country,
          bio: friendData?.bio,
          friendship_date: req.created_at,
        };
      });

      setFriends(friendsList);
    } catch (error: any) {
      console.error("Error fetching friends:", error);
    }
  };

  const fetchFriendRequests = async () => {
    try {
      setLoading(true);
      if (!user?.id) return;

      const { data, error } = await supabase
        .from("friend_requests")
        .select(
          `
          *,
          sender:profiles!friend_requests_sender_id_profiles_fkey (
            id,
            username,
            full_name,
            avatar_url,
            country
          )
        `
        )
        .eq("receiver_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Map to match the interface and fetch mutual friends count
      const mappedData = await Promise.all(
        (data || []).map(async (req) => {
          // Get mutual friends count
          let mutualFriendsCount = 0;
          try {
            const { data: countData } = await supabase.rpc('get_mutual_friends_count', {
              user1_id: user.id,
              user2_id: req.sender_id
            });
            mutualFriendsCount = countData || 0;
          } catch (err) {
            console.error("Error fetching mutual friends count:", err);
          }

          return {
            ...req,
            requester_id: req.sender_id,
            recipient_id: req.receiver_id,
            requester: req.sender,
            mutualFriendsCount,
          };
        })
      );

      setRequests(mappedData || []);
    } catch (error: any) {
      console.error("Error fetching friend requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("friend_requests")
        .update({ status: "accepted", responded_at: new Date().toISOString() })
        .eq("id", requestId);

      if (error) throw error;

      toast.success("Friend request accepted!");
      fetchFriendRequests();
      fetchFriends();
    } catch (error: any) {
      console.error("Error accepting request:", error);
      toast.error("Failed to accept request");
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("friend_requests")
        .update({ status: "declined", responded_at: new Date().toISOString() })
        .eq("id", requestId);

      if (error) throw error;

      toast.success("Friend request declined");
      fetchFriendRequests();
    } catch (error: any) {
      console.error("Error declining request:", error);
      toast.error("Failed to decline request");
    }
  };

  const fetchSuggestions = async () => {
    if (!user?.id) return;

    try {
      setSuggestionsLoading(true);
      
      // First try to get mutual friend recommendations
      const { data: mutualData, error: mutualError } = await supabase.rpc('get_friend_recommendations', {
        p_user_id: user.id,
        p_limit: 50
      });

      if (mutualError) {
        console.error('Error fetching mutual recommendations:', mutualError);
      }

      // If no mutual recommendations, get general user recommendations
      if (!mutualData || mutualData.length === 0) {
        const { data: generalData, error: generalError } = await supabase.rpc('get_general_user_recommendations', {
          p_user_id: user.id,
          p_limit: 50
        });

        if (generalError) {
          console.error('Error fetching general recommendations:', generalError);
          return;
        }

        setSuggestions(generalData || []);
      } else {
        setSuggestions(mutualData || []);
      }
    } catch (error) {
      console.error('Error in fetchSuggestions:', error);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleSendFriendRequest = async (userId: string) => {
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

      // Remove from suggestions after sending request
      setSuggestions(prev => prev.filter(rec => rec.user_id !== userId));
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-full mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Left Sidebar */}
          <div className="w-64 shrink-0">
            <div className="sticky top-6 h-[calc(100vh-3rem)] bg-white rounded-lg shadow-sm p-4 overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Friends</h2>
                <button className="text-gray-500 hover:text-gray-700">
                  <Settings className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation */}
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveSection("home")}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                    activeSection === "home"
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Users className={`w-5 h-5 ${activeSection === "home" ? "text-blue-600" : "text-gray-500"}`} />
                    <span className="font-medium">Home</span>
                  </div>
                </button>

                <button
                  onClick={() => setActiveSection("requests")}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                    activeSection === "requests"
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <UserPlus className={`w-5 h-5 ${activeSection === "requests" ? "text-blue-600" : "text-gray-500"}`} />
                    <span className="font-medium">Friend Requests</span>
                  </div>
                  {requests.length > 0 && (
                    <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                      {requests.length}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>

                <button
                  onClick={() => setActiveSection("suggestions")}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                    activeSection === "suggestions"
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <UserPlus className={`w-5 h-5 ${activeSection === "suggestions" ? "text-blue-600" : "text-gray-500"}`} />
                    <span className="font-medium">Suggestions</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>

                <button
                  onClick={() => setActiveSection("all")}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                    activeSection === "all"
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Users className={`w-5 h-5 ${activeSection === "all" ? "text-blue-600" : "text-gray-500"}`} />
                    <span className="font-medium">All friends</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>

                <button
                  onClick={() => setActiveSection("birthdays")}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                    activeSection === "birthdays"
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Gift className={`w-5 h-5 ${activeSection === "birthdays" ? "text-blue-600" : "text-gray-500"}`} />
                    <span className="font-medium">Birthdays</span>
                  </div>
                </button>
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {activeSection === "home" ? (
              <div className="space-y-8">
                {/* Friend Requests Section */}
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Friend Requests</h2>
                    <button 
                      onClick={() => setActiveSection("requests")}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      See all
                    </button>
                  </div>

                  {/* Friend Requests Grid */}
                  {loading ? (
                    <div className="flex justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                  ) : requests.length > 0 ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                        {requests.slice(0, requestsDisplayLimit).map((request) => (
                        <div
                          key={request.id}
                          className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                        >
                          {/* Profile Image */}
                          <div className="w-full aspect-square bg-gray-100 relative">
                            {request.requester?.avatar_url ? (
                              <img
                                src={request.requester.avatar_url}
                                alt={request.requester.full_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-primary-600 bg-primary-100">
                                {request.requester?.full_name?.charAt(0) || "U"}
                              </div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="p-4">
                            <h3 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-1">
                              {request.requester?.full_name || "Unknown User"}
                            </h3>
                            
                            {/* Mutual Friends */}
                            {request.mutualFriendsCount !== undefined && request.mutualFriendsCount > 0 && (
                              <div className="flex items-center space-x-1.5 text-xs text-gray-600 mb-4">
                                <div className="flex -space-x-1">
                                  {Array.from({ length: Math.min(request.mutualFriendsCount, 2) }).map((_, i) => (
                                    <div
                                      key={i}
                                      className="w-4 h-4 rounded-full bg-gray-300 border-2 border-white"
                                    />
                                  ))}
                                </div>
                                <span>{request.mutualFriendsCount} mutual {request.mutualFriendsCount === 1 ? 'friend' : 'friends'}</span>
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="space-y-2">
                              <button
                                onClick={() => handleAcceptRequest(request.id)}
                                className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => handleDeclineRequest(request.id)}
                                className="w-full px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                        ))}
                      </div>
                      {requests.length > requestsDisplayLimit && (
                        <div className="flex justify-center mt-6">
                          <button
                            onClick={() => setRequestsDisplayLimit(prev => prev + 20)}
                            className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-medium"
                          >
                            <span>See more</span>
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12 bg-white rounded-lg">
                      <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No pending requests
                      </h3>
                      <p className="text-gray-500">You're all caught up!</p>
                    </div>
                  )}
                </div>

                {/* People You May Know Section */}
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">People You May Know</h2>
                    <button 
                      onClick={() => setActiveSection("suggestions")}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      See all
                    </button>
                  </div>

                  {/* Suggestions Grid */}
                  {suggestionsLoading ? (
                    <div className="flex justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                  ) : suggestions.length > 0 ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                        {suggestions.slice(0, suggestionsDisplayLimit).map((suggestion) => (
                        <div
                          key={suggestion.user_id}
                          className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                        >
                          {/* Profile Image */}
                          <div className="w-full aspect-square bg-gray-100 relative">
                            {suggestion.avatar_url ? (
                              <img
                                src={suggestion.avatar_url}
                                alt={suggestion.full_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-primary-600 bg-primary-100">
                                {suggestion.full_name?.charAt(0) || "U"}
                              </div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="p-4">
                            <h3 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-1">
                              {suggestion.full_name || "Unknown User"}
                            </h3>
                            
                            {/* Mutual Friends */}
                            {suggestion.mutual_friends_count > 0 && (
                              <div className="flex items-center space-x-1.5 text-xs text-gray-600 mb-4">
                                <div className="flex -space-x-1">
                                  {Array.from({ length: Math.min(suggestion.mutual_friends_count, 2) }).map((_, i) => (
                                    <div
                                      key={i}
                                      className="w-4 h-4 rounded-full bg-gray-300 border-2 border-white"
                                    />
                                  ))}
                                </div>
                                <span>{suggestion.mutual_friends_count} mutual {suggestion.mutual_friends_count === 1 ? 'friend' : 'friends'}</span>
                              </div>
                            )}

                            {/* Action Button */}
                            <button
                              onClick={() => handleSendFriendRequest(suggestion.user_id)}
                              disabled={sendingRequests.has(suggestion.user_id)}
                              className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                            >
                              {sendingRequests.has(suggestion.user_id) ? "Sending..." : "Add Friend"}
                            </button>
                          </div>
                        </div>
                        ))}
                      </div>
                      {suggestions.length > suggestionsDisplayLimit && (
                        <div className="flex justify-center mt-6">
                          <button
                            onClick={() => setSuggestionsDisplayLimit(prev => prev + 20)}
                            className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-medium"
                          >
                            <span>See more</span>
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12 bg-white rounded-lg">
                      <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No suggestions available
                      </h3>
                      <p className="text-gray-500">
                        We couldn't find any friend suggestions at the moment.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : activeSection === "requests" ? (
              <div>
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Friend Requests</h2>
                  <button className="text-blue-600 hover:text-blue-700 font-medium">
                    See all
                  </button>
                </div>

                {/* Friend Requests Grid */}
                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  </div>
                ) : requests.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                    {requests.map((request) => (
                      <div
                        key={request.id}
                        className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                      >
                        {/* Profile Image */}
                        <div className="w-full aspect-square bg-gray-100 relative">
                          {request.requester?.avatar_url ? (
                            <img
                              src={request.requester.avatar_url}
                              alt={request.requester.full_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-primary-600 bg-primary-100">
                              {request.requester?.full_name?.charAt(0) || "U"}
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="p-4">
                          <h3 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-1">
                            {request.requester?.full_name || "Unknown User"}
                          </h3>
                          
                          {/* Mutual Friends */}
                          {request.mutualFriendsCount !== undefined && request.mutualFriendsCount > 0 && (
                            <div className="flex items-center space-x-1.5 text-xs text-gray-600 mb-4">
                              <div className="flex -space-x-1">
                                {Array.from({ length: Math.min(request.mutualFriendsCount, 2) }).map((_, i) => (
                                  <div
                                    key={i}
                                    className="w-4 h-4 rounded-full bg-gray-300 border-2 border-white"
                                  />
                                ))}
                              </div>
                              <span>{request.mutualFriendsCount} mutual {request.mutualFriendsCount === 1 ? 'friend' : 'friends'}</span>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="space-y-2">
                            <button
                              onClick={() => handleAcceptRequest(request.id)}
                              className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => handleDeclineRequest(request.id)}
                              className="w-full px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-white rounded-lg">
                    <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No pending requests
                    </h3>
                    <p className="text-gray-500">You're all caught up!</p>
                  </div>
                )}
              </div>
            ) : activeSection === "all" ? (
              <div>
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">All Friends</h2>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search friends..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Friends Grid */}
                {filteredFriends.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                    {filteredFriends.map((friend) => (
                      <div
                        key={friend.id}
                        className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                      >
                        {/* Profile Image */}
                        <div className="w-full aspect-square bg-gray-100 relative">
                          {friend.avatar_url ? (
                            <img
                              src={friend.avatar_url}
                              alt={friend.full_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-primary-600 bg-primary-100">
                              {friend.full_name?.charAt(0) || "U"}
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="p-4">
                          <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-1">
                            {friend.full_name || "Unknown User"}
                          </h3>
                          <p className="text-xs text-gray-500 mb-1 line-clamp-1">
                            @{friend.username}
                          </p>
                          {friend.country && (
                            <p className="text-xs text-gray-400 mb-4 line-clamp-1">
                              {friend.country}
                            </p>
                          )}

                          {/* Action Button */}
                          <button
                            onClick={() => router.push(`/user/${friend.username}`)}
                            className="w-full px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm"
                          >
                            View Profile
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-white rounded-lg">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {searchTerm ? "No friends found" : "No friends yet"}
                    </h3>
                    <p className="text-gray-500">
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
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Suggestions</h2>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search suggestions..."
                      value={suggestionsSearchTerm}
                      onChange={(e) => setSuggestionsSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Suggestions Grid */}
                {suggestionsLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  </div>
                ) : filteredSuggestions.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                    {filteredSuggestions.map((suggestion) => (
                      <div
                        key={suggestion.user_id}
                        className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                      >
                        {/* Profile Image */}
                        <div className="w-full aspect-square bg-gray-100 relative">
                          {suggestion.avatar_url ? (
                            <img
                              src={suggestion.avatar_url}
                              alt={suggestion.full_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-primary-600 bg-primary-100">
                              {suggestion.full_name?.charAt(0) || "U"}
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="p-4">
                          <h3 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-1">
                            {suggestion.full_name || "Unknown User"}
                          </h3>
                          
                          {/* Mutual Friends */}
                          {suggestion.mutual_friends_count > 0 && (
                            <div className="flex items-center space-x-1.5 text-xs text-gray-600 mb-4">
                              <div className="flex -space-x-1">
                                {Array.from({ length: Math.min(suggestion.mutual_friends_count, 2) }).map((_, i) => (
                                  <div
                                    key={i}
                                    className="w-4 h-4 rounded-full bg-gray-300 border-2 border-white"
                                  />
                                ))}
                              </div>
                              <span>{suggestion.mutual_friends_count} mutual {suggestion.mutual_friends_count === 1 ? 'friend' : 'friends'}</span>
                            </div>
                          )}

                          {/* Action Button */}
                          <button
                            onClick={() => handleSendFriendRequest(suggestion.user_id)}
                            disabled={sendingRequests.has(suggestion.user_id)}
                            className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                          >
                            {sendingRequests.has(suggestion.user_id) ? "Sending..." : "Add Friend"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-white rounded-lg">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {suggestionsSearchTerm ? "No suggestions found" : "No suggestions available"}
                    </h3>
                    <p className="text-gray-500">
                      {suggestionsSearchTerm
                        ? "Try a different search term"
                        : "We couldn't find any friend suggestions at the moment."}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  {activeSection === "birthdays" && "Birthdays"}
                  {activeSection === "custom" && "Custom Lists"}
                </h2>
                <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                  <p className="text-gray-500">Coming soon...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FriendsPage;
