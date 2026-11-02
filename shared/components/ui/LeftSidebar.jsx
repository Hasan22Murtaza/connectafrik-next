"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpaceNavCounts } from "@/shared/hooks/useSpaceNavCounts";
import { useHeaderInboxCounts } from "@/shared/hooks/useHeaderInboxCounts";
import { UserRoundGroup } from "@/shared/icons";
import {
  Bookmark,
  Check,
  Home,
  MessageCircle,
  MessageSquareText,
  PanelLeft,
  Phone,
  Settings,
  Handbag,
  UsersRound,
  Video,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import PlayMedia from "@/shared/icons/PlayMedia";

const STORAGE_KEY = "connectafrik.sidebar-mode";

/** @typedef {'expanded' | 'collapsed' | 'hover'} SidebarMode */

const MODE_OPTIONS = [
  { id: "expanded", label: "Expanded" },
  { id: "collapsed", label: "Collapsed" },
  { id: "hover", label: "Expand on hover" },
];

const shortcuts = [
  { name: "Feed", to: "/feed", icon: Home },
  { name: "Reels", to: "/reels", icon: PlayMedia },
  { name: "Friends", to: "/friends", icon: UsersRound },
  { name: "Groups", to: "/groups", icon: UserRoundGroup },
  { name: "Messages", to: "/chat", icon: MessageCircle, badgeKey: "chat" },
  { name: "Calls", to: "/calls", icon: Phone, badgeKey: "calls" },
  { name: "TradeHub", to: "/marketplace", icon: Handbag },
  { name: "Saved", to: "/saved", icon: Bookmark },
  { name: "Feedback", to: "/feedback", icon: MessageSquareText },
  { name: "Settings", to: "/settings", icon: Settings },
];

function formatBadge(count) {
  if (count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

function isPathActive(pathname, to) {
  if (!to) return false;
  if (pathname === to) return true;
  if (to !== "/" && pathname.startsWith(`${to}/`)) return true;
  if (
    to === "/settings" &&
    (pathname === "/profile" || pathname.startsWith("/profile/"))
  ) {
    return true;
  }
  return false;
}

function readStoredMode() {
  if (typeof window === "undefined") return "collapsed";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "expanded" || raw === "collapsed" || raw === "hover") return raw;
  } catch {
    /* ignore */
  }
  return "collapsed";
}

const LeftSidebar = () => {
  const pathname = usePathname();
  const { newOrderCount } = useSpaceNavCounts();
  const { unreadMessages, callBadgeCount } = useHeaderInboxCounts();
  const [mode, setMode] = useState(/** @type {SidebarMode} */ ("collapsed"));
  const [hydrated, setHydrated] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [controlOpen, setControlOpen] = useState(false);
  const controlRef = useRef(null);

  useEffect(() => {
    setMode(readStoredMode());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!controlOpen) return;
    const onPointerDown = (e) => {
      if (controlRef.current && !controlRef.current.contains(e.target)) {
        setControlOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setControlOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [controlOpen]);

  const persistMode = useCallback((next) => {
    setMode(next);
    setHovered(false);
    setControlOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const badgeFor = (badgeKey) => {
    if (badgeKey === "orders") return formatBadge(newOrderCount);
    if (badgeKey === "chat") return formatBadge(unreadMessages);
    if (badgeKey === "calls") return formatBadge(callBadgeCount);
    return null;
  };

  const hoverExpanded = mode === "hover" && hovered;
  const showLabels = mode === "expanded" || hoverExpanded;

  // Collapsed rail ~56px; expanded panel ~224px (matches reference)
  const railClass = mode === "expanded" ? "w-56" : "w-14";

  const itemClass = (isActive) =>
    [
      "group relative flex w-full items-center rounded-lg text-[15px] font-medium transition-colors duration-150",
      showLabels ? "gap-3 px-3 py-2.5" : "justify-center px-2 py-2.5",
      isActive
        ? "bg-[#f0f2f5] text-[#050505]"
        : "text-[#65676b] hover:bg-[#f2f2f2] hover:text-[#050505]",
    ].join(" ");

  return (
    <aside
      className={`sticky top-[73px] z-30 hidden h-[calc(100dvh-73px)] shrink-0 self-start lg:block ${railClass}`}
      onMouseEnter={() => mode === "hover" && setHovered(true)}
      onMouseLeave={() => {
        if (mode === "hover") {
          setHovered(false);
          setControlOpen(false);
        }
      }}
    >
      <div
        className={`flex h-full flex-col border-r border-[#e4e6eb] bg-white ${
          hoverExpanded
            ? "absolute inset-y-0 left-0 z-40 w-56 shadow-lg"
            : "relative w-full"
        }`}
      >
        <nav
          className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3"
          aria-label="Main"
        >
          <ul className="space-y-0.5">
            {shortcuts.map((item) => {
              const isActive = isPathActive(pathname, item.to);
              const Icon = item.icon;
              const badge = badgeFor(item.badgeKey);

              return (
                <li key={item.name}>
                  <Link
                    href={item.to}
                    className={itemClass(isActive)}
                    title={!showLabels ? item.name : undefined}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span className="relative shrink-0">
                      <Icon
                        aria-hidden="true"
                        className="h-[22px] w-[22px]"
                        strokeWidth={1.75}
                      />
                      {badge && !showLabels && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-semibold leading-none text-white">
                          {badge}
                        </span>
                      )}
                    </span>
                    {showLabels && (
                      <>
                        <span className="min-w-0 flex-1 truncate">{item.name}</span>
                        {badge && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-medium text-white">
                            {badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div
          ref={controlRef}
          className="relative shrink-0 border-t border-[#e4e6eb] p-2"
        >
          <button
            type="button"
            onClick={() => setControlOpen((o) => !o)}
            className={[
              "flex w-full items-center rounded-lg text-[15px] font-medium text-[#65676b] transition-colors hover:bg-[#f2f2f2] hover:text-[#050505]",
              showLabels ? "gap-3 px-3 py-2.5" : "justify-center px-2 py-2.5",
            ].join(" ")}
            aria-expanded={controlOpen}
            aria-haspopup="dialog"
            title={!showLabels ? "Sidebar control" : undefined}
          >
            <PanelLeft
              className="h-[22px] w-[22px] shrink-0"
              strokeWidth={1.75}
              aria-hidden
            />
            {showLabels && <span className="truncate">Sidebar control</span>}
          </button>

          {controlOpen && (
            <div
              role="dialog"
              aria-label="Sidebar control"
              className="absolute bottom-full left-2 z-50 mb-2 w-48 rounded-lg border border-[#e4e6eb] bg-white p-1.5 shadow-lg"
            >
              <p className="px-2.5 py-1.5 text-xs font-semibold text-[#050505]">
                Sidebar control
              </p>
              <ul className="space-y-0.5" role="listbox" aria-label="Sidebar width">
                {MODE_OPTIONS.map((opt) => {
                  const selected = hydrated && mode === opt.id;
                  return (
                    <li key={opt.id} role="option" aria-selected={selected}>
                      <button
                        type="button"
                        onClick={() => persistMode(opt.id)}
                        className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                          selected
                            ? "bg-[#f0f2f5] text-[#050505]"
                            : "text-[#65676b] hover:bg-[#f2f2f2] hover:text-[#050505]"
                        }`}
                      >
                        <span>{opt.label}</span>
                        {selected && (
                          <Check className="h-4 w-4 text-[#050505]" aria-hidden />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default LeftSidebar;
