"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Shield, Package, Wallet } from "lucide-react";
interface AdminNotification {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: typeof Bell;
  time: string;
  unread?: boolean;
}

const DEFAULT_NOTIFICATIONS: AdminNotification[] = [
  {
    id: "1",
    title: "Open disputes",
    description: "Review cases awaiting admin resolution",
    href: "/admin/disputes",
    icon: Shield,
    time: "Live",
    unread: true,
  },
  {
    id: "2",
    title: "Pending payouts",
    description: "Seller transfers waiting for processing",
    href: "/admin/payouts",
    icon: Wallet,
    time: "Queue",
    unread: true,
  },
  {
    id: "3",
    title: "Recent orders",
    description: "Monitor escrow and payout status",
    href: "/admin/orders",
    icon: Package,
    time: "Today",
  },
];

export function AdminNotificationDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unreadCount = DEFAULT_NOTIFICATIONS.filter((n) => n.unread).length;

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

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="w-5 h-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-500 rounded-full ring-2 ring-white" />
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-80 sm:w-96 bg-white/95 backdrop-blur-xl rounded-xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden z-50"
          role="menu"
        >
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          <ul className="max-h-72 overflow-y-auto divide-y divide-gray-50">
            {DEFAULT_NOTIFICATIONS.map((n) => {
              const Icon = n.icon;
              return (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                    role="menuitem"
                  >
                    <div className="p-2 rounded-lg bg-gray-100 shrink-0">
                      <Icon className="w-4 h-4 text-gray-600" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{n.description}</p>
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0">{n.time}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
            <Link
              href="/admin/dashboard"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              View dashboard overview
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
