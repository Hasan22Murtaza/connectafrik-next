import {
  LayoutDashboard,
  Package,
  Shield,
  Users,
  Wallet,
} from "lucide-react";

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
    href: "/admin/orders",
    label: "Orders",
    icon: Package,
  },
  {
    href: "/admin/payouts",
    label: "Payouts",
    icon: Wallet,
  },
  {
    href: "/admin/disputes",
    label: "Disputes",
    icon: Shield,
  },
] as const;
