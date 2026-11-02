"use client";

import { Menu, X } from "@/shared/icons";
import { AdminSearch } from "./AdminSearch";
import { AdminUserMenu } from "./AdminUserMenu";
import { useAdminShell } from "../context/AdminShellContext";
import { AP } from "../constants/adminLayout";

export function AdminHeader() {
  const { mobileNavOpen, toggleMobileNav } = useAdminShell();

  return (
    <header className={AP.header}>
      <div className={AP.headerInner}>
        <button
          type="button"
          onClick={toggleMobileNav}
          className="lg:hidden -ml-1 rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
          aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileNavOpen}
        >
          {mobileNavOpen ? (
            <X className="w-5 h-5" aria-hidden="true" />
          ) : (
            <Menu className="w-5 h-5" aria-hidden="true" />
          )}
        </button>

        <div className="lg:hidden text-sm font-semibold text-gray-900">CribsTalk Admin</div>

        <AdminSearch />

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <AdminUserMenu />
        </div>
      </div>
    </header>
  );
}
