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
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "requests">("all");

  useEffect(() => {
    if (user) {
      fetchFriends();
      fetchFriendRequests();
    }
  }, [user]);

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

      // Map to match the interface (requester instead of sender)
      const mappedData = (data || []).map((req) => ({
        ...req,
        requester_id: req.sender_id,
        recipient_id: req.receiver_id,
        requester: req.sender,
      }));

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

  const filteredFriends = friends.filter(
    (friend) =>
      friend.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      friend.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50"> 
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="bg-white border-b border-gray-200 py-6  ">
            <div>
              <div className="flex items-center justify-between space-x-6 h-[50px] ">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
                  <Users className="w-7 h-7 text-primary-600" />
                  <span>Friends</span>
                </h1>

                {/* Search (only in "all" friends tab) */}
                {activeTab === "all" && (
                  <div className="relative w-100">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search friends..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="input-field !pl-10"
                    />
                  </div>
                )}
              </div>

              <p className="text-gray-600 py-4">
                Manage your connections on ConnectAfrik
              </p>
            </div>

            {/* Tabs */}
            <div className="flex items-center space-x-1 ">
              <button
                onClick={() => setActiveTab("all")}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  activeTab === "all"
                    ? "bg-primary-100 text-primary-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>All Friends ({friends.length})</span>
              </button>

              <button
                onClick={() => setActiveTab("requests")}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  activeTab === "requests"
                    ? "bg-primary-100 text-primary-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Requests ({requests.length})</span>
              </button>
            </div>
        </div>
        {/* Content */}
        <div className="py-8">
          {activeTab === "requests" ? (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Pending Requests
              </h2>
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : requests.length > 0 ? (
                requests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-white rounded-lg shadow p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-4">
                      {request.requester?.avatar_url ? (
                        <img
                          src={request.requester.avatar_url}
                          alt={request.requester.full_name}
                          className="w-16 h-16 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-primary-100 flex items-center justify-center text-xl font-bold text-primary-600">
                          {request.requester?.full_name?.charAt(0) || "U"}
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {request.requester?.full_name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          @{request.requester?.username}
                        </p>
                        {request.requester?.country && (
                          <p className="text-xs text-gray-400">
                            {request.requester.country}
                          </p>
                        )}
                        {request.message && (
                          <p className="text-sm text-gray-600 italic mt-1">
                            "{request.message}"
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleAcceptRequest(request.id)}
                        className="flex items-center space-x-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Accept</span>
                      </button>
                      <button
                        onClick={() => handleDeclineRequest(request.id)}
                        className="flex items-center space-x-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Decline</span>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No pending requests
                  </h3>
                  <p className="text-gray-500">You're all caught up!</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                All Friends
              </h2>
              {filteredFriends.length > 0 ? (
                filteredFriends.map((friend) => (
                  <div
                    key={friend.id}
                    className="bg-white rounded-lg shadow p-4 flex items-center justify-between cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => router.push(`/user/${friend.username}`)}
                  >
                    <div className="flex items-center space-x-4">
                      {friend.avatar_url ? (
                        <img
                          src={friend.avatar_url}
                          alt={friend.full_name}
                          className="w-16 h-16 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-primary-100 flex items-center justify-center text-xl font-bold text-primary-600">
                          {friend.full_name?.charAt(0) || "U"}
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {friend.full_name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          @{friend.username}
                        </p>
                        {friend.country && (
                          <p className="text-xs text-gray-400">
                            {friend.country}
                          </p>
                        )}
                        {friend.bio && (
                          <p className="text-sm text-gray-600 line-clamp-2 mt-2 max-w-[300px]">
                            {friend.bio}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/user/${friend.username}`);
                      }}
                      className="btn-sm-primary"
                    >
                      View Profile
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
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
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendsPage;
