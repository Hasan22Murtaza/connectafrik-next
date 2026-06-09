"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, User, LayoutDashboard } from "lucide-react";
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
        className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        aria-label="User menu"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-orange-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
          {initials}
        </div>
        <span className="hidden md:block text-sm font-medium text-gray-700 max-w-[140px] truncate">
          {email}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 hidden md:block transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-56 bg-white/95 backdrop-blur-xl rounded-xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden z-50"
          role="menu"
        >
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900 truncate">{email}</p>
            <p className="text-xs text-gray-500">Administrator</p>
          </div>
          <ul className="py-1">
            <li>
              <Link
                href="/admin/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                role="menuitem"
              >
                <LayoutDashboard className="w-4 h-4 text-gray-500" aria-hidden="true" />
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                href="/feed"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                role="menuitem"
              >
                <User className="w-4 h-4 text-gray-500" aria-hidden="true" />
                Back to app
              </Link>
            </li>
          </ul>
          <div className="border-t border-gray-100 py-1">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              role="menuitem"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
