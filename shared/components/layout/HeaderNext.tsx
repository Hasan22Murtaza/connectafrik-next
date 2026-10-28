"use client";

import { useAuth } from "@/contexts/AuthContext";
import MobileSearchModal from "@/shared/components/search/MobileSearchModal";
import SearchResultsDropdown from "@/shared/components/search/SearchResultsDropdown";
import UserMenu from "@/shared/components/theme/UserMenu";
import NotificationDropdown from "@/shared/components/ui/NotificationDropdown";
import { useHeaderInboxCounts } from "@/shared/hooks/useHeaderInboxCounts";
import { useProfile } from "@/shared/hooks/useProfile";
import { useSearch } from "@/shared/hooks/useSearch";
import { useSpaceNavCounts } from "@/shared/hooks/useSpaceNavCounts";
import {
  Bell,
  Close,
  Home,
  Menu,
  MessageCircle,
  Search,
  Store,
  UserRound,
  Users,
  Video
} from "@/shared/icons";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { FaBars } from "react-icons/fa";
import MobileSideDrawer from "../ui/MobileSideDrawer";
import PlayMedia from "@/shared/icons/PlayMedia";
import { Handbag } from "lucide-react";

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
  const [showNotifications, setShowNotifications] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  const { unreadMessages, callBadgeCount } = useHeaderInboxCounts();
  const { friendRequestCount } = useSpaceNavCounts();
  console.log("Unread Messages:", unreadMessages);
  console.log("Friend Request Count:", friendRequestCount);
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [guestMenuOpen, setGuestMenuOpen] = useState(false);

  // Sync with external searchTerm prop
  useEffect(() => {
    if (externalSearchTerm !== undefined && externalSearchTerm !== internalSearchTerm) {
      handleSearch(externalSearchTerm);
    }
  }, [externalSearchTerm, internalSearchTerm, handleSearch]);

  useEffect(() => {
    if (user) return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [user]);

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
    <>
      <header
        className={
          user
            ? "sticky top-0 z-50 bg-surface shadow-header"
            : `sticky top-0 z-50 border-b transition-[background-color,box-shadow,border-color] duration-300 ${scrolled
              ? "border-black/[0.06] bg-white/90 shadow-sm backdrop-blur-xl"
              : "border-transparent bg-white/70 backdrop-blur-md"
            }`
        }
      >
        <div
          className={
            user
              ? "max-w-full 4xl:max-w-screen-2xl mx-auto px-1 sm:px-2 2xl:px-6 overflow-visible"
              : "mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
          }
        >
          <div
            className={
              user
                ? "relative flex items-center h-14 sm:h-16 justify-between gap-2 w-full"
                : "flex w-full items-center justify-between gap-4"
            }
          >
            <div className="flex items-center flex-1 min-w-0 gap-3 sm:gap-4">
              {/* Logo - Pinned to left */}
              <Link href="/" className="flex-shrink-0" aria-label="CribsTalk home">
                <img src="/assets/images/logo_2.png" alt="CribsTalk" className="sm:w-40 w-32" />
              </Link>

              {/* Search Bar - Only when logged in; hidden on mobile, visible on tablet+ */}
              {user && (
                <div className="hidden md:flex max-w-[min(100%,28rem)] w-full min-w-0">
                  <div className="relative w-full" ref={searchContainerRef}>
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-content-tertiary" />
                    <input
                      type="text"
                      placeholder="Search CribsTalk..."
                      className="w-full rounded-full border border-border-subtle bg-surface-secondary py-2.5 pl-10 pr-4 text-sm text-content placeholder:text-content-tertiary transition-colors hover:bg-surface-hover focus:border-border focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                    <div className="absolute top-full left-0 right-0 mt-2 bg-surface-elevated rounded-lg shadow-dropdown border border-border max-h-[600px] overflow-y-auto z-50 md:block">
                      <SearchResultsDropdown
                        results={searchResults}
                        isSearching={isSearching}
                        searchTerm={searchTerm}
                        onClose={() => setShowSearchResults(false)}
                      />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Navigation and User Menu - Pinned to right */}
            {user ? (
              <>
                {/* Notifications & Messaging */}
                <div className="relative flex items-center space-x-2 sm:space-x-2 border-border-subtle">
                  <div className="group relative flex items-center">
                    <input
                      type="text"
                      placeholder="Search CribsTalk..."
                      className="peer absolute top-8 right-0 w-0 rounded-full border-0 bg-surface py-2 px-3 opacity-0 outline-none transition-all duration-300 focus:w-62 focus:border focus:border-gray-300 focus:opacity-100 focus:ring-1 focus:ring-primary"
                      value={searchTerm}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      onFocus={() => {
                        if (searchTerm.trim().length >= 2 && searchResults) {
                          setShowSearchResults(true);
                        }
                      }}
                    />

                    <button
                      type="button"
                      onClick={(e) => {
                        e.currentTarget.parentElement?.querySelector("input")?.focus();
                      }}
                      className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-content-secondary hover:bg-surface-secondary"
                      aria-label="Search"
                    >
                      <Search className="h-5 w-5" />
                    </button>

                  
                  </div>
                 


                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowNotifications(!showNotifications);
                      }}
                      className="relative p-1 sm:p-1.5 lg:p-2 text-content-tertiary hover:text-primary-600 transition-colors"
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

                  {/* User Menu */}
                  <div className="relative group ">
                    <button
                      onClick={() => setIsUserMenuOpen((prev) => !prev)}
                      onBlur={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget)) {
                          setIsUserMenuOpen(false);
                        }
                      }}
                      className="flex items-center space-x-1 sm:space-x-2 p-1 sm:p-1.5 lg:p-2 rounded-lg hover:bg-surface-hover shrink-0"
                    >
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={profile.full_name}
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-surface-tertiary text-content-secondary rounded-full flex items-center justify-center uppercase">
                          {profile?.username.slice(0, 1) || "User"}
                        </div>
                      )}
                    </button>

                    <UserMenu
                      isOpen={isUserMenuOpen}
                      onSignOut={handleSignOut}
                      onClose={() => setIsUserMenuOpen(false)}
                    />
                  </div>

                  <button
                    onClick={() => setMobileMenuOpen(true)}
                    className="sm:hidden text-content text-xl"
                  >
                    <FaBars />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3">
                <Link
                  href="/signin"
                  className="hidden rounded-full  bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] dark:text-slate-100 transition-colors hover:bg-[#F9FAFB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/40 sm:inline-flex"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="hidden rounded-full bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#EA580C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/40 sm:inline-flex"
                >
                  Join CribsTalk
                </Link>

                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#111827] transition-colors hover:bg-[#F9FAFB] dark:text-slate-50 dark:border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/40 sm:hidden"
                  aria-label={guestMenuOpen ? "Close menu" : "Open menu"}
                  aria-expanded={guestMenuOpen}
                  onClick={() => setGuestMenuOpen((open) => !open)}
                >
                  {guestMenuOpen ? (
                    <Close className="h-5 w-5" />
                  ) : (
                    <Menu className="h-5 w-5" />
                  )}
                </button>
              </div>
            )}

 {(user && showSearchResults) && (
                    <div className="absolute top-22  left-0 right-0 mt-2 bg-surface-elevated rounded-lg shadow-dropdown border border-border max-h-[600px] overflow-y-auto z-50 md:block mx-4">
                      <SearchResultsDropdown
                        results={searchResults}
                        isSearching={isSearching}
                        searchTerm={searchTerm}
                        onClose={() => setShowSearchResults(false)}
                      />
                      </div>
                    )}
          </div>
        </div>

        {!user && guestMenuOpen && (
          <div className="border-t border-black/[0.06] bg-white sm:hidden">
            <nav
              className="mx-auto flex max-w-7xl sm:flex-col flex-row gap-2 px-4 py-4 sm:px-6"
              aria-label="Mobile"
            >
              <Link
                href="/signin"
                onClick={() => setGuestMenuOpen(false)}
                className="flex-1 inline-flex h-12 items-center justify-center rounded-full border border-[#E5E7EB] dark:border-slate-200 dark:text-slate-50 bg-white text-sm font-semibold text-[#111827]"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                onClick={() => setGuestMenuOpen(false)}
                className="flex-1 inline-flex h-12 items-center justify-center rounded-full bg-[#F97316] text-sm font-semibold text-white hover:bg-[#EA580C]"
              >
                Join CribsTalk
              </Link>
            </nav>
          </div>
        )}
      </header>
      {/* Mobile Navigation */}
      {user && !pathname?.startsWith("/reels") && (
        <div className="md:hidden fixed bottom-0 w-full  block bg-white border-t border-gray-200 py-1 z-50">
          <nav className="w-full">
            <ul className="flex justify-between w-full px-2">
              {/* Feed */}
              <li>
                <Link
                  href="/feed"
                  className={`flex items-center justify-center py-2 px-3 transition-colors ${pathname === "/feed"
                    ? "text-primary-600"
                    : "text-gray-500 hover:text-primary-600"
                    }`}
                >
                  <Home className="w-6 h-6" />
                </Link>
              </li>

              {/* Reels */}
              <li>
                <Link
                  href="/reels/foryou"
                  className={`flex items-center justify-center py-2 px-3 transition-colors ${pathname?.startsWith("/reels")
                    ? "text-primary-600"
                    : "text-gray-500 hover:text-primary-600"
                    }`}
                >
                  <PlayMedia className="w-6 h-6" />
                </Link>
              </li>


              {/* chat */}
              <li className="relative">
                <Link
                  href="/chat"
                  className={`flex items-center justify-center py-2 px-3 transition-colors ${pathname === "/friends"
                    ? "text-primary-600"
                    : "text-gray-500 hover:text-primary-600"
                    }`}
                >
                  <MessageCircle className="w-6 h-6" />
                </Link>
                {unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                    {unreadMessages > 99 ? "99+" : unreadMessages}
                  </span>
                )}
              </li>

              {/* Friends */}
              <li className="relative">
                <Link
                  href="/friends"
                  className={`flex items-center justify-center py-2 px-3 transition-colors ${pathname === "/friends"
                    ? "text-primary-600"
                    : "text-gray-500 hover:text-primary-600"
                    }`}
                >
                  <UserRound className="w-6 h-6" />
                </Link>
                {friendRequestCount > 0 && (
                  <span className="absolute top-0 right-0 w-4.5 h-4.5  rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center">
                    {friendRequestCount > 99 ? "99+" : friendRequestCount}
                  </span>
                )}
              </li>

              {/* TradeHub */}
              <li>
                <Link
                  href="/marketplace"
                  className={`flex items-center justify-center py-2 px-3 transition-colors ${pathname === "/marketplace"
                    ? "text-primary-600"
                    : "text-gray-500 hover:text-primary-600"
                    }`}
                >
                  <Handbag className="w-6 h-6" />
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
    </>

  );
};

export default Header;
