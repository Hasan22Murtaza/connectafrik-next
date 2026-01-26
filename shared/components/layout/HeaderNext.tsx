"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  User,
  LogOut,
  Search,
  Bell,
  MessageCircle,
  Phone,
  Home,
  Video,
  Landmark,
  Palette,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/shared/hooks/useProfile";
import { useNotifications } from "@/shared/hooks/useNotifications";
import { useProductionChat } from "@/contexts/ProductionChatContext";
import ChatDropdown from "@/features/chat/components/ChatDropdown";
import NotificationDropdown from "@/shared/components/ui/NotificationDropdown";
import { FaBars } from "react-icons/fa";
import MobileSideDrawer from "../ui/MobileSideDrawer";
import { useSearch } from "@/shared/hooks/useSearch";
import SearchResultsDropdown from "@/shared/components/search/SearchResultsDropdown";
import MobileSearchModal from "@/shared/components/search/MobileSearchModal";

interface HeaderProps {
  searchTerm?: string;
  onSearchTermChange?: (term: string) => void;
}

const Header: React.FC<HeaderProps> = ({
  searchTerm: externalSearchTerm,
  onSearchTermChange,
}) => {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const {} = useProductionChat();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showCalls, setShowCalls] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Search functionality using custom hook
  const {
    searchTerm: internalSearchTerm,
    searchResults,
    isSearching,
    handleSearch,
  } = useSearch();

  // Sync internal search term with external prop
  const searchTerm = externalSearchTerm !== undefined ? externalSearchTerm : internalSearchTerm;

  // TODO: Get threads from messaging service or realtime hook
  const unreadMessages = 0;
  const pathname = usePathname();

  // Sync with external searchTerm prop
  useEffect(() => {
    if (externalSearchTerm !== undefined && externalSearchTerm !== internalSearchTerm) {
      handleSearch(externalSearchTerm);
    }
  }, [externalSearchTerm, internalSearchTerm, handleSearch]);

  // Handle search input change
  const handleSearchChange = (value: string) => {
    handleSearch(value);
    if (onSearchTermChange) {
      onSearchTermChange(value);
    }
    if (value.trim().length >= 2) {
      setShowSearchResults(true);
    } else {
      setShowSearchResults(false);
    }
  };

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);


  const handleSignOut = async () => {
    try {
      console.log("Starting sign out process...");
      await signOut();
      console.log("Sign out successful, navigating to signin...");
      // Force a hard navigation to ensure clean state
      window.location.href = "/signin";
    } catch (error) {
      console.error("Sign out error:", error);
      alert("An error occurred during sign out. Please try again.");
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm ">
      <div className="max-w-full 2xl:max-w-screen-2xl mx-auto px-1 sm:px-2 lg:px-4 xl:px-8 overflow-visible">
        <div className="flex items-center h-14 sm:h-16">
          {/* Logo - Pinned to left */}
          <Link href="/" className="flex-shrink-0 ">  
            <img src="/assets/images/logo_2.png" alt="" className="w-16" />
          </Link>

          {/* Search Bar - Hidden on mobile, visible on tablet+ */}
          <div className="hidden md:flex flex-1 max-w-lg mx-4 lg:mx-8">
            <div className="relative w-full" ref={searchContainerRef}>
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
              <input
                type="text"
                placeholder="Search connectafrik"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => {
                  if (searchTerm.trim().length >= 2 && searchResults) {
                    setShowSearchResults(true);
                  }
                }}
              />
              
              {/* Search Results Dropdown */}
              {showSearchResults && (
                <SearchResultsDropdown
                  results={searchResults}
                  isSearching={isSearching}
                  searchTerm={searchTerm}
                  onClose={() => setShowSearchResults(false)}
                />
              )}
            </div>
          </div>

          {/* Mobile Search Button - Visible only on mobile */}
          {user && (
            <button
              onClick={() => setShowMobileSearch(true)}
              className="md:hidden p-2 text-gray-600 hover:text-[#FF6900] transition-colors"
              aria-label="Open search"
            >
              <Search className="w-5 h-5" />
            </button>
          )}

          {/* Navigation and User Menu - Pinned to right */}
          <div className=" flex items-center space-x-1 sm:space-x-2 lg:space-x-4 ml-auto">
            {user ? (
              <>
                {/* Navigation Links - Hidden on mobile, visible on desktop */}
                <nav className="sm:!block !hidden lg:flex items-center ">
                  <ul className="flex items-center space-x-8 pr-10 pt-3">
                    {/* Feed */}
                    <li className="relative">
                      <Link
                        href="/feed"
                        className={`flex flex-col items-center gap-1 pb-2 transition-colors ${
                          pathname === "/feed"
                            ? "text-[#FF6900]"
                            : "text-gray-600 hover:text-[#FF6900]"
                        }`}
                      >
                        <Home className="w-12" />
                        <span className="text-sm font-medium">Feed</span>
                        {pathname === "/feed" && (
                          <span className="absolute bottom-0 left-0 w-full h-[2px] bg-primary-600 rounded-full" />
                        )}
                      </Link>
                    </li>

                    {/* Reels */}
                    <li className="relative">
                      <Link
                        href="/memories"
                        className={`flex flex-col items-center gap-1 pb-2 transition-colors ${
                          pathname === "/memories"
                            ? "text-[#FF6900]"
                            : "text-gray-600 hover:text-[#FF6900]"
                        }`}
                      >
                        <Video className="w-12" />
                        <span className="text-sm font-medium">Reels</span>
                        {pathname === "/memories" && (
                          <span className="absolute bottom-0 left-0 w-full h-[2px] bg-primary-600 rounded-full" />
                        )}
                      </Link>
                    </li>

                    {/* Politics */}
                    <li className="relative">
                      <Link
                        href="/politics"
                        className={`flex flex-col items-center gap-1 pb-2 transition-colors ${
                          pathname === "/politics"
                            ? "text-[#FF6900]"
                            : "text-gray-600 hover:text-[#FF6900]"
                        }`}
                      >
                        <Landmark className="w-12" />
                        <span className="text-sm font-medium">Politics</span>
                        {pathname === "/politics" && (
                          <span className="absolute bottom-0 left-0 w-full h-[2px] bg-primary-600 rounded-full" />
                        )}
                      </Link>
                    </li>

                    {/* Culture */}
                    <li className="relative">
                      <Link
                        href="/culture"
                        className={`flex flex-col items-center gap-1 pb-2 transition-colors ${
                          pathname === "/culture"
                            ? "text-[#FF6900]"
                            : "text-gray-600 hover:text-[#FF6900]"
                        }`}
                      >
                        <Palette className="w-12" />
                        <span className="text-sm font-medium">Culture</span>
                        {pathname === "/culture" && (
                          <span className="absolute bottom-0 left-0 w-full h-[2px] bg-primary-600 rounded-full" />
                        )}
                      </Link>
                    </li>

                    {/* Groups */}
                    <li className="relative">
                      <Link
                        href="/groups"
                        className={`flex flex-col items-center gap-1 pb-2 transition-colors ${
                          pathname === "/groups"
                            ? "text-[#FF6900]"
                            : "text-gray-600 hover:text-[#FF6900]"
                        }`}
                      >
                        <Users className="w-12" />
                        <span className="text-sm font-medium">Groups</span>
                        {pathname === "/groups" && (
                          <span className="absolute bottom-0 left-0 w-full h-[2px] bg-primary-600 rounded-full" />
                        )}
                      </Link>
                    </li>
                  </ul>
                </nav>

                {/* Notifications & Messaging */}
                <div className="flex items-center space-x-2 sm:space-x-2  border-gray-200">
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowNotifications(!showNotifications);
                        setShowInbox(false);
                        setShowCalls(false);
                      }}
                      className="relative p-1 sm:p-1.5 lg:p-2 text-gray-400 hover:text-[#FF6900] transition-colors"
                    >
                      <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                      {unreadNotificationCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                          {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                        </span>
                      )}
                    </button>
                    <NotificationDropdown
                      isOpen={showNotifications}
                      onClose={() => setShowNotifications(false)}
                      onUnreadCountChange={setUnreadNotificationCount}
                    />
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowInbox(!showInbox);
                        setShowNotifications(false);
                        setShowCalls(false);
                      }}
                      className="relative p-1 sm:p-1.5 lg:p-2 text-gray-400 hover:text-[#FF6900] transition-colors"
                    >
                      <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                      {unreadMessages > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center font-medium">
                          {unreadMessages > 99 ? "99+" : unreadMessages}
                        </span>
                      )}
                    </button>
                    {showInbox && (
                      <ChatDropdown
                        mode="chat"
                        onClose={() => setShowInbox(false)}
                      />
                    )}
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowCalls(!showCalls);
                        setShowNotifications(false);
                        setShowInbox(false);
                      }}
                      className="relative p-1 sm:p-1.5 lg:p-2 text-gray-400 hover:text-[#FF6900] transition-colors"
                    >
                      <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    {showCalls && (
                      <ChatDropdown
                        mode="call"
                        onClose={() => setShowCalls(false)}
                      />
                    )}
                  </div>
                </div>

                {/* User Menu */}
                <div className="relative group ml-1 sm:ml-2  pl-1 sm:pl-2 lg:pl-4 sm:border-l border-0 border-gray-200">
                  <button
                    onClick={() => setIsUserMenuOpen((prev) => !prev)}
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget)) {
                        setIsUserMenuOpen(false);
                      }
                    }}
                    className="flex items-center space-x-1 sm:space-x-2 p-1 sm:p-1.5 lg:p-2 rounded-lg hover:bg-gray-50"
                  >
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.full_name}
                        className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 sm:w-6 sm:h-6 lg:w-8 lg:h-8 bg-gray-300 rounded-full flex items-center justify-center">
                        <User className="w-3 h-3 sm:w-3 sm:h-3 lg:w-4 lg:h-4 text-gray-600" />
                      </div>
                    )}
                    <span className="hidden md:block text-sm font-medium text-gray-700">
                      {profile?.username || "User"}
                    </span>
                  </button>

                  <div
                    className={`absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 transition-all duration-200
                          ${
                            isUserMenuOpen
                              ? "opacity-100 visible"
                              : "opacity-0 invisible group-hover:opacity-100 group-hover:visible"
                          }
                        `}
                  >
                    <div className="py-2">
                      <Link
                        href="/profile"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        My Profile
                      </Link>
                      <Link
                        href="/profile"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Settings
                      </Link>
                      <hr className="my-1 border-gray-300" />
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 flex items-center space-x-2"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="sm:hidden text-gray-700 text-xl"
                >
                  <FaBars />
                </button>
              </>
            ) : (
              <div className="flex items-center space-x-2 sm:space-x-4 pr-1  sm:pr-4 sm:border-r border-0 border-gray-200 ">
                <Link
                  href="/signin"
                  className="btn-secondary !px-3 sm:px-5 sm:text-base text-sm"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="btn-primary !px-3 sm:px-5 sm:text-base text-sm"
                >
                  Join Community
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {user && (
        <div className="md:hidden fixed bottom-0 w-full  block bg-white border-t border-gray-200 py-1">
          <nav className="w-full">
            <ul className="flex justify-between w-full px-2">
              {/* Feed */}
              <li>
                <Link
                  href="/feed"
                  className={`flex items-center justify-center py-2 px-3 transition-colors ${
                    usePathname() === "/feed"
                      ? "text-[#FF6900]"
                      : "text-gray-500 hover:text-[#FF6900]"
                  }`}
                >
                  <Home className="w-6 h-6" />
                </Link>
              </li>

              {/* Reels */}
              <li>
                <Link
                  href="/memories"
                  className={`flex items-center justify-center py-2 px-3 transition-colors ${
                    usePathname() === "/memories"
                      ? "text-[#FF6900]"
                      : "text-gray-500 hover:text-[#FF6900]"
                  }`}
                >
                  <Video className="w-6 h-6" />
                </Link>
              </li>

              {/* Politics */}
              <li>
                <Link
                  href="/politics"
                  className={`flex items-center justify-center py-2 px-3 transition-colors ${
                    usePathname() === "/politics"
                      ? "text-[#FF6900]"
                      : "text-gray-500 hover:text-[#FF6900]"
                  }`}
                >
                  <Landmark className="w-6 h-6" />
                </Link>
              </li>

              {/* Culture */}
              <li>
                <Link
                  href="/culture"
                  className={`flex items-center justify-center py-2 px-3 transition-colors ${
                    usePathname() === "/culture"
                      ? "text-[#FF6900]"
                      : "text-gray-500 hover:text-[#FF6900]"
                  }`}
                >
                  <Palette className="w-6 h-6" />
                </Link>
              </li>

              {/* Groups */}
              <li>
                <Link
                  href="/groups"
                  className={`flex items-center justify-center py-2 px-3 transition-colors ${
                    usePathname() === "/groups"
                      ? "text-[#FF6900]"
                      : "text-gray-500 hover:text-[#FF6900]"
                  }`}
                >
                  <Users className="w-6 h-6" />
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      )}

      {/* Side Drawer */}
      <MobileSideDrawer
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Mobile Search Modal */}
      <MobileSearchModal
        isOpen={showMobileSearch}
        onClose={() => setShowMobileSearch(false)}
      />
    </header>
  );
};

export default Header;
