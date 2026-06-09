"use client";

import Link from "next/link";

export function AdminHeader() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex h-14 sm:h-16 items-center px-4 sm:px-6">
        <Link href="/admin/dashboard" className="flex items-center gap-3 shrink-0">
          <img src="/assets/images/logo_2.png" alt="ConnectAfrik" className="w-14" />
          <span className="hidden sm:block text-sm font-semibold text-gray-700">
            Admin Panel
          </span>
        </Link>
      </div>
    </header>
  );
}
