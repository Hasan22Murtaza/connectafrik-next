import {
  Film,
  Flag,
  LayoutDashboard,
  MessageSquare,
  Phone,
  Settings,
  Store,
  FileText,
  Users,
} from "@/shared/icons";
import type { LucideIcon } from "@/shared/icons";

export type AdminNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
};

export const ADMIN_NAV_LINKS: AdminNavLink[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/posts", label: "Posts", icon: FileText },
  { href: "/admin/reports", label: "Reports", icon: Flag },
  { href: "/admin/calls", label: "Calls", icon: Phone },
  { href: "/admin/marketplace", label: "TradeHub", icon: Store },
  { href: "/admin/reels", label: "Reels", icon: Film },
  { href: "/admin/feedback", label: "Feedback", icon: MessageSquare },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export const ADMIN_SEARCHABLE_LINKS = ADMIN_NAV_LINKS.filter((link) => !link.disabled);
