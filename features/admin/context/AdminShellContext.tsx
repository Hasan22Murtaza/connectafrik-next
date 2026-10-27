"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const SIDEBAR_MODE_KEY = "cribstalk-admin-sidebar-mode";
const LEGACY_COLLAPSED_KEY = "cribstalk-admin-sidebar-collapsed";

export type AdminSidebarMode = "expanded" | "collapsed" | "hover";

interface AdminShellContextValue {
  mobileNavOpen: boolean;
  openMobileNav: () => void;
  closeMobileNav: () => void;
  toggleMobileNav: () => void;
  sidebarMode: AdminSidebarMode;
  setSidebarMode: (mode: AdminSidebarMode) => void;
  /** @deprecated Prefer sidebarMode — true when rail is icon-only */
  sidebarCollapsed: boolean;
  toggleSidebarCollapsed: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const AdminShellContext = createContext<AdminShellContextValue | null>(null);

function readStoredMode(): AdminSidebarMode {
  if (typeof window === "undefined") return "expanded";
  try {
    const raw = localStorage.getItem(SIDEBAR_MODE_KEY);
    if (raw === "expanded" || raw === "collapsed" || raw === "hover") return raw;
    // Migrate legacy boolean key
    if (localStorage.getItem(LEGACY_COLLAPSED_KEY) === "1") return "collapsed";
  } catch {
    /* ignore */
  }
  return "expanded";
}

export function AdminShellProvider({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarMode, setSidebarModeState] = useState<AdminSidebarMode>("expanded");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSidebarModeState(readStoredMode());
    setHydrated(true);
  }, []);

  const openMobileNav = useCallback(() => setMobileNavOpen(true), []);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const toggleMobileNav = useCallback(() => setMobileNavOpen((v) => !v), []);

  const setSidebarMode = useCallback((mode: AdminSidebarMode) => {
    setSidebarModeState(mode);
    try {
      localStorage.setItem(SIDEBAR_MODE_KEY, mode);
      localStorage.setItem(LEGACY_COLLAPSED_KEY, mode === "collapsed" ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const setSidebarCollapsed = useCallback(
    (collapsed: boolean) => {
      setSidebarMode(collapsed ? "collapsed" : "expanded");
    },
    [setSidebarMode]
  );

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarModeState((prev) => {
      const next: AdminSidebarMode = prev === "expanded" ? "collapsed" : "expanded";
      try {
        localStorage.setItem(SIDEBAR_MODE_KEY, next);
        localStorage.setItem(LEGACY_COLLAPSED_KEY, next === "collapsed" ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const sidebarCollapsed = hydrated
    ? sidebarMode === "collapsed" || sidebarMode === "hover"
    : false;

  return (
    <AdminShellContext.Provider
      value={{
        mobileNavOpen,
        openMobileNav,
        closeMobileNav,
        toggleMobileNav,
        sidebarMode,
        setSidebarMode,
        sidebarCollapsed,
        toggleSidebarCollapsed,
        setSidebarCollapsed,
      }}
    >
      {children}
    </AdminShellContext.Provider>
  );
}

export function useAdminShell() {
  const ctx = useContext(AdminShellContext);
  if (!ctx) {
    throw new Error("useAdminShell must be used within AdminShellProvider");
  }
  return ctx;
}
