"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ADMIN_NAV_LINKS } from "../constants/adminNavigation";
import { MP } from "@/features/marketplace/constants/marketplaceLayout";

function isLinkActive(
  pathname: string,
  href: string,
  exact?: boolean
): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function useAdminNav() {
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

  return { pathname, handleSignOut };
}

export function AdminSidebar() {
  const { pathname, handleSignOut } = useAdminNav();

  return (
    <aside className={`hidden lg:block ${MP.sidebarFull}`}>
    

      <nav >
        <ul className={MP.navList}>
          {ADMIN_NAV_LINKS.map((link) => {
            const Icon = link.icon;
            const isActive = isLinkActive(pathname, link.href);

            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`${MP.navItem} ${
                    isActive ? MP.navItemActive : MP.navItemInactive
                  }`}
                >
                  <Icon
                    className={`${MP.navIcon} ${
                      isActive ? MP.navIconActive : MP.navIconInactive
                    }`}
                  />
                  <span className="flex-1 text-left">{link.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={MP.sectionDivider} />

      <button
        type="button"
        onClick={handleSignOut}
        className={`${MP.navItem} ${MP.navItemInactive} w-full text-red-600 hover:bg-red-50`}
      >
        <LogOut className={`${MP.navIcon} text-red-600`} />
        <span className="flex-1 text-left">Sign out</span>
      </button>
    </aside>
  );
}

export function AdminMobileNav() {
  const { pathname, handleSignOut } = useAdminNav();

  return (
    <div className="lg:hidden border-b border-gray-200 bg-white px-3 py-2">
      <p className="text-sm font-semibold text-gray-900 mb-2">Admin</p>
      <nav className="flex gap-2 overflow-x-auto pb-1">
        {ADMIN_NAV_LINKS.map((link) => {
          const isActive = isLinkActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary-50 text-primary-600"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={handleSignOut}
          className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
        >
          Sign out
        </button>
      </nav>
    </div>
  );
}
