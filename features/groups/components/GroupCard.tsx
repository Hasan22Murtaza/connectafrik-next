import React, { useState } from "react";
import {
  Users,
  MapPin,
  Globe,
  Lock,
  Calendar,
  Target,
  MessageCircle,
  MoreVertical,
  Eye,
  LogOut,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Group } from "@/shared/types";
import { useAuth } from "@/contexts/AuthContext";
import { useGroups } from "@/shared/hooks/useGroups";
import { useGroupChat } from "@/shared/hooks/useGroupChat";
import { getCategoryInfo, getRoleIcon } from "@/shared/utils/groupUtils";

interface GroupCardProps {
  group: Group;
  onJoinGroup?: (groupId: string) => void;
  onViewGroup?: (groupId: string) => void;
  variant?: "default" | "compact";
}

const GroupCard: React.FC<GroupCardProps> = ({
  group,
  onJoinGroup,
  onViewGroup,
  variant = "default",
}) => {
  const { user } = useAuth();
  const { joinGroup, leaveGroup } = useGroups();
  const { openGroupChat } = useGroupChat();
  const [isJoining, setIsJoining] = useState(false);
  const [openMenu, setOpenMenu] = useState(false);

  const handleJoinGroup = async () => {
    if (!user || !group) return;

    setIsJoining(true);
    try {
      if (group.membership) {
        await leaveGroup(group.id);
      } else {
        await joinGroup(group.id);
        onJoinGroup?.(group.id);
      }
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setIsJoining(false);
    }
  };

  const handleViewGroup = () => {
    onViewGroup?.(group.id);
  };

  const categoryInfo = getCategoryInfo(group.category);
  const isMember = group.membership?.status === "active";
  const membershipCount = `${group.member_count}${
    group.member_count >= 1000 ? "K" : ""
  }`;

  if (variant === "compact") {
    return (
      <div className="card p-4 sm:p-5 hover:shadow-md transition-shadow rounded-xl">
        <div className="flex gap-4">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br from-primary-500 to-african-green text-white font-bold shrink-0">
            {group.avatar_url ? (
              <img
                src={group.avatar_url}
                alt={group.name}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <span>{categoryInfo.icon}</span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 truncate">
                {group.name}
              </h3>

              {group.is_verified && (
                <span className="text-blue-500 text-xs">✓</span>
              )}

              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryInfo.color}`}
              >
                {categoryInfo.icon}
              </span>
            </div>

            <p className="text-sm text-gray-600 line-clamp-2 mb-2">
              {group.description}
            </p>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {/* {membershipCount} */}
              </div>

              {group.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {group.location}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {group.membership && getRoleIcon(group.membership.role)}
            <button
              onClick={handleViewGroup}
              className="btn-secondary text-xs  py-1"
            >
              View
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card rounded-xl overflow-hidden hover:shadow-lg transition-shadow ">
      {/* Banner */}
      <div className="relative">
        {group.banner_url ? (
          <div className="bg-gray-100 w-full h-32 sm:h-36">
            <img
              src={group.banner_url}
              alt={group.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div
            className={`w-full h-32 sm:h-36  flex items-center justify-center ${categoryInfo.color} rounded-2xl`}
          >
            <span className="group_card_image">{categoryInfo.icon}</span>
          </div>
        )}
        {group.membership && (  
          <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-400 text-white">
            {getRoleIcon(group.membership.role)}
            <span className="capitalize">{group.membership.role}</span>
          </div>
        )}

        {/* Privacy */}
        <span
          className={`absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white ${
            group.is_public ? "bg-green-500" : "bg-gray-600"
          }`}
        >
          {group.is_public ? (
            <Globe className="w-3 h-3" />
          ) : (
            <Lock className="w-3 h-3" />
          )}
          {group.is_public ? "Public" : "Private"}
        </span>

        {/* Avatar */}
        <div className="absolute -bottom-6 left-4">
          <div className="w-12 h-12 rounded-full bg-gray-100 border border-orange-400 shadow flex items-center justify-center">
            {group.avatar_url ? (
              <img
                src={group.avatar_url}
                alt={group.name}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <span className="text-lg">{categoryInfo.icon}</span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="!pt-10  p-2">
        {/* Title */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 text-lg">
                {group.name}
              </h3>
              {group.is_verified && <span className="text-blue-500">✓</span>}
            </div>

            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium mt-1 ${categoryInfo.color}`}
            >
              <span> {categoryInfo.icon} </span>
              {group.category}
            </span>
          </div>

          {/* Three dots */}
          <div className="relative">
            <button
              onClick={() => setOpenMenu((prev) => !prev)}
              className="p-1.5 rounded-full bg-white/90 hover:bg-white shadow cursor-pointer"
            >
              <MoreVertical className="w-4 h-4 text-gray-700" />
            </button>

            {openMenu && (
              <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <button
                  onClick={() => {
                    handleViewGroup();
                    setOpenMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  View Group
                </button>

                {isMember && (
                  <button
                    onClick={() => {
                      handleJoinGroup();
                      setOpenMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    Leave Group
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 mb-4 line-clamp-3">
          {group.description}
        </p>

        {/* Stats */}
        <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {group.member_count} members
          </div>

          {group.location && (
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {group.location}
            </div>
          )}

          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {formatDistanceToNow(new Date(group.created_at), {
              addSuffix: true,
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {isMember ? (
            <button
              onClick={() => openGroupChat(group.id, group.name)}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Open Group Chat
            </button>
          ) : user ? (
            <button
              onClick={handleJoinGroup}
              disabled={isJoining}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {isJoining ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Joining...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  Join Group
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default GroupCard;
