"use client";

import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { AdminSearch } from "./AdminSearch";
import { AdminNotificationDropdown } from "./AdminNotificationDropdown";
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
          className="lg:hidden p-2 -ml-1 rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileNavOpen}
        >
          {mobileNavOpen ? (
            <X className="w-5 h-5" aria-hidden="true" />
          ) : (
            <Menu className="w-5 h-5" aria-hidden="true" />
          )}
        </button>

        <Link
          href="/admin/dashboard"
          className="flex items-center gap-2.5 shrink-0 group"
        >
          <Image
            src="/assets/images/logo_2.png"
            alt="ConnectAfrik"
            width={56}
            height={56}
            className="w-11 h-11 sm:w-14 sm:h-14 object-contain transition-transform duration-200 group-hover:scale-105"
            priority
          />
          <div className="hidden sm:block">
            <span className="text-sm font-bold text-gray-900 leading-tight block">
              ConnectAfrik
            </span>
            <span className="text-xs text-gray-500">Admin Panel</span>
          </div>
        </Link>

        <AdminSearch />

        <div className="flex items-center gap-1 sm:gap-2 ml-auto shrink-0">
          <AdminNotificationDropdown />
          <AdminUserMenu />
        </div>
      </div>
    </header>
  );
}
