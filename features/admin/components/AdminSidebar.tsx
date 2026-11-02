"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, PanelLeft } from "lucide-react";
import { ADMIN_NAV_LINKS } from "../constants/adminNavigation";
import {
  useAdminShell,
  type AdminSidebarMode,
} from "../context/AdminShellContext";
import { AP } from "../constants/adminLayout";

const MODE_OPTIONS: { id: AdminSidebarMode; label: string }[] = [
  { id: "expanded", label: "Expanded" },
  { id: "collapsed", label: "Collapsed" },
  { id: "hover", label: "Expand on hover" },
];

function isLinkActive(pathname: string, href: string): boolean {
  if (href.startsWith("#")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link
      href="/admin/dashboard"
      className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#f2f2f2] ${
        collapsed ? "justify-center" : ""
      }`}
    >
      <Image
        src="/assets/favicon-2.png"
        alt="CribsTalk"
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 object-contain"
        priority
      />
      {!collapsed && (
        <div className="min-w-0">
          <span className="block truncate text-sm font-semibold leading-tight text-[#050505]">
            CribsTalk
          </span>
          <span className="block text-xs leading-tight text-primary-600">Admin</span>
        </div>
      )}
    </Link>
  );
}

function NavContent({
  onNavigate,
  collapsed = false,
  showLabels = true,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  showLabels?: boolean;
}) {
  const pathname = usePathname();
  const { sidebarMode, setSidebarMode } = useAdminShell();
  const [controlOpen, setControlOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!controlOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (controlRef.current && !controlRef.current.contains(e.target as Node)) {
        setControlOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setControlOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [controlOpen]);

  const persistMode = useCallback(
    (next: AdminSidebarMode) => {
      setSidebarMode(next);
      setControlOpen(false);
    },
    [setSidebarMode]
  );

  const itemPad = showLabels ? "" : "justify-center px-2";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={`shrink-0 ${collapsed ? "px-2 py-3" : "px-2 py-3"}`}>
        <Brand collapsed={!showLabels} />
      </div>

      <nav
        aria-label="Admin navigation"
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2"
      >
        <ul className={AP.navList}>
          {ADMIN_NAV_LINKS.map((link) => {
            const Icon = link.icon;
            const isActive = !link.disabled && isLinkActive(pathname, link.href);

            if (link.disabled) {
              return (
                <li key={link.label}>
                  <span
                    className={`${AP.navItem} ${AP.navItemDisabled} ${itemPad}`}
                    title={`${link.label} — coming soon`}
                    aria-disabled="true"
                  >
                    <Icon className={`${AP.navIcon} text-gray-400`} aria-hidden="true" />
                    {showLabels && (
                      <>
                        <span className="flex-1 text-left">{link.label}</span>
                        <span className="text-[10px] uppercase tracking-wide text-gray-400">
                          Soon
                        </span>
                      </>
                    )}
                  </span>
                </li>
              );
            }

            return (
              <li key={`${link.href}-${link.label}`}>
                <Link
                  href={link.href}
                  onClick={onNavigate}
                  title={!showLabels ? link.label : undefined}
                  className={`${AP.navItem} ${
                    isActive ? AP.navItemActive : AP.navItemInactive
                  } ${itemPad}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon
                    className={`${AP.navIcon} ${
                      isActive ? AP.navIconActive : AP.navIconInactive
                    }`}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  {showLabels && <span className="flex-1 truncate text-left">{link.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="relative shrink-0 border-t border-[#e4e6eb] p-2" ref={controlRef}>
        <button
          type="button"
          onClick={() => setControlOpen((o) => !o)}
          className={`${AP.navItem} ${AP.navItemInactive} w-full ${itemPad}`}
          aria-expanded={controlOpen}
          aria-haspopup="dialog"
          title={!showLabels ? "Sidebar control" : undefined}
        >
          <PanelLeft
            className={`${AP.navIcon} ${AP.navIconInactive}`}
            strokeWidth={1.75}
            aria-hidden
          />
          {showLabels && <span className="truncate">Sidebar control</span>}
        </button>

        {controlOpen && (
          <div
            role="dialog"
            aria-label="Sidebar control"
            className={`absolute z-50 w-48 rounded-lg border border-[#e4e6eb] bg-white p-1.5 shadow-lg ${
              showLabels
                ? "bottom-full left-2 mb-2"
                : "bottom-0 left-full ml-2"
            }`}
          >
            <p className="px-2.5 py-1.5 text-xs font-semibold text-[#050505]">
              Sidebar control
            </p>
            <ul className="space-y-0.5" role="listbox" aria-label="Sidebar width">
              {MODE_OPTIONS.map((opt) => {
                const selected = hydrated && sidebarMode === opt.id;
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
  );
}

export function AdminSidebar() {
  const {
    mobileNavOpen,
    closeMobileNav,
    sidebarMode,
  } = useAdminShell();

  const [hovered, setHovered] = useState(false);
  const hoverExpanded = sidebarMode === "hover" && hovered;
  const showLabels = sidebarMode === "expanded" || hoverExpanded;
  const railCollapsed = sidebarMode === "collapsed" || sidebarMode === "hover";

  return (
    <>
      {mobileNavOpen && (
        <button
          type="button"
          className={AP.sidebarOverlay}
          onClick={closeMobileNav}
          aria-label="Close navigation overlay"
        />
      )}

      <aside
        className={`${AP.sidebarMobile} ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!mobileNavOpen}
      >
        <NavContent onNavigate={closeMobileNav} showLabels />
      </aside>

      <aside
        className={`${AP.sidebar} relative sticky top-0 h-screen isolate ${
          railCollapsed ? AP.sidebarCollapsed : AP.sidebarExpanded
        }`}
        onMouseEnter={() => sidebarMode === "hover" && setHovered(true)}
        onMouseLeave={() => {
          if (sidebarMode === "hover") setHovered(false);
        }}
      >
        <div
          className={`flex h-full min-w-0 flex-col bg-white ${
            hoverExpanded
              ? "absolute inset-y-0 left-0 z-30 w-56 overflow-visible border-r border-[#e4e6eb] bg-white shadow-lg"
              : "relative w-full overflow-visible"
          }`}
        >
          <NavContent
            collapsed={railCollapsed && !hoverExpanded}
            showLabels={showLabels}
          />
        </div>
      </aside>
    </>
  );
}

export function AdminMobileNav() {
  return null;
}
