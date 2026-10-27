"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, User, LayoutDashboard } from "@/shared/icons";
import { useAuth } from "@/contexts/AuthContext";

export function AdminUserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const email = user?.email ?? "Admin";
  const initials = email.slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = "/signin";
    } catch {
      alert("An error occurred during sign out. Please try again.");
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
        aria-label="User menu"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
          {initials}
        </div>
        <span className="hidden max-w-[140px] truncate text-sm font-medium text-gray-700 md:block">
          {email}
        </span>
        <ChevronDown
          className={`hidden h-4 w-4 text-gray-400 transition-transform md:block ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-1.5 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
          role="menu"
        >
          <div className="border-b border-gray-100 px-3 py-2.5">
            <p className="truncate text-sm font-medium text-gray-900">{email}</p>
            <p className="text-xs text-gray-500">Administrator</p>
          </div>
          <ul className="py-1">
            <li>
              <Link
                href="/admin/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                role="menuitem"
              >
                <LayoutDashboard className="h-4 w-4 text-gray-500" aria-hidden="true" />
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                href="/feed"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                role="menuitem"
              >
                <User className="h-4 w-4 text-gray-500" aria-hidden="true" />
                Back to app
              </Link>
            </li>
          </ul>
          <div className="border-t border-gray-100 py-1">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              role="menuitem"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
