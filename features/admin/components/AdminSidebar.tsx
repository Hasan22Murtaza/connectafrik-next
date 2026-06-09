"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ADMIN_NAV_LINKS } from "../constants/adminNavigation";
import { useAdminShell } from "../context/AdminShellContext";
import { AP } from "../constants/adminLayout";

function isLinkActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = "/signin";
    } catch {
      alert("An error occurred during sign out. Please try again.");
    }
  };

  return (
    <>
     

      <nav aria-label="Admin navigation">
        <ul className={AP.navList}>
          {ADMIN_NAV_LINKS.map((link) => {
            const Icon = link.icon;
            const isActive = isLinkActive(pathname, link.href);

            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={onNavigate}
                  className={`${AP.navItem} ${
                    isActive ? AP.navItemActive : AP.navItemInactive
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon
                    className={`${AP.navIcon} ${
                      isActive ? AP.navIconActive : AP.navIconInactive
                    }`}
                    aria-hidden="true"
                  />
                  <span className="flex-1 text-left">{link.label}</span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={AP.sectionDivider} />

      <button
        type="button"
        onClick={handleSignOut}
        className={`${AP.navItem} ${AP.navItemInactive} w-full text-red-600 hover:bg-red-50 hover:text-red-700`}
      >
        <LogOut className={`${AP.navIcon} text-red-500`} aria-hidden="true" />
        <span className="flex-1 text-left">Sign out</span>
      </button>
    </>
  );
}

export function AdminSidebar() {
  const { mobileNavOpen, closeMobileNav } = useAdminShell();

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
        <NavContent onNavigate={closeMobileNav} />
      </aside>

      <aside className={`hidden lg:block ${AP.sidebar}`}>
        <NavContent />
      </aside>
    </>
  );
}

export function AdminMobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="lg:hidden border-b border-gray-100 bg-white/90 backdrop-blur-sm px-3 py-2 overflow-x-auto scrollbar-hide"
      aria-label="Mobile admin navigation"
    >
      <div className="flex gap-2 min-w-max pb-0.5">
        {ADMIN_NAV_LINKS.map((link) => {
          const isActive = isLinkActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-primary-600 text-white shadow-sm shadow-primary-600/30"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
