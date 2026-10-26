import {
  Flag,
  LayoutDashboard,
  MessageSquare,
  Users,
} from '@/shared/icons';

export const ADMIN_NAV_LINKS = [
  {
    href: "/admin/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: Users,
  },
  {
    href: "/admin/reports",
    label: "Reports",
    icon: Flag,
  },
  {
    href: "/admin/feedback",
    label: "Feedback",
    icon: MessageSquare,
  },
] as const;
